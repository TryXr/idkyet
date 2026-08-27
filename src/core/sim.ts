/**
 * Die Simulation. Fixer Timestep, deterministisch, kennt kein DOM.
 * Alles, was das Spiel ausmacht, passiert hier - die UI liest nur ab.
 *
 * Der Ablauf eines Ticks ist die Kurzfassung des ganzen Spiels:
 *   1. Die Ketten wachsen (jede Stufe stellt die darunter ein).
 *   2. Pflanzen in Raeumen bringen Ernte, so gut die Gaertner sie pflegen und
 *      so weit die Stromrechnung bezahlt ist.
 *   3. Die Ernte teilt sich: ein Teil ins Lager, der Rest als Stecklinge
 *      zurueck. Das ist die zentrale Entscheidung des Spielers.
 *   4. Verkaeufer liefern aus dem Lager ins Zielgebiet, das bringt Bargeld
 *      und fuellt dort den Versorgungsbalken.
 *   5. Uebernommene Gebiete zahlen Rente, die Betriebskosten gehen ab.
 *   6. Sind alle Gebiete einer Ebene deins, zoomt die Karte heraus.
 */
import { BALANCE } from './balance.js';
import { D, fromStored, toStored, type Num } from './numbers.js';
import { Rng } from './rng.js';
import {
  effectiveUnits, growChain, milestoneMultiplier, nextMilestone, TIERS,
  unitCost, type ChainKey,
} from './chains.js';
import {
  bestQuality, bestTier, billedPotential, production, roomCost, roomCount, roomSeats,
} from './rooms.js';
import {
  applyStrain, boostedProduction, boostedSeats, noBonuses, salesFactor, seedFactor,
  upkeepFactor, yieldFactor, type Bonuses,
} from './strains.js';
import {
  allOwned, bestTarget, deliver, firstOpen, fraction, loseTo, missing, rentOf,
  rivalTargets, type Territory,
} from './territory.js';
import { generateLevel, levelDemand, levelName, levelPrice, maxLevel } from './world.js';
import { EventBus, type EventListener, type GameEvent } from './events.js';
import {
  migrate, offlineSeconds, SAVE_VERSION,
  type SaveV4, type StorageAdapter,
} from './save.js';

export interface SimOptions {
  seed?: number;
  /** Zielwahl erzwingen (nur fuer Messlaeufe): stur der Reihe nach statt klug. */
  dumbTargeting?: boolean;
  onEvent?: EventListener;
}

export class Sim {
  time = 0;
  cash: Num = D(0);
  lifetime: Num = D(0);
  level = 0;

  /** Stueckzahlen der beiden Ketten, Stufe 0 zuerst. */
  cook: number[] = new Array(TIERS).fill(0);
  sell: number[] = new Array(TIERS).fill(0);
  /** Raeume je Art. */
  rooms: number[] = new Array(roomCount()).fill(0);

  /** Ausgewachsene Pflanzen. Wachsen NUR aus der eigenen Ernte, nie aus Geld. */
  plants = 1;
  /** Stecklinge, die noch reifen. Der Vorlauf, den man einplanen muss. */
  seedlings = 0;
  /** Anteil der Ernte, der als Steckling zurueckgeht. Der Regler. */
  seedShare = BALANCE.plant.seedShare0;
  /** Wie viel der Betriebskosten zuletzt bezahlt werden konnte (0.2 bis 1). */
  powerShare = 1;

  storage = 0;
  storageLevel = 0;
  /** Renten aus bereits abgeschlossenen Ebenen. */
  pastRent = 0;
  /**
   * Die gesammelten Sorten. Kein eigener Zustand, sondern eine Ableitung aus
   * Seed und Besitz - deshalb steht davon auch nichts im Speicherstand.
   */
  bonuses: Bonuses = noBonuses();
  /** Geglaetteter Ertrag pro Sekunde, fuer Anzeige und Kaufprognosen. */
  incomeRate = 0;

  territories: Territory[];
  /** Vom Spieler gewaehltes Ziel. null heisst: automatisch. */
  targetId: number | null = null;
  finished = false;

  readonly events = new EventBus();
  private rng: Rng;
  private seed: number;
  private dumbTargeting: boolean;
  private storageStalled = false;

