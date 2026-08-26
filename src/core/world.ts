/**
 * Knotenbaum, prozedural aus einem Seed. Selbstaehnlich: eine Strassenecke und
 * ein Sonnensystem laufen durch denselben Code, nur die Zahlen und das Label
 * unterscheiden sich.
 *
 * Die Knoten einer Stufe werden so erzeugt, dass ihre Gesamtkapazitaet exakt
 * der geplanten Stufenkapazitaet aus BALANCING.md entspricht. Dadurch stimmt
 * das Detailmodell mit dem gerechneten Zeitplan ueberein.
 */
import { BALANCE, LEVELS } from './balance.js';
import { CONFIG } from './config.js';
import { createNode, OPTIMAL_UTILISATION, PRICE_AT_OPTIMUM, type MarketNode } from './market.js';
import { Rng } from './rng.js';

/** Profitabel verkaufbare Ware/s auf einer Stufe. */
export const levelCapacity = (level: number): number =>
  BALANCE.levels.cap0 * Math.pow(BALANCE.levels.capMult, level);

/**
 * Wie viele Sekunden Umsatz der Aufstieg von dieser Stufe kostet.
 * Steigt von einer sehr kurzen ersten Stufe bis zum Deckel - siehe balance.ts.
 */
export const upgradeSeconds = (level: number): number => Math.min(
  BALANCE.levels.upgradeSeconds,
  BALANCE.levels.upgradeSeconds0 * Math.pow(BALANCE.levels.upgradeRamp, level),
);

/** Kosten, um die naechste Stufe zu erschliessen. */
export const levelUpCost = (level: number): number =>
  levelCapacity(level) * BALANCE.effectivePricePerWare * upgradeSeconds(level);

export const levelName = (level: number): string =>
  LEVELS[Math.min(level, LEVELS.length - 1)] ?? `Stufe ${level}`;

/** Hoechste erreichbare Stufe. Im Demo-Build endet das Spiel frueher. */
export const maxLevel = (): number => Math.min(CONFIG.maxLevel, LEVELS.length - 1);

/**
 * Die Knoten einer Stufe erzeugen.
 * Normalisierung: Summe(demand * u*) = Stufenkapazitaet, und der mittlere
 * effektive Erloes bei optimaler Auslastung trifft effectivePricePerWare.
 */
export function generateLevel(level: number, seed: number): MarketNode[] {
  const rng = new Rng(seed * 7919 + level * 104729 + 1);
  const count = BALANCE.spread.nodesPerLevel;

  const rawDemand = Array.from({ length: count }, () => rng.logNormal(BALANCE.spread.demandSigma));
  const rawPrice = Array.from({ length: count }, () => rng.logNormal(BALANCE.spread.priceSigma));

  const demandSum = rawDemand.reduce((a, b) => a + b, 0);
  const demandScale = levelCapacity(level) / (OPTIMAL_UTILISATION * demandSum);

  const priceMean = rawPrice.reduce((a, b) => a + b, 0) / count;
  const priceScale = BALANCE.effectivePricePerWare / (PRICE_AT_OPTIMUM * priceMean);

  return rawDemand.map((d, i) =>
    createNode(i, d * demandScale, (rawPrice[i] ?? 1) * priceScale));
}
