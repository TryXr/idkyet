/**
 * Statthalter-Politiken. Der Autopilot ist eine POLITIK, und die
 * Standard-Politik ist bewusst mittelmaessig - genau daraus entsteht der Wert
 * aktiven Spiels, ohne ein Zusatzsystem.
 *
 * Gemessen gegen einen Menschen mit 30 s Reaktion (BALANCING.md):
 *   S0 alles abkippen          76% / 86% /  90% /  43%
 *   S1 + Sperren meiden        76% / 86% /  90% /  45%
 *   S2 + Obergrenze & Vorrang  83% / 90% / 100% / 100%
 *   S3 + schnelle Reaktion     96% / 98% / 100% / 100%
 *
 * WICHTIG: Obergrenze und Preis-Vorrang sind EIN Upgrade. Getrennt gekauft
 * waere die Obergrenze allein schlechter als gar nichts (47%), weil der
 * Autopilot dann in den erstbesten statt in den besten Markt liefert.
 */
import { isSellable, nodeCapacity, nodePrice, type MarketNode } from './market.js';

export type Policy = (nodes: readonly MarketNode[], supplyRate: number) => number[];

export interface PolicyTraits {
  respectsHeat: boolean;   // meidet heisse Knoten
  respectsCap: boolean;    // liefert hoechstens bis zur optimalen Auslastung
  sortsByPrice: boolean;   // liefert zuerst in die teuersten Maerkte
  reactSeconds: number;    // 0 = jeden Tick neu entscheiden
  /**
   * Bereitschaft, bei ueberdurchschnittlichem Preis ueber die optimale
   * Auslastung hinaus zu liefern. 0 = nie.
   *
   * GEMESSEN UND VERWORFEN: bringt nichts. Ueber u* hinaus zu liefern kostet
   * mehr, als die Preisspitze einbringt - der Preisverfall ist ueberlinear und
   * haelt laenger an als die Spitze. Der Mensch wurde damit LANGSAMER (5.99 h
   * statt 5.90 h). Bleibt auf 0; das Feld steht nur noch da, damit niemand die
   * Idee ein zweites Mal hat.
   */
  opportunism: number;
}

export const PILOT_TRAITS: Record<string, PolicyTraits> = {
  none:  { respectsHeat: true,  respectsCap: true,  sortsByPrice: true,  reactSeconds: 0,   opportunism: 0 },
  s0:    { respectsHeat: false, respectsCap: false, sortsByPrice: false, reactSeconds: 0,   opportunism: 0 },
  s1:    { respectsHeat: true,  respectsCap: false, sortsByPrice: false, reactSeconds: 0,   opportunism: 0 },
  s2:    { respectsHeat: true,  respectsCap: true,  sortsByPrice: true,  reactSeconds: 300, opportunism: 0 },
  s3:    { respectsHeat: true,  respectsCap: true,  sortsByPrice: true,  reactSeconds: 90,  opportunism: 0 },
  human: { respectsHeat: true,  respectsCap: true,  sortsByPrice: true,  reactSeconds: 30,  opportunism: 0 },
};

const HEAT_CUTOFF = 0.8;

export function makePolicy(traits: PolicyTraits): Policy {
  return (nodes, supplyRate) => {
    const alloc = new Array<number>(nodes.length).fill(0);
    let candidates = nodes.filter(isSellable);
    if (traits.respectsHeat) candidates = candidates.filter(n => n.h < HEAT_CUTOFF);
    if (candidates.length === 0) return alloc;

    if (!traits.respectsCap) {
      // S0/S1: alles gleichmaessig abkippen, egal wie gross oder teuer der Markt ist
      const share = supplyRate / candidates.length;
      for (const n of candidates) alloc[n.id] = share;
      return alloc;
    }

    const ordered = traits.sortsByPrice
      ? [...candidates].sort((a, b) => nodePrice(b) * b.p - nodePrice(a) * a.p)
      : candidates;

    let left = supplyRate;
    for (const n of ordered) {
      if (left <= 0) break;
      // Bei einer Preisspitze darf ueber die optimale Auslastung hinausgegangen
      // werden - der hoehere Erloes wiegt den staerkeren Preisverfall auf.
      const surge = traits.opportunism > 0
        ? 1 + traits.opportunism * Math.max(0, n.priceMult - 1)
        : 1;
      const take = Math.min(left, nodeCapacity(n) * surge);
      alloc[n.id] = take;
      left -= take;
    }
    return alloc; // Rest bleibt im Lager
  };
}
