/** Herstellorte: Kosten wachsen exponentiell, Ausstoss linear in der Anzahl. */
import { BALANCE, SITES } from './balance.js';
import { D, type Num } from './numbers.js';

const P = BALANCE.production;

export const siteCount = (): number => SITES.length;
export const siteName = (tier: number): string => SITES[tier]?.name ?? `Ort ${tier}`;
export const siteArea = (tier: number): number => SITES[tier]?.area ?? 0;
export const siteCostMult = (tier: number): number => SITES[tier]?.costMult ?? 1;

/** Kosten der naechsten Einheit dieser Art. */
export const siteCost = (tier: number, owned: number): Num =>
  D(P.costBase).mul(Math.pow(P.costTierMult, tier)).mul(siteCostMult(tier))
    .mul(Math.pow(P.costGrowth, owned));

/** Grundausstoss einer Einheit dieser Art in Ware/s. */
export const siteOutput = (tier: number): Num =>
  D(P.outputBase).mul(Math.pow(P.outputTierMult, tier));

/** Meilenstein-Multiplikator: x2 bei 25, 50, 100, 200 Stueck derselben Art.
 *  Erzeugt Schuebe schneller Kaeufe statt gleichmaessiger Verlangsamung. */
export function milestoneMultiplier(count: number): number {
  let m = 1;
  for (const threshold of P.milestones) if (count >= threshold) m *= P.milestoneMult;
  return m;
}

/** Naechster Meilenstein dieser Art - fuer die UI ("noch 3 bis x2"). */
export function nextMilestone(count: number): number | null {
  for (const threshold of P.milestones) if (count < threshold) return threshold;
  return null;
}

/** Gesamtausstoss in Ware/s. */
export function totalOutput(owned: readonly number[]): Num {
  let sum = D(0);
  for (let tier = 0; tier < owned.length; tier++) {
    const count = owned[tier] ?? 0;
    if (count > 0) sum = sum.add(siteOutput(tier).mul(count).mul(milestoneMultiplier(count)));
  }
  return sum;
}

/** Genutzte Flaeche in m2. */
export function usedArea(owned: readonly number[]): number {
  let sum = 0;
  for (let tier = 0; tier < owned.length; tier++) sum += (owned[tier] ?? 0) * siteArea(tier);
  return sum;
}
