/**
 * Die Simulation. Fixer Timestep, deterministisch, kennt kein DOM.
 * Alles, was das Spiel ausmacht, passiert hier - die UI liest nur ab.
 */
import { BALANCE } from './balance.js';
import { D, type Num } from './numbers.js';
import { Rng } from './rng.js';
import { isSellable, stepMarkets, type MarketNode } from './market.js';
import { generateLevel, levelCapacity, levelUpCost, maxLevel } from './world.js';
import {
  milestoneMultiplier, nextMilestone, siteArea, siteCost, siteCount,
  siteOutput, totalOutput, usedArea,
} from './production.js';
import { ownedArea, parcelBulkCost, parcelCost, parcelPool, parcelsForCash } from './land.js';
import { makePolicy, PILOT_TRAITS, type Policy } from './policy.js';
import { EventBus, type EventListener, type GameEvent } from './events.js';
import {
  migrate, offlineSeconds, SAVE_VERSION,
  type SaveV1, type StorageAdapter,
} from './save.js';

/** Statthalter-Stufe -> Politik. Stufe 0 ist Handverkauf. */
const PILOT_KEYS = ['none', 's0', 's1', 's2', 's3'] as const;

export interface SimOptions {
  seed?: number;
  /** Politik erzwingen (nur fuer Messlaeufe). Sonst gilt die gekaufte Stufe. */
  pilot?: keyof typeof PILOT_TRAITS;
  onEvent?: EventListener;
}

export class Sim {
  time = 0;
  cash: Num = D(0);
  lifetime: Num = D(0);
  level = 0;
  parcels = 1;
  owned: number[] = new Array(siteCount()).fill(0);
  storage = 0;
  storageLevel = 0;
  pilotLevel = 0;
  /** Geglaetteter Ertrag pro Sekunde, fuer Anzeige und Kaufprognosen. */
  incomeRate = 0;
  nodes: MarketNode[];
  finished = false;

  readonly events = new EventBus();
  private rng: Rng;
  private seed: number;
  private pilotOverride?: keyof typeof PILOT_TRAITS;
  private policy!: Policy;
  private reactSeconds = 0;
  private cachedAlloc: number[] | null = null;
  private storageStalled = false;
  /** Handbetrieb: Ware, die zu einem Gebiet unterwegs ist (je Knoten). */
  private manualQueue: number[] = [];

  constructor(opts: SimOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rng = new Rng(this.seed);
    this.pilotOverride = opts.pilot;
    if (opts.onEvent) this.events.on(opts.onEvent);
    this.nodes = generateLevel(0, this.seed);
    this.owned[0] = 1; // Start: ein Badezimmer, eine Parzelle (CLAUDE.md, erste 60 s)
    this.refreshPolicy();
  }

  private emit(event: GameEvent): void {
    this.events.emit(event);
  }

  private refreshPolicy(): void {
    const key = this.pilotOverride ?? PILOT_KEYS[this.pilotLevel] ?? 'none';
    const traits = PILOT_TRAITS[key]!;
    this.policy = makePolicy(traits);
    this.reactSeconds = traits.reactSeconds;
    this.cachedAlloc = null;
  }

  /** Verkauft jemand, wenn der Spieler weg ist? Stufe 0 heisst Handarbeit. */
  hasAutopilot(): boolean {
    return this.pilotLevel > 0 || this.pilotOverride !== undefined;
  }

  output(): Num {
    return totalOutput(this.owned);
  }

  storageCap(): number {
    const seconds = BALANCE.storage.bufferSeconds *
      Math.pow(BALANCE.storage.bufferPerLevel, this.storageLevel);
    return this.output().toNumber() * seconds;
  }

  freeArea(): number {
    return ownedArea(this.parcels) - usedArea(this.owned);
  }

  capacity(): number {
    return levelCapacity(this.level);
  }

  marketsSaturated(): boolean {
    return this.output().toNumber() >= this.capacity() * 0.95;
  }

  /**
   * Freigeschaltete Ortsarten.
   *
   * GEMESSEN UND VERWORFEN (M6): mit L+1 statt L+2 waere die Entscheidungs-
   * dichte deutlich besser - ein Stueck der neuesten Art deckt dann nur ein
   * Drittel bis die Haelfte der Stufe statt des Zwei- bis Sechsfachen. Der Lauf
   * bleibt damit aber auf dem Kontinent stehen (40 h, 734 Parzellen): die
   * flaechenlosen Orte - Frachtschiff, Orbitalstation - kommen dann zu spaet,
   * um die Landknappheit aufzufangen. Der Hebel liegt also in der Ortstabelle,
   * nicht hier. Siehe BALANCING.md, Abschnitt 10.
   */
  unlockedTiers(): number {
    return Math.min(siteCount(), this.level + 2);
  }