  constructor(opts: SimOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rng = new Rng(this.seed);
    this.dumbTargeting = opts.dumbTargeting ?? false;
    if (opts.onEvent) this.events.on(opts.onEvent);
    this.territories = generateLevel(0, this.seed);
    this.rooms[0] = 1;  // Start: ein Badezimmer, sonst nichts (CLAUDE.md)
  }

  private emit(event: GameEvent): void {
    this.events.emit(event);
  }

  /**
   * Das Sortenbeet neu zusammenzaehlen.
   *
   * Gerechnet statt gespeichert: abgeschlossene Ebenen gehoeren komplett dir,
   * also liefert der Seed ihre Sorten jederzeit wieder - genauso, wie die
   * Gebiete selbst beim Laden neu erzeugt werden. Das haelt den Speicherstand
   * klein und kann gar nicht auseinanderlaufen. Aufgerufen wird es nur bei
   * einer Uebernahme und beim Laden, also ein paar Dutzend Mal im Durchlauf.
   */
  private recomputeBonuses(): void {
    const bonuses = noBonuses();
    for (let level = 0; level < this.level; level++) {
      for (const t of generateLevel(level, this.seed)) applyStrain(bonuses, t.strain);
    }
    for (const t of this.territories) if (t.owned) applyStrain(bonuses, t.strain);
    this.bonuses = bonuses;
  }

  // --- Ableitungen ---------------------------------------------------------

  /** Gaertner, die wirklich pflegen (Meilensteine eingerechnet). */
  gardeners(): number {
    return effectiveUnits(this.cook);
  }

  /** Verkaeufer, die wirklich liefern. */
  sellers(): number {
    return effectiveUnits(this.sell);
  }

  /** Pflanzen, die einen Platz haben. Der Rest wartet. */
  activePlants(): number {
    return Math.min(this.plants, this.seats());
  }

  /**
   * Ernte je Sekunde bei voller Pflege: Pflanzen in ihren Raeumen, veredelt um
   * die gesammelten Sorten. Die eine Stelle, an der alle drei zusammenkommen -
   * alles andere im Spiel rechnet mit dieser Zahl weiter.
   */
  capacity(): number {
    return boostedProduction(this.activePlants(), this.rooms, this.bonuses);
  }

  /**
   * Pflege, 0 bis 1. Weiche Kurve statt hartem Minimum: ein Gaertner mehr
   * bringt IMMER etwas, nur immer weniger. Ein hartes min() waere wieder das
   * Thermostat aus TIEFE.md, Befund 1.2 - dann gaebe es nichts abzuwaegen.
   */
  care(): number {
    const need = this.capacity();
    if (need <= 0) return 1;
    const ratio = (this.gardeners() * BALANCE.care.perGardener) / need;
    return 1 - Math.exp(-ratio);
  }

  /** Ernte je Sekunde: Pflanzen mal Raumqualitaet mal Pflege mal Strom. */
  output(): number {
    return this.capacity() * this.care() * this.powerShare;
  }

  /**
   * Was der Betrieb kostet - je Sekunde, in Bargeld.
   *
   * Das erste Badezimmer ist FREI: es laeuft ueber den normalen Hausstrom, und
   * niemandem faellt es auf. Ohne diese Freigrenze begaenne das Spiel mit einer
   * offenen Rechnung - man hat in Sekunde eins kein Bargeld, kann also nicht
   * zahlen, und das Erste, was ein Neuling liest, waere eine Mahnung.
   */
  upkeepRate(): number {
    return billedPotential(this.rooms) * levelPrice(this.level) * BALANCE.upkeep.share
      * upkeepFactor(this.bonuses);
  }

  /** Ernte, die ein neuer Steckling kostet. Waechst mit der besten Raumstufe. */
  seedCost(): number {
    return BALANCE.plant.seedCost0
      * Math.pow(BALANCE.plant.seedCostMult, bestTier(this.rooms))
      * seedFactor(this.bonuses);
  }

  /** Ernte je Sekunde, die abgesetzt werden koennte. */
  sellRate(): number {
    return this.sellers() * BALANCE.sell.sellRate * salesFactor(this.bonuses);
  }

  seats(): number {
    return boostedSeats(this.rooms, this.bonuses);
  }

