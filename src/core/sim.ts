/**
 * Die Simulation. Fixer Timestep, deterministisch, kennt kein DOM.
 * Alles, was das Spiel ausmacht, passiert hier - die UI liest nur ab.
 */
import { BALANCE } from './balance.js';
import { D, type Num } from './numbers.js';
import { Rng } from './rng.js';
import { stepMarkets, type MarketNode } from './market.js';
import { generateLevel, levelCapacity, levelUpCost, maxLevel } from './world.js';
import { milestoneMultiplier, siteArea, siteCost, siteCount, siteOutput, totalOutput, usedArea } from './production.js';
import { ownedArea, parcelCost, parcelPool } from './land.js';
import { makePolicy, PILOT_TRAITS, type Policy } from './policy.js';

export type GameEvent =
  | { type: 'levelUp'; level: number; at: number }
  | { type: 'marketLocked'; nodeId: number; at: number }
  | { type: 'siteBought'; tier: number; count: number; at: number }
  | { type: 'landFull'; at: number }
  | { type: 'finished'; at: number };

export interface SimOptions {
  seed?: number;
  pilot?: keyof typeof PILOT_TRAITS;
  onEvent?: (e: GameEvent) => void;
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
  nodes: MarketNode[];
  finished = false;

  private rng: Rng;
  private seed: number;
  private policy: Policy;
  private reactSeconds: number;
  private cachedAlloc: number[] | null = null;
  private onEvent?: (e: GameEvent) => void;

  constructor(opts: SimOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rng = new Rng(this.seed);
    const traits = PILOT_TRAITS[opts.pilot ?? 'human']!;
    this.policy = makePolicy(traits);
    this.reactSeconds = traits.reactSeconds;
    this.onEvent = opts.onEvent;
    this.nodes = generateLevel(0, this.seed);
    this.owned[0] = 1;              // Startzustand: ein Badezimmer,
                                    // eine Parzelle (siehe CLAUDE.md, erste 60 s)
  }

  /** Ware/s, die aktuell produziert wird. */
  output(): Num { return totalOutput(this.owned); }

  /** Lagergroesse in Ware - skaliert mit der Produktion, daher skalenfrei. */
  storageCap(): number {
    const seconds = BALANCE.storage.bufferSeconds *
      Math.pow(BALANCE.storage.bufferPerLevel, this.storageLevel);
    return this.output().toNumber() * seconds;
  }

  freeArea(): number { return ownedArea(this.parcels) - usedArea(this.owned); }

  /** Ein Zeitschritt. */
  tick(dt = BALANCE.tickSeconds): void {
    if (this.finished) return;

    // 1. Produzieren. Volles Lager stoppt die Produktion (kein Verlust).
    const cap = this.storageCap();
    const produced = Math.min(this.output().toNumber() * dt, Math.max(0, cap - this.storage));
    this.storage += produced;

    // 2. Verteilen und verkaufen.
    const supplyRate = this.storage / dt;
    if (!this.cachedAlloc || this.reactSeconds === 0 || this.time % this.reactSeconds < dt) {
      this.cachedAlloc = this.policy(this.nodes, supplyRate);
    }
    const { revenue, sold } = stepMarkets(
      this.nodes, this.cachedAlloc.slice(), dt, this.rng,
      n => this.onEvent?.({ type: 'marketLocked', nodeId: n.id, at: this.time }),
    );
    this.storage = Math.max(0, this.storage - sold);
    this.cash = this.cash.add(revenue);
    this.lifetime = this.lifetime.add(revenue);

    this.time += dt;
  }

  // --- Kaufaktionen -------------------------------------------------------

  canBuySite(tier: number): boolean {
    if (tier >= siteCount() || tier > this.unlockedTiers() - 1) return false;
    if (siteArea(tier) > this.freeArea()) return false;
    return this.cash.gte(siteCost(tier, this.owned[tier] ?? 0));
  }

  buySite(tier: number): boolean {
    if (!this.canBuySite(tier)) return false;
    this.cash = this.cash.sub(siteCost(tier, this.owned[tier] ?? 0));
    this.owned[tier] = (this.owned[tier] ?? 0) + 1;
    this.onEvent?.({ type: 'siteBought', tier, count: this.owned[tier]!, at: this.time });
    return true;
  }

  /** Neue Ortsarten schalten sich mit der Zoomstufe frei, nicht ueber Bargeld -
   *  sonst blockiert sich der Spieler selbst, weil er staendig alles ausgibt. */
  unlockedTiers(): number { return Math.min(siteCount(), this.level + 2); }

  parcelPool(): number { return parcelPool(this.level); }
  nextParcelCost(): Num { return parcelCost(this.parcels, this.parcelPool()); }

  buyParcel(): boolean {
    const pool = this.parcelPool();
    if (this.parcels >= pool) return false;
    const cost = this.nextParcelCost();
    if (this.cash.lt(cost)) return false;
    this.cash = this.cash.sub(cost);
    this.parcels++;
    if (this.parcels >= pool) this.onEvent?.({ type: 'landFull', at: this.time });
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

  /** Verkaufbare Kapazitaet der aktuellen Stufe in Ware/s. */
  capacity(): number { return levelCapacity(this.level); }
  marketsSaturated(): boolean { return this.output().toNumber() >= this.capacity() * 0.95; }

  levelUpCost(): Num { return D(levelUpCost(this.level)); }

  canLevelUp(): boolean {
    return this.level < maxLevel() && this.cash.gte(this.levelUpCost());
  }

  levelUp(): boolean {
    if (!this.canLevelUp()) return false;
    this.cash = this.cash.sub(this.levelUpCost());
    this.level++;
    this.nodes = generateLevel(this.level, this.seed);
    this.cachedAlloc = null;
    this.onEvent?.({ type: 'levelUp', level: this.level, at: this.time });
    if (this.level >= maxLevel()) {
      this.finished = true;
      this.onEvent?.({ type: 'finished', at: this.time });
    }
    return true;
  }

  /** Amortisationszeit in Sekunden - Grundlage jeder Kaufentscheidung. */
  paybackSeconds(tier: number): number {
    const owned = this.owned[tier] ?? 0;
    const gain = siteOutput(tier).mul(milestoneMultiplier(owned + 1))
      .mul(BALANCE.effectivePricePerWare);
    if (gain.lte(0)) return Infinity;
    return siteCost(tier, owned).div(gain).toNumber();
  }
}