  parcelPool(): number {
    return parcelPool(this.level);
  }

  // --- Tick ---------------------------------------------------------------

  tick(dt = BALANCE.tickSeconds): void {
    if (this.finished) return;

    const room = Math.max(0, this.storageCap() - this.storage);
    const wanted = this.output().toNumber() * dt;
    // Gedrosselt heisst: es waere mehr moeglich, als ins Lager passt. Gemeldet
    // wird nur die FLANKE - vorher hing die Meldung an "gar nichts geht mehr",
    // und das trat praktisch nie ein, weil jede Sekunde ein wenig abfliesst.
    const throttled = wanted > room + 1e-9;
    if (throttled && !this.storageStalled) this.emit({ type: 'storageFull', at: this.time });
    this.storageStalled = throttled;
    this.storage += Math.min(wanted, room); // volles Lager stoppt die Produktion

    // Ohne Statthalter verkauft NIEMAND von allein - der Spieler liefert jede
    // Ladung selbst aus (CLAUDE.md, erste 60 Sekunden). Das ist Tutorial und
    // Begruendung in einem: wer erst von Hand ausgeliefert hat, versteht, was
    // der Autopilot spaeter fuer ihn tut und warum er schlechter ist.
    let alloc: number[];
    if (this.hasAutopilot()) {
      const supplyRate = this.storage / dt;
      if (!this.cachedAlloc || this.reactSeconds === 0 || this.time % this.reactSeconds < dt) {
        this.cachedAlloc = this.policy(this.nodes, supplyRate);
      }
      alloc = this.cachedAlloc.slice();
    } else {
      // Eine Ladung fliesst ueber mehrere Sekunden ab: mehr als das Dreifache
      // seiner Nachfrage nimmt ein Gebiet pro Sekunde physisch nicht auf. Wer
      // alles in einen kleinen Markt kippt, drueckt dort den Preis - genau die
      // Lektion, um die es in der ersten Minute geht.
      alloc = this.nodes.map(node => {
        const queued = this.manualQueue[node.id] ?? 0;
        if (queued <= 0) return 0;
        if (!isSellable(node)) {
          this.manualQueue[node.id] = 0;  // gesperrt: Ladung zurueck ins Lager
          return 0;
        }
        const rate = Math.min(queued / dt, node.demand * BALANCE.market.maxIntakeMultiple);
        this.manualQueue[node.id] = queued - rate * dt;
        return rate;
      });
    }

    const { revenue, sold } = stepMarkets(
      this.nodes,
      alloc,
      dt,
      this.rng,
      n => this.emit({ type: 'marketLocked', nodeId: n.id, at: this.time }),
    );
    this.storage = Math.max(0, this.storage - sold);
    this.cash = this.cash.add(revenue);
    this.lifetime = this.lifetime.add(revenue);

    // Geglaetteter Ertrag pro Sekunde. Grundlage fuer "Zeit bis zum naechsten
    // Kauf" (Pflichtfeature laut CLAUDE.md) und fuer die Anzeige.
    const perSecond = dt > 0 ? revenue / dt : 0;
    const smoothing = Math.min(1, dt / 30);
    this.incomeRate = this.incomeRate * (1 - smoothing) + perSecond * smoothing;

    this.time += dt;

    // Das Ende ist VOLLSTAENDIGE SAETTIGUNG, nicht das Erreichen der letzten
    // Stufe (CLAUDE.md): erst wenn auch dort jeder beliefert ist, sind die
    // Stimmen zufrieden. Sonst waere der letzte Aufstieg der Abspann, und die
    // groesste Stufe des Spiels bliebe ungespielt.
    if (this.level >= maxLevel() && this.marketsSaturated()) {
      this.finished = true;
      this.emit({ type: 'finished', at: this.time });
    }
  }

  /** Wie lange dauert es beim aktuellen Ertrag, bis der Betrag da ist? */
  secondsUntil(cost: Num): number {
    const missing = cost.sub(this.cash);
    if (missing.lte(0)) return 0;
    if (this.incomeRate <= 0) return Infinity;
    return missing.div(this.incomeRate).toNumber();
  }