  /** Pflanzen ohne Platz - das Signal fuer den naechsten Raum. */
  idle(): number {
    return Math.max(0, this.plants - this.seats());
  }

  /**
   * GUETE der Ernte, 0 bis 1: wie nah die Pflanzen im Schnitt am besten Raum
   * stehen, den du hast. Voll ist sie nur, wenn keine Pflanze mehr im
   * Badezimmer steht.
   *
   * Die Zahl gab es vorher schon - sie steckte unsichtbar im Ertrag. Genau das
   * ist der Unterschied zu Dr. Meth, wo die Reinheit angezeigt und in den Preis
   * gerechnet wird (TIEFE.md, 2a). Eine unsichtbare Zahl kann sich nicht gut
   * anfuehlen.
   */
  grade(): number {
    const active = this.activePlants();
    if (active <= 0) return 1;
    return production(active, this.rooms) / active / bestQuality(this.rooms);
  }

  /** Freie Plaetze, die trotzdem Strom kosten. */
  emptySeats(): number {
    return Math.max(0, this.seats() - this.plants);
  }

  /**
   * Wie dringend Verkaeufer gebraucht werden, 0 bis 1: liegt Ernte im Lager,
   * die niemand abholt? Voll, wenn der Absatz hinter der Ernte zurueckbleibt.
   */
  sellNeed(): number {
    const out = this.capacity() * this.care();
    if (out <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - this.sellRate() / out));
  }

  storageCap(): number {
    // Gerechnet wird mit VOLLER Pflege, nicht mit dem aktuellen Ertrag: sonst
    // schrumpfte das Lager genau dann, wenn die Pflege einbricht - und der
    // Spieler verlaere Ware, weil er knapp bei Kasse ist.
    const full = this.capacity();
    return Math.max(full, this.handHarvest()) * BALANCE.storage.bufferSeconds *
      Math.pow(BALANCE.storage.bufferPerLevel, this.storageLevel);
  }

  /** Pflanzen, die der Spieler von Hand abernten kann - mindestens die erste. */
  private handPlants(): number {
    return Math.max(1, this.activePlants());
  }

  /** Was ein Klick auf "Ernten" bringt. Die UI zeigt dieselbe Zahl an. */
  handHarvest(): number {
    return BALANCE.manual.cookPortion * bestQuality(this.rooms) * this.handPlants()
      * yieldFactor(this.bonuses);
  }

  /** Rente aller uebernommenen Gebiete, auch der frueheren Ebenen. */
  rentPerSecond(): number {
    return this.pastRent + rentOf(this.territories);
  }

  /** Anteil der Ebene, der schon dir gehoert. */
  levelProgress(): number {
    if (this.territories.length === 0) return 1;
    return this.territories.filter(t => t.owned).length / this.territories.length;
  }

  /** Das Gebiet, in das gerade geliefert wird. */
  target(): Territory | null {
    if (this.targetId !== null) {
      const chosen = this.territories.find(t => t.id === this.targetId);
      if (chosen && !chosen.owned) return chosen;
      this.targetId = null;
    }
    // Der Autopilot nimmt stur das naechstbeste, ein aufmerksamer Spieler das
    // lohnendste. Genau darin liegt der Wert aktiven Spiels (CLAUDE.md).
    return this.dumbTargeting ? firstOpen(this.territories) : bestTarget(this.territories);
  }

  setTarget(id: number | null): void {
    this.targetId = id;
  }

  // --- Tick ---------------------------------------------------------------

  tick(dt = BALANCE.tickSeconds): void {
    if (this.finished) return;

    // Eingestellt wird nach BEDARF, nicht nach Uhrzeit: Gaertner, solange die
    // Pflege nicht reicht, Dealer, solange Ernte liegen bleibt. Beides steigt
    // wieder, sobald ein neuer Raum dazukommt - deshalb bleibt die Bedienung
    // bis zum Schluss lebendig.
    growChain(this.cook, dt, 1 - this.care());
    growChain(this.sell, dt, this.sellNeed());

    // Erst die Stromrechnung: was nicht bezahlt ist, druckt die Pflege - aber
    // nie unter den Boden, damit es keine Todesspirale gibt. Gerechnet wird mit
    // dem Bargeld vom Anfang des Ticks, damit der Ablauf deterministisch bleibt
    // und der Offline-Nachlauf mit groeberen Schritten dasselbe ergibt.
    const due = this.upkeepRate() * dt;
    this.powerShare = due <= 0 ? 1
      : Math.min(1, Math.max(BALANCE.care.floor, this.cash.toNumber() / due));

    // Ernte. Sie teilt sich nach dem Regler: Lager oder Stecklinge.
    const harvest = this.output() * dt;
    const back = harvest * this.seedShare;
    const keep = harvest - back;

    // Volles Lager stoppt den verkaeuflichen Teil - kein Verlust, nur Stillstand.
    const room = Math.max(0, this.storageCap() - this.storage);
    const throttled = keep > room + 1e-9;
    if (throttled && !this.storageStalled) this.emit({ type: 'storageFull', at: this.time });
    this.storageStalled = throttled;
    this.storage += Math.min(keep, room);

    this.growPlants(back, dt);

    // Verkauf ins Zielgebiet.
    const revenue = this.deliverFromStorage(this.sellRate() * dt);

    this.rivalDelivers(dt);

    // Renten laufen immer mit, die Betriebskosten gehen ab.
    const rent = this.rentPerSecond() * dt;
    const income = revenue + rent;
    const paid = due * this.powerShare;
    this.cash = this.cash.add(income).sub(paid).max(0);
    this.lifetime = this.lifetime.add(income);

    // Angezeigt und fuer Kaufprognosen benutzt wird der NETTO-Ertrag. Eine
    // Wartezeit, die die Stromrechnung unterschlaegt, waere gelogen.
    const perSecond = dt > 0 ? (income - paid) / dt : 0;
    const smoothing = Math.min(1, dt / 30);
    this.incomeRate = this.incomeRate * (1 - smoothing) + perSecond * smoothing;

    this.time += dt;
    this.checkLevelUp();
  }

  /**
   * Zurueckgelegte Ernte wird zu Stecklingen, und Stecklinge reifen mit
   * Verzoegerung zu Pflanzen. Der Vorlauf ist Absicht: wer erst saet, wenn der
   * neue Raum schon steht, hat ihn zu spaet voll. Dadurch ist der Regler eine
   * Entscheidung mit Voraussicht und kein Schalter.
   */
  private growPlants(harvestBack: number, dt: number): void {
    if (harvestBack > 0) this.seedlings += harvestBack / this.seedCost();
    if (this.seedlings <= 0) return;
    const matured = this.seedlings * Math.min(1, dt / BALANCE.plant.growSeconds);
    this.seedlings -= matured;
    this.plants += matured;
  }

  /**
   * Ware aus dem Lager ins Ziel liefern. Ist das Ziel damit voll, laeuft der
   * Rest ins naechste - so bleibt nichts liegen, nur weil eine Lieferung
   * gerade ueber die Ziellinie ging.
   */
  private deliverFromStorage(amount: number): number {
    let left = Math.min(this.storage, amount);
    let revenue = 0;
    for (let guard = 0; guard < BALANCE.levels.perLevel + 1 && left > 1e-12; guard++) {
      const target = this.target();
      if (!target) break;
      const result = deliver(target, left);
      if (result.sold <= 0) break;
      left -= result.sold;
      revenue += result.revenue;
      this.storage -= result.sold;
      if (result.taken) {
        this.recomputeBonuses();
        this.emit({
          type: 'territoryTaken', level: this.level, id: target.id,
          name: target.name, rent: target.rent, at: this.time,
        });
        if (this.targetId === target.id) this.targetId = null;
      }
    }
    return revenue;
  }

  /** Woran die Konkurrenz gerade arbeitet. Leer heisst: sie ist noch nicht da. */
  rivalTargets(): Territory[] {
    if (this.level < BALANCE.rival.startLevel) return [];
    return rivalTargets(this.territories, this.target()?.id ?? null, BALANCE.rival.spread);
  }

  /** Ware je Sekunde, die die Konkurrenz absetzt. */
  rivalRate(): number {
    if (this.level < BALANCE.rival.startLevel) return 0;
    return Math.min(this.output(), this.sellRate()) * BALANCE.rival.share;
  }

  /**
   * Die Konkurrenz liefert. Sie nimmt sich immer das lohnendste Gebiet, das du
   * gerade NICHT belieferst - wer die guten zuerst holt, laesst ihr nur die
   * undankbaren. Genau daran haengt der Wert aufmerksamen Spiels.
   */
  private rivalDelivers(dt: number): void {
    const rate = this.rivalRate();
    if (rate <= 0) return;
    const targets = this.rivalTargets();
    if (targets.length === 0) return;
    // Auf mehrere Gebiete VERTEILT. Arbeitete sie nur an einem, koennte der
    // Spieler sie mit einem einzigen Ziel dauerhaft blockieren - gemessen
    // verlor ein aufmerksamer Spieler dann kein einziges Gebiet, und der
    // Gegendruck war keiner.
    const each = (rate * dt) / targets.length;
    for (const target of targets) {
      target.rival += each;
      if (target.rival < target.demand) continue;
      loseTo(target, BALANCE.rival.penalty);
      this.emit({
        type: 'territoryLost', level: this.level, id: target.id,
        name: target.name, at: this.time,
      });
    }
  }

  private checkLevelUp(): void {
    if (!allOwned(this.territories)) return;
    if (this.level >= maxLevel()) {
      this.finished = true;
      this.emit({ type: 'finished', at: this.time });
      return;
    }
    // Die Renten der abgeschlossenen Ebene laufen weiter - was dir gehoert,
    // bleibt dir, auch wenn die Karte herauszoomt.
    this.pastRent += rentOf(this.territories);
    this.level++;
    this.territories = generateLevel(this.level, this.seed);
    this.recomputeBonuses();
    this.targetId = null;
    this.emit({ type: 'levelUp', level: this.level, at: this.time });
  }

  /**
   * Ertrag, mit dem Kaufprognosen rechnen: was hereinkaeme, wenn die ganze
   * Ernte verkauft wuerde.
   *
   * Warum nicht der tatsaechliche Ertrag: wer viel zurueklegt, verdient gerade
   * fast nichts - dann stuende an JEDEM Kauf "kein Ertrag", und das Spiel saehe
   * aus wie eine Sackgasse, obwohl es in genau diesem Moment am schnellsten
   * waechst. Die Prognose beantwortet deshalb die Frage, die der Spieler
   * wirklich hat: "wie lange, wenn ich jetzt verkaufe?"
   */
  projectedRate(): number {
    const sold = Math.min(this.output(), this.sellRate());
    return sold * levelPrice(this.level) + this.rentPerSecond()
      - this.upkeepRate() * this.powerShare;
  }

  /** Wie lange dauert es beim aktuellen Ertrag, bis der Betrag da ist? */
  secondsUntil(cost: Num): number {
    const missingCash = cost.sub(this.cash);
    if (missingCash.lte(0)) return 0;
    const rate = Math.max(this.incomeRate, this.projectedRate());
    if (rate <= 0) return Infinity;
    return missingCash.div(rate).toNumber();
  }

  /**
   * Abwesenheit nachrechnen. Es wird nur produziert und verkauft, NICHT gekauft -
   * Kaufentscheidungen bleiben beim Spieler. Ohne Arbeiter oder ohne Verkaeufer
   * passiert entsprechend wenig; die Renten laufen aber immer.
   */
  applyOffline(seconds: number, capped = false): void {
    if (seconds <= 0) return;
    const step = 5; // groeberer Schritt: 8 h laufen in Millisekunden durch
    for (let t = 0; t < seconds && !this.finished; t += step) {
      this.tick(Math.min(step, seconds - t));
    }
    this.emit({ type: 'offlineProgress', seconds, capped, at: this.time });
  }

  // --- Handbetrieb ---------------------------------------------------------

  /**
   * Von Hand ernten. Der erste Knopf des Spiels - und er wird mit jeder
   * Pflanze besser. Das ist der Grund, warum der Spieler das Zuruecklegen
   * schon in der ersten Minute versteht: die zweite Pflanze verdoppelt das,
   * was ein Klick bringt, ganz ohne Erklaerung.
   */
  cookByHand(): number {
    const amount = this.handHarvest();
    const back = amount * this.seedShare;
    const keep = amount - back;
    const room = Math.max(0, this.storageCap() - this.storage);
    const stored = Math.min(keep, room);
    this.storage += stored;
    this.growPlants(back, 0);
    return stored + back;
  }

  /** Der Regler: Anteil der Ernte, der als Steckling zurueckgeht. */
  setSeedShare(value: number): void {
    this.seedShare = Math.min(1, Math.max(0, value));
  }

  /** Eine Portion von Hand verkaufen. Der zweite Knopf. */
  sellByHand(): number {
    const portion = BALANCE.manual.sellPortion * BALANCE.sell.sellRate;
    const before = this.storage;
    const revenue = this.deliverFromStorage(portion);
    this.cash = this.cash.add(revenue);
    this.lifetime = this.lifetime.add(revenue);
    return before - this.storage;
  }

  // --- Kaufaktionen -------------------------------------------------------

  private units(chain: ChainKey): number[] {
    return chain === 'cook' ? this.cook : this.sell;
  }

  unitCost(chain: ChainKey, tier: number): Num {
    return unitCost(chain, tier, Math.floor(this.units(chain)[tier] ?? 0));
  }

  /** Sammelpreis fuer n weitere Einheiten - geometrische Reihe, geschlossen. */
  unitBulkCost(chain: ChainKey, tier: number, count: number): Num {
    if (count <= 0) return D(0);
    const growth = BALANCE.chain.costGrowth;
    const factor = (Math.pow(growth, count) - 1) / (growth - 1);
    return this.unitCost(chain, tier).mul(factor);
  }

  canBuyUnit(chain: ChainKey, tier: number): boolean {
    if (tier < 0 || tier >= TIERS) return false;
    return this.cash.gte(this.unitCost(chain, tier));
  }

  buyUnit(chain: ChainKey, tier: number): boolean {
    if (!this.canBuyUnit(chain, tier)) return false;
    const list = this.units(chain);
    const before = Math.floor(list[tier] ?? 0);
    this.cash = this.cash.sub(this.unitCost(chain, tier));
    list[tier] = (list[tier] ?? 0) + 1;
    const after = Math.floor(list[tier]);
    this.emit({ type: 'unitBought', chain, tier, count: after, at: this.time });
    if (nextMilestone(before) !== nextMilestone(after)) {
      this.emit({ type: 'milestoneReached', chain, tier, threshold: after, at: this.time });
    }
    return true;
  }

  buyUnits(chain: ChainKey, tier: number, count: number): number {
    let bought = 0;
    while (bought < count && this.buyUnit(chain, tier)) bought++;
    return bought;
  }

  /** Groesste Anzahl, die das Bargeld hergibt. */
  affordableUnits(chain: ChainKey, tier: number): number {
    if (tier < 0 || tier >= TIERS) return 0;
    let low = 0;
    let high = 5_000;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.cash.gte(this.unitBulkCost(chain, tier, mid))) low = mid; else high = mid - 1;
    }
    return low;
  }

  roomCost(tier: number): Num {
    return roomCost(tier, this.rooms[tier] ?? 0);
  }

  roomBulkCost(tier: number, count: number): Num {
    if (count <= 0) return D(0);
    const growth = BALANCE.rooms.costGrowth;
    const factor = (Math.pow(growth, count) - 1) / (growth - 1);
    return this.roomCost(tier).mul(factor);
  }

  canBuyRoom(tier: number): boolean {
    if (tier < 0 || tier >= roomCount()) return false;
    return this.cash.gte(this.roomCost(tier));
  }

  buyRoom(tier: number): boolean {
    if (!this.canBuyRoom(tier)) return false;
    this.cash = this.cash.sub(this.roomCost(tier));
    this.rooms[tier] = (this.rooms[tier] ?? 0) + 1;
    this.emit({ type: 'roomBought', tier, count: this.rooms[tier]!, at: this.time });
    return true;
  }

  buyRooms(tier: number, count: number): number {
    let bought = 0;
    while (bought < count && this.buyRoom(tier)) bought++;
    return bought;
  }

  affordableRooms(tier: number): number {
    if (tier < 0 || tier >= roomCount()) return 0;
    let low = 0;
    let high = 5_000;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.cash.gte(this.roomBulkCost(tier, mid))) low = mid; else high = mid - 1;
    }
    return low;
  }

  storageCost(): Num {
    return D(BALANCE.storage.costBase)
      .mul(Math.pow(BALANCE.storage.costGrowth, this.storageLevel))
      .mul(Math.pow(BALANCE.levels.priceMult, this.level));
  }

  buyStorage(): boolean {
    const cost = this.storageCost();
    if (this.cash.lt(cost)) return false;
    this.cash = this.cash.sub(cost);
    this.storageLevel++;
    return true;
  }

  /** Freigeschaltete Raeume: immer der naechste als Ausblick. */
  unlockedRooms(): number {
    let highest = 0;
    for (let tier = 0; tier < roomCount(); tier++) if ((this.rooms[tier] ?? 0) > 0) highest = tier;
    return Math.min(roomCount(), Math.max(2, highest + 2));
  }

  /** Freigeschaltete Kettenstufen: die naechste zeigt sich, wenn die davor steht. */
  unlockedTiers(chain: ChainKey): number {
    const list = this.units(chain);
    let unlocked = 1;
    for (let tier = 0; tier < TIERS - 1; tier++) {
      if ((list[tier] ?? 0) >= 1) unlocked = tier + 2;
    }
    return Math.min(TIERS, unlocked);
  }

  // --- Speichern und Laden ------------------------------------------------

  toSave(now = Date.now()): SaveV4 {
    return {
      v: SAVE_VERSION,
      savedAt: now,
      time: this.time,
      cash: toStored(this.cash),
      lifetime: toStored(this.lifetime),
      level: this.level,
      cook: [...this.cook],
      sell: [...this.sell],
      rooms: [...this.rooms],
      plants: this.plants,
      seedlings: this.seedlings,
      seedShare: this.seedShare,
      storage: this.storage,
      storageLevel: this.storageLevel,
      pastRent: this.pastRent,
      targetId: this.targetId,
      seed: this.seed,
      rngState: this.rng.getState(),
      supplied: this.territories.map(t => t.supplied),
      rival: this.territories.map(t => t.rival),
      lost: this.territories.map(t => t.lost),
    };
  }

  save(storage: StorageAdapter, now = Date.now()): void {
    storage.save(JSON.stringify(this.toSave(now)));
  }

  /**
   * Stand laden. Die Gebiete entstehen neu aus dem Seed, nur der
   * Versorgungsstand kommt aus der Datei - das haelt Staende klein und
   * ueberlebt Aenderungen an der Weltgenerierung.
   */
  static fromSave(save: SaveV4, opts: SimOptions = {}): Sim {
    const sim = new Sim({ ...opts, seed: save.seed });
    sim.time = save.time;
    sim.cash = fromStored(save.cash);
    sim.lifetime = fromStored(save.lifetime);
    sim.level = save.level;
    sim.cook = [...save.cook];
    sim.sell = [...save.sell];
    sim.rooms = [...save.rooms];
    sim.plants = save.plants;
    sim.seedlings = save.seedlings;
    sim.seedShare = save.seedShare;
    sim.storage = save.storage;
    sim.storageLevel = save.storageLevel;
    sim.pastRent = save.pastRent;
    sim.targetId = save.targetId;
    sim.rng.setState(save.rngState ?? save.seed);
    sim.territories = generateLevel(save.level, save.seed);
    save.supplied.forEach((supplied, i) => {
      const t = sim.territories[i];
      if (!t) return;
      // Der Aufschlag verlorener Gebiete wird nachgerechnet, nicht gespeichert:
      // die Gebiete selbst kommen weiter aus dem Seed, im Stand liegt nur, was
      // passiert ist.
      if (save.lost[i]) { t.lost = true; t.demand *= BALANCE.rival.penalty; }
      t.rival = save.rival[i] ?? 0;
      t.supplied = supplied;
      t.owned = supplied >= t.demand - 1e-9;
    });
    sim.recomputeBonuses();
    sim.finished = save.level >= maxLevel() && allOwned(sim.territories);
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

/** Erneut ausgefuehrte Hilfen, die die UI ebenfalls braucht. */
export {
  fraction, missing, levelName, levelDemand, levelPrice, maxLevel,
  milestoneMultiplier, nextMilestone, roomSeats,
};
