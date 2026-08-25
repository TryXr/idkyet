/**
 * Die Simulation. Fixer Timestep, deterministisch, kennt kein DOM.
 * Alles, was das Spiel ausmacht, passiert hier - die UI liest nur ab.
 */
import { BALANCE } from './balance.js';
import { D, type Num } from './numbers.js';
import { Rng } from './rng.js';
import { stepMarkets, type MarketNode } from './market.js';
import { generateLevel, levelCapacity, levelUpCost, maxLevel } from './world.js';
import {
  milestoneMultiplier, nextMilestone, siteArea, siteCost, siteCount,
  siteOutput, totalOutput, usedArea,
} from './production.js';
import { ownedArea, parcelCost, parcelPool } from './land.js';
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
  nodes: MarketNode[];
  finished = false;

  readonly events = new EventBus();
  private rng: Rng;
  private seed: number;
  private pilotOverride?: keyof typeof PILOT_TRAITS;
  private policy!: Policy;
  private reactSeconds = 0;
  private cachedAlloc: number[] | null = null;

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
    if (wanted > 0 && room <= 0) this.emit({ type: 'storageFull', at: this.time });
    this.storage += Math.min(wanted, room); // volles Lager stoppt die Produktion

    const supplyRate = this.storage / dt;
    if (!this.cachedAlloc || this.reactSeconds === 0 || this.time % this.reactSeconds < dt) {
      this.cachedAlloc = this.policy(this.nodes, supplyRate);
    }
    const { revenue, sold } = stepMarkets(
      this.nodes,
      this.cachedAlloc.slice(),
      dt,
      this.rng,
      n => this.emit({ type: 'marketLocked', nodeId: n.id, at: this.time }),
    );
    this.storage = Math.max(0, this.storage - sold);
    this.cash = this.cash.add(revenue);
    this.lifetime = this.lifetime.add(revenue);
    this.time += dt;
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
    const pool = this.parcelPool();
    if (this.parcels >= pool) return false;
    const cost = this.nextParcelCost();
    if (this.cash.lt(cost)) return false;
    this.cash = this.cash.sub(cost);
    this.parcels++;
    if (this.parcels >= pool) this.emit({ type: 'landFull', at: this.time });
    return true;
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
    this.emit({ type: 'levelUp', level: this.level, at: this.time });
    if (this.level >= maxLevel()) {
      this.finished = true;
      this.emit({ type: 'finished', at: this.time });
    }
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
    sim.finished = save.level >= maxLevel();
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
