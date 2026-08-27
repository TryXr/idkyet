/**
 * Die beiden Helfer-Ketten.
 *
 *   ZIEHEN     Gärtner -> Grower -> Botaniker -> Professor
 *   VERKAUFEN  Dealer -> Straßenboss -> Großhändler -> Konzernchef
 *
 * Stufe 0 arbeitet, jede hoehere stellt die darunter ein. Das ist der ganze
 * Trick: die zweite Stufe ist die Ableitung der ersten, die dritte die der
 * zweiten. Dadurch waechst die Produktion POLYNOMIAL, waehrend die Kosten
 * exponentiell steigen - der Motor des Genres (CLAUDE.md, Mathematischer Kern).
 *
 * Und es erklaert sich von selbst: ein Konzernchef verkauft nichts, er stellt
 * Leute ein.
 */
import { BALANCE, COOK_CHAIN, SELL_CHAIN } from './balance.js';
import { D, type Num } from './numbers.js';

const C = BALANCE.chain;

export type ChainKey = 'cook' | 'sell';

export const TIERS = 4;

export const chainNames = (chain: ChainKey): ReadonlyArray<string> =>
  chain === 'cook' ? COOK_CHAIN : SELL_CHAIN;

export const unitName = (chain: ChainKey, tier: number): string =>
  chainNames(chain)[tier] ?? `Stufe ${tier}`;

/** Preis der naechsten Einheit dieser Art. */
export function unitCost(chain: ChainKey, tier: number, owned: number): Num {
  const base = chain === 'cook' ? BALANCE.cook.costBase : BALANCE.sell.costBase;
  return D(base).mul(Math.pow(C.costTierMult, tier)).mul(Math.pow(C.costGrowth, owned));
}

/** Meilenstein-Multiplikator: x2 bei 25, 50, 100, 200 Stueck derselben Art.
 *  Erzeugt Schuebe schneller Kaeufe statt gleichmaessiger Verlangsamung. */
export function milestoneMultiplier(count: number): number {
  let m = 1;
  for (const threshold of C.milestones) if (count >= threshold) m *= C.milestoneMult;
  return m;
}

/** Naechster Meilenstein dieser Art - fuer die UI ("noch 3 bis x2"). */
export function nextMilestone(count: number): number | null {
  for (const threshold of C.milestones) if (count < threshold) return threshold;
  return null;
}

/**
 * Einen Zeitschritt wachsen lassen: jede Stufe stellt die darunter ein.
 *
 * Von OBEN nach unten, damit ein frisch eingestellter Grower nicht im selben
 * Tick schon Gaertner anschleppt - sonst haengt das Ergebnis an der Tickgroesse
 * und die Simulation waere nicht mehr deterministisch gegenueber dem
 * Offline-Nachlauf, der mit groesseren Schritten rechnet.
 *
 * `need` (0 bis 1) ist der BEDARF: eingestellt wird nur, solange es etwas zu
 * tun gibt - ein Grower sucht Gaertner, solange Pflanzen ungepflegt sind, ein
 * Strassenboss sucht Dealer, solange Ernte im Lager liegt.
 *
 * Ohne diese Bremse wuchsen beide Ketten allein mit der ZEIT weiter, waehrend
 * der Ertrag an Plaetzen und Pflanzen haengt. Gemessen: 2.5 Mrd Dealer fuer
 * einen Absatz, der nie ueber 75 k stieg - das Dreizehntausendfache dessen,
 * was je gebraucht wurde. Die halbe Bedienung war damit ab der dritten Ebene
 * gegenstandslos.
 */
export function growChain(units: number[], dt: number, need = 1): void {
  if (need <= 0) return;
  for (let tier = units.length - 2; tier >= 0; tier--) {
    const above = units[tier + 1] ?? 0;
    if (above <= 0) continue;
    units[tier] = (units[tier] ?? 0) + above * C.hireRate * milestoneMultiplier(above) * need * dt;
  }
}

/** Wirksame Stueckzahl der Stufe 0 inklusive ihrer Meilensteine. */
export function effectiveUnits(units: readonly number[]): number {
  const base = units[0] ?? 0;
  return base * milestoneMultiplier(base);
}