  /**
   * Abwesenheit nachrechnen. Es wird nur produziert und verkauft, NICHT gekauft -
   * Kaufentscheidungen bleiben beim Spieler. Ohne Statthalter passiert nichts,
   * denn dann verkauft niemand.
   */
  applyOffline(seconds: number, capped = false): void {
    if (!this.hasAutopilot() || seconds <= 0) return;
    const step = 5; // groeberer Schritt: 8 h laufen in Millisekunden durch
    for (let t = 0; t < seconds; t += step) this.tick(Math.min(step, seconds - t));
    this.emit({ type: 'offlineProgress', seconds, capped, at: this.time });
  }

  // --- Kaufaktionen -------------------------------------------------------

  canBuySite(tier: number): boolean {
    if (tier < 0 || tier >= this.unlockedTiers()) return false;
    if (siteArea(tier) > this.freeArea()) return false;
    return this.cash.gte(siteCost(tier, this.owned[tier] ?? 0));
  }

  buySite(tier: number): boolean {
    if (!this.canBuySite(tier)) return false;
    const before = this.owned[tier] ?? 0;
    this.cash = this.cash.sub(siteCost(tier, before));
    const count = before + 1;
    this.owned[tier] = count;
    this.emit({ type: 'siteBought', tier, count, at: this.time });
    if (nextMilestone(before) !== nextMilestone(count)) {
      this.emit({ type: 'milestoneReached', tier, threshold: count, at: this.time });
    }
    return true;
  }

  nextParcelCost(): Num {
    return parcelCost(this.parcels, this.parcelPool());
  }

  buyParcel(): boolean {
    return this.buyParcels(1) === 1;
  }

  /**
   * Mehrere Parzellen auf einmal. Ohne Sammelkauf haengt der Spieler minutenlang
   * am Landkauf fest: die Diagnose zeigte bis zu 53% einer Zoomstufe blockiert,
   * weil pro Tick nur eine Parzelle ging. Max-Buy steht ohnehin als
   * Pflichtfeature in CLAUDE.md.
   */
  buyParcels(count: number): number {
    const pool = this.parcelPool();
    let bought = 0;
    while (bought < count && this.parcels < pool) {
      const cost = parcelCost(this.parcels, pool);
      if (this.cash.lt(cost)) break;
      this.cash = this.cash.sub(cost);
      this.parcels++;
      bought++;
    }
    if (bought > 0 && this.parcels >= pool) this.emit({ type: 'landFull', at: this.time });
    return bought;
  }

  /** So viel Land, wie Bargeld und Vorrat hergeben. */
  buyMaxParcels(limit = 100_000): number {
    return this.buyParcels(limit);
  }

  /** Genug Land fuer eine bestimmte Flaeche - der uebliche Fall beim Bauen. */
  buyParcelsForArea(area: number): number {
    const missing = area - this.freeArea();
    if (missing <= 0) return 0;
    return this.buyParcels(Math.ceil(missing / BALANCE.land.parcelArea));
  }

  /**
   * Kosten fuer n weitere Einheiten einer Ortsart. Geometrische Reihe, deshalb
   * geschlossen loesbar - kein Schleifenaufwand fuer Max-Buy.
   */
  siteBulkCost(tier: number, count: number): Num {
    const owned = this.owned[tier] ?? 0;
    const growth = BALANCE.production.costGrowth;
    const factor = (Math.pow(growth, count) - 1) / (growth - 1);
    return siteCost(tier, owned).mul(factor);
  }

