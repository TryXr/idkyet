/**
 * Die Simulation. Fixer Timestep, deterministisch, kennt kein DOM.
 * Alles, was das Spiel ausmacht, passiert hier - die UI liest nur ab.
 *
 * Der Ablauf eines Ticks ist die Kurzfassung des ganzen Spiels:
 *   1. Die Ketten wachsen (jede Stufe stellt die darunter ein).
 *   2. Arbeiter in Raeumen machen Ware, das Lager fuellt sich.
 *   3. Verkaeufer liefern ins Zielgebiet, das bringt Bargeld und fuellt dort
 *      den Versorgungsbalken.
 *   4. Uebernommene Gebiete zahlen Rente.
 *   5. Sind alle Gebiete einer Ebene deins, zoomt die Karte heraus.
 */
import { BALANCE } from './balance.js';
import { D, type Num } from './numbers.js';
import { Rng } from './rng.js';
import {
  effectiveUnits, growChain, milestoneMultiplier, nextMilestone, TIERS,
  unitCost, type ChainKey,
} from './chains.js';
import {
  bestQuality, idleWorkers, production, roomCost, roomCount, roomSeats, totalSeats,
} from './rooms.js';
import {
  allOwned, bestTarget, deliver, firstOpen, fraction, missing, rentOf, type Territory,
} from './territory.js';
import { generateLevel, levelDemand, levelName, levelPrice, maxLevel } from './world.js';
import { EventBus, type EventListener, type GameEvent } from './events.js';
import {
  migrate, offlineSeconds, SAVE_VERSION,
  type SaveV2, type StorageAdapter,
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

  storage = 0;
  storageLevel = 0;
  /** Renten aus bereits abgeschlossenen Ebenen. */
  pastRent = 0;
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

  // --- Ableitungen ---------------------------------------------------------

  /** Arbeiter, die wirklich kochen (Meilensteine eingerechnet). */
  workers(): number {
    return effectiveUnits(this.cook);
  }

  /** Verkaeufer, die wirklich liefern. */
  sellers(): number {
    return effectiveUnits(this.sell);
  }

  /** Ware je Sekunde. */
  output(): number {
    return production(this.workers(), this.rooms);
  }

  /** Ware je Sekunde, die abgesetzt werden koennte. */
  sellRate(): number {
    return this.sellers() * BALANCE.sell.sellRate;
  }

  seats(): number {
    return totalSeats(this.rooms);
  }

  idle(): number {
    return idleWorkers(this.workers(), this.rooms);
  }

  storageCap(): number {
    // Der Handbetrieb braucht auch dann Platz, wenn noch kein Arbeiter da ist -
    // sonst waere der allererste Klick wirkungslos.
    const perSecond = Math.max(this.output(), BALANCE.manual.cookPortion * bestQuality(this.rooms));
    return perSecond * BALANCE.storage.bufferSeconds *
      Math.pow(BALANCE.storage.bufferPerLevel, this.storageLevel);
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

    growChain(this.cook, dt);
    growChain(this.sell, dt);

    // Produktion. Volles Lager stoppt sie - kein Verlust, nur Stillstand.
    const room = Math.max(0, this.storageCap() - this.storage);
    const wanted = this.output() * dt;
    const throttled = wanted > room + 1e-9;
    if (throttled && !this.storageStalled) this.emit({ type: 'storageFull', at: this.time });
    this.storageStalled = throttled;
    this.storage += Math.min(wanted, room);

    // Verkauf ins Zielgebiet.
    const revenue = this.deliverFromStorage(this.sellRate() * dt);

    // Renten laufen immer mit.
    const rent = this.rentPerSecond() * dt;
    const income = revenue + rent;
    this.cash = this.cash.add(income);
    this.lifetime = this.lifetime.add(income);

    const perSecond = dt > 0 ? income / dt : 0;
    const smoothing = Math.min(1, dt / 30);
    this.incomeRate = this.incomeRate * (1 - smoothing) + perSecond * smoothing;

    this.time += dt;
    this.checkLevelUp();
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
        this.emit({
          type: 'territoryTaken', level: this.level, id: target.id,
          name: target.name, rent: target.rent, at: this.time,
        });
        if (this.targetId === target.id) this.targetId = null;
      }
    }
    return revenue;
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
    this.targetId = null;
    this.emit({ type: 'levelUp', level: this.level, at: this.time });
  }

  /** Wie lange dauert es beim aktuellen Ertrag, bis der Betrag da ist? */
  secondsUntil(cost: Num): number {
    const missingCash = cost.sub(this.cash);
    if (missingCash.lte(0)) return 0;
    if (this.incomeRate <= 0) return Infinity;
    return missingCash.div(this.incomeRate).toNumber();
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

  /** Eine Portion von Hand kochen. Der erste Knopf des Spiels. */
  cookByHand(): number {
    const amount = BALANCE.manual.cookPortion * bestQuality(this.rooms);
    const room = Math.max(0, this.storageCap() - this.storage);
    const made = Math.min(amount, room);
    this.storage += made;
    return made;
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

  toSave(now = Date.now()): SaveV2 {
    return {
      v: SAVE_VERSION,
      savedAt: now,
      time: this.time,
      cash: this.cash.toString(),
      lifetime: this.lifetime.toString(),
      level: this.level,
      cook: [...this.cook],
      sell: [...this.sell],
      rooms: [...this.rooms],
      storage: this.storage,
      storageLevel: this.storageLevel,
      pastRent: this.pastRent,
      targetId: this.targetId,
      seed: this.seed,
      rngState: this.rng.getState(),
      supplied: this.territories.map(t => t.supplied),
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
  static fromSave(save: SaveV2, opts: SimOptions = {}): Sim {
    const sim = new Sim({ ...opts, seed: save.seed });
    sim.time = save.time;
    sim.cash = D(save.cash);
    sim.lifetime = D(save.lifetime);
    sim.level = save.level;
    sim.cook = [...save.cook];
    sim.sell = [...save.sell];
    sim.rooms = [...save.rooms];
    sim.storage = save.storage;
    sim.storageLevel = save.storageLevel;
    sim.pastRent = save.pastRent;
    sim.targetId = save.targetId;
    sim.rng.setState(save.rngState ?? save.seed);
    sim.territories = generateLevel(save.level, save.seed);
    save.supplied.forEach((supplied, i) => {
      const t = sim.territories[i];
      if (!t) return;
      t.supplied = supplied;
      t.owned = supplied >= t.demand - 1e-9;
    });
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