  /** Wie viele Einheiten dieser Art sind bezahlbar und passen auf die Flaeche? */
  affordableSites(tier: number): number {
    if (tier < 0 || tier >= this.unlockedTiers()) return 0;
    const area = siteArea(tier);
    const byArea = area > 0 ? Math.floor(this.freeArea() / area) : Number.MAX_SAFE_INTEGER;
    if (byArea <= 0) return 0;
    // Groesste Anzahl, deren Sammelkosten das Bargeld nicht ueberschreiten.
    let low = 0;
    let high = Math.min(byArea, 10_000);
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.cash.gte(this.siteBulkCost(tier, mid))) low = mid; else high = mid - 1;
    }
    return low;
  }

  /** Max-Buy fuer Herstellorte. */
  buySites(tier: number, count: number): number {
    let bought = 0;
    while (bought < count && this.buySite(tier)) bought++;
    return bought;
  }

  /** Parzellen, die fuer `count` Einheiten dieser Art noch fehlen. */
  parcelsNeededFor(tier: number, count = 1): number {
    const missing = siteArea(tier) * count - this.freeArea();
    if (missing <= 0) return 0;
    return Math.ceil(missing / BALANCE.land.parcelArea);
  }

  /** Was ein Kauf WIRKLICH kostet: die Orte plus das Land, das ihnen fehlt. */
  siteTotalCost(tier: number, count: number): Num {
    const parcels = this.parcelsNeededFor(tier, count);
    const land = parcelBulkCost(this.parcels, this.parcelPool(), parcels);
    return this.siteBulkCost(tier, count).add(land);
  }

  /**
   * Bauen und fehlendes Land gleich mitkaufen.
   *
   * Ohne das klickt der Spieler zwischen zwei Listen hin und her und rechnet
   * dabei Parzellen im Kopf aus - genau die Sorte Buchhaltung, die das
   * Leitprinzip verbietet. Gekauft wird nur, wenn das Geld fuer BEIDES reicht;
   * sonst stuende der Spieler mit Land und ohne Ort da.
   */
  buySiteWithLand(tier: number, count = 1): number {
    if (tier < 0 || tier >= this.unlockedTiers() || count <= 0) return 0;
    const parcels = this.parcelsNeededFor(tier, count);
    if (parcels > 0) {
      if (this.parcels + parcels > this.parcelPool()) return 0; // Land ist aus
      if (this.cash.lt(this.siteTotalCost(tier, count))) return 0;
      this.buyParcels(parcels);
    }
    return this.buySites(tier, count);
  }

  /**
   * Max-Buy inklusive Land. `affordableSites` rechnet nur mit der Flaeche, die
   * schon da ist - was frueh im Spiel fast immer 0 ergibt und den Knopf nutzlos
   * macht. Hier wird das noetige Land eingepreist.
   */
  affordableSitesWithLand(tier: number): number {
    if (tier < 0 || tier >= this.unlockedTiers()) return 0;
    const area = siteArea(tier);
    if (area > 0) {
      const free = this.freeArea() + (this.parcelPool() - this.parcels) * BALANCE.land.parcelArea;
      if (free < area) return 0;
    }
    let low = 0;
    let high = 10_000;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const parcels = this.parcelsNeededFor(tier, mid);
      const fits = this.parcels + parcels <= this.parcelPool();
      if (fits && this.cash.gte(this.siteTotalCost(tier, mid))) low = mid; else high = mid - 1;
    }
    return low;
  }

  /** Max-Buy fuer Herstellorte, Land eingerechnet. */
  buyMaxSites(tier: number): number {
    return this.buySiteWithLand(tier, this.affordableSitesWithLand(tier));
  }

  /** Kosten fuer die naechsten `count` Parzellen - fuer Anzeige und Max-Buy. */
  parcelBulkCost(count: number): Num {
    return parcelBulkCost(this.parcels, this.parcelPool(), count);
  }

  /** Wie viele Parzellen das Bargeld hergibt. */
  affordableParcels(): number {
    return parcelsForCash(this.cash, this.parcels, this.parcelPool());
  }

  storageCost(): Num {
    return D(BALANCE.storage.costBase)
      .mul(Math.pow(BALANCE.storage.costGrowth, this.storageLevel))
      .mul(Math.pow(BALANCE.production.costTierMult, Math.max(0, this.level - 1)));
  }

  buyStorage(): boolean {
    const cost = this.storageCost();
    if (this.cash.lt(cost)) return false;
    this.cash = this.cash.sub(cost);
    this.storageLevel++;
    return true;
  }

  /** Naechste Statthalter-Stufe, oder null wenn ausgebaut. */
  nextPilot(): { name: string; cost: Num } | null {
    const entry = BALANCE.pilots[this.pilotLevel];
    return entry ? { name: entry.name, cost: D(entry.cost) } : null;
  }

  buyPilot(): boolean {
    const next = this.nextPilot();
    if (!next || this.cash.lt(next.cost)) return false;
    this.cash = this.cash.sub(next.cost);
    this.pilotLevel++;
    this.refreshPolicy();
    this.emit({ type: 'pilotUpgraded', pilotLevel: this.pilotLevel, at: this.time });
    return true;
  }

  // --- Handverkauf --------------------------------------------------------

  /** Ware, die schon unterwegs ist und deshalb nicht doppelt vergeben wird. */
  private manualPending(): number {
    let sum = 0;
    for (const amount of this.manualQueue) sum += amount ?? 0;
    return sum;
  }

  /** Was ein Klick auf dieses Gebiet losschicken wuerde: das freie Lager. */
  deliverable(nodeId: number): number {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !isSellable(node)) return 0;
    return Math.max(0, this.storage - this.manualPending());
  }

  /**
   * Eine Ladung von Hand ausliefern - der einzige Verkaufsweg, solange kein
   * Statthalter angestellt ist.
   *
   * Ein Klick schickt das ganze Lager los, nicht eine abgezaehlte Portion.
   * Damit ist die Entscheidung WOHIN und WANN, nicht wie viel: ein kleiner
   * Markt nimmt die Ladung nur langsam ab und verliert dabei den Preis, ein
   * grosser schluckt sie. Das ist die Grundregel des Spiels, gelernt in der
   * ersten Minute und ohne ein Wort Erklaerung.
   */
  deliver(nodeId: number): number {
    const amount = this.deliverable(nodeId);
    if (amount <= 0) return 0;
    this.manualQueue[nodeId] = (this.manualQueue[nodeId] ?? 0) + amount;
    return amount;
  }

  /** Gebiet an- oder abschalten - der einzige aktive Handgriff im Spiel. */
  setNodeEnabled(nodeId: number, enabled: boolean): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.enabled = enabled;
    this.cachedAlloc = null;
  }

  levelUpCost(): Num {
    return D(levelUpCost(this.level));
  }

  canLevelUp(): boolean {
    return this.level < maxLevel() && this.cash.gte(this.levelUpCost());
  }

  levelUp(): boolean {
    if (!this.canLevelUp()) return false;
    this.cash = this.cash.sub(this.levelUpCost());
    this.level++;
    this.nodes = generateLevel(this.level, this.seed);
    this.cachedAlloc = null;
    this.manualQueue = [];
    this.emit({ type: 'levelUp', level: this.level, at: this.time });
    return true;
  }

  paybackSeconds(tier: number): number {
    const owned = this.owned[tier] ?? 0;
    const gain = siteOutput(tier)
      .mul(milestoneMultiplier(owned + 1))
      .mul(BALANCE.effectivePricePerWare);
    if (gain.lte(0)) return Infinity;
    return siteCost(tier, owned).div(gain).toNumber();
  }

  // --- Speichern und Laden ------------------------------------------------

  toSave(now = Date.now()): SaveV1 {
    return {
      v: SAVE_VERSION,
      savedAt: now,
      time: this.time,
      cash: this.cash.toString(),
      lifetime: this.lifetime.toString(),
      level: this.level,
      parcels: this.parcels,
      owned: [...this.owned],
      storage: this.storage,
      storageLevel: this.storageLevel,
      pilotLevel: this.pilotLevel,
      seed: this.seed,
      rngState: this.rng.getState(),
      nodes: this.nodes.map(n => ({
        p: n.p,
        h: n.h,
        lockedFor: n.lockedFor,
        priceMult: n.priceMult,
        enabled: n.enabled,
      })),
    };
  }

  save(storage: StorageAdapter, now = Date.now()): void {
    storage.save(JSON.stringify(this.toSave(now)));
  }

  /**
   * Stand laden. Die Knoten entstehen neu aus dem Seed, nur ihr veraenderlicher
   * Zustand kommt aus der Datei - das haelt Staende klein und ueberlebt
   * Aenderungen an der Weltgenerierung.
   */
  static fromSave(save: SaveV1, opts: SimOptions = {}): Sim {
    const sim = new Sim({ ...opts, seed: save.seed });
    sim.time = save.time;
    sim.cash = D(save.cash);
    sim.lifetime = D(save.lifetime);
    sim.level = save.level;
    sim.parcels = save.parcels;
    sim.owned = [...save.owned];
    sim.storage = save.storage;
    sim.storageLevel = save.storageLevel;
    sim.pilotLevel = save.pilotLevel;
    sim.rng.setState(save.rngState ?? save.seed);
    sim.nodes = generateLevel(save.level, save.seed);
    save.nodes.forEach((state, i) => {
      const node = sim.nodes[i];
      if (!node) return;
      node.p = state.p;
      node.h = state.h;
      node.lockedFor = state.lockedFor;
      node.priceMult = state.priceMult;
      node.enabled = state.enabled;
    });
    sim.finished = save.level >= maxLevel() && sim.marketsSaturated();
    sim.refreshPolicy();
    return sim;
  }

  /** Laden inklusive nachgerechneter Abwesenheit. */
  static load(storage: StorageAdapter, opts: SimOptions = {}, now = Date.now()): Sim | null {
    const raw = storage.load();
    if (!raw) return null;
    const save = migrate(JSON.parse(raw));
    const sim = Sim.fromSave(save, opts);
    const { seconds, capped } = offlineSeconds(save, now);
    sim.applyOffline(seconds, capped);
    return sim;
  }
}
