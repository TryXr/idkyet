/**
 * Marktdynamik. Herzstueck des Spiels.
 *
 *   dp/dt = -kP * u^gamma * p + rP * (1 - p)
 *   dh/dt =  kH * u          - rH * h
 *   Umsatz = zugeteilte Ware * basePrice * p
 *
 * gamma > 1 macht den Umsatz NICHT-MONOTON in der Auslastung: es gibt ein
 * Maximum bei u*, danach faellt er wieder. Einen Markt zu fluten ist dadurch
 * aktiv schaedlich statt nur nutzlos - und erst das macht den dummen
 * Autopiloten schlagbar. Mit gamma = 1 liegt der Vorteil aktiven Spiels bei
 * 1.06 statt bei 1.2 bis 2.4 (gemessen, siehe BALANCING.md).
 */
import { BALANCE } from './balance.js';
import type { Rng } from './rng.js';

const M = BALANCE.market;

export interface MarketNode {
  readonly id: number;
  readonly demand: number;      // Ware/s bei voller Auslastung
  readonly basePrice: number;   // Erloes je Ware bei p = 1
  priceMult: number;            // langsame Marktschwankung um 1.0
  p: number;                    // Preisfaktor 0..1
  h: number;                    // Hitze 0..1
  lockedFor: number;            // Restsperre in Sekunden
  enabled: boolean;             // vom Spieler an-/abgeschaltet
}

/** Gleichgewichts-Preisfaktor bei dauerhafter Auslastung u. */
export const equilibriumPrice = (u: number): number =>
  M.rP / (M.rP + M.kP * Math.pow(u, M.gamma));

/** Umsatzoptimale Auslastung u*: Maximum von u * p*(u). */
export const OPTIMAL_UTILISATION: number = (() => {
  let best = 0.01, bestValue = -1;
  for (let u = 0.01; u <= 5; u += 0.001) {
    const value = u * equilibriumPrice(u);
    if (value > bestValue) { bestValue = value; best = u; }
  }
  return best;
})();

/** Preisfaktor bei optimaler Auslastung - Basispreise werden damit skaliert. */
export const PRICE_AT_OPTIMUM: number = equilibriumPrice(OPTIMAL_UTILISATION);

export function createNode(id: number, demand: number, basePrice: number): MarketNode {
  return { id, demand, basePrice, priceMult: 1, p: 1, h: 0, lockedFor: 0, enabled: true };
}

/** Aktueller Erloes je Ware (vor dem Preisfaktor p). */
export const nodePrice = (n: MarketNode): number => n.basePrice * n.priceMult;

/** Was dieser Knoten gerade hoechstens sinnvoll aufnimmt. */
export const nodeCapacity = (n: MarketNode): number => n.demand * OPTIMAL_UTILISATION;

export const isSellable = (n: MarketNode): boolean => n.lockedFor <= 0 && n.enabled;

/**
 * Einen Zeitschritt rechnen. `alloc[i]` ist die dem Knoten i zugeteilte Ware/s.
 * Gibt den erzielten Umsatz zurueck und meldet ueber `onLock`, wenn ein Markt
 * dichtmacht (fuer Events/UI).
 */
export function stepMarkets(
  nodes: MarketNode[],
  alloc: number[],
  dt: number,
  rng: Rng,
  onLock?: (n: MarketNode) => void,
): { revenue: number; sold: number } {
  let revenue = 0, sold = 0;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    let rate = alloc[i] ?? 0;
    if (n.lockedFor > 0) { n.lockedFor -= dt; rate = 0; }
    // Mehr als das nimmt der Markt physisch nicht auf - der Rest bleibt liegen.
    rate = Math.min(rate, n.demand * M.maxIntakeMultiple);

    const u = n.demand > 0 ? Math.min(rate / n.demand, 8) : 0;
    revenue += rate * nodePrice(n) * n.p * dt;
    sold += rate * dt;

    n.p += (-M.kP * Math.pow(u, M.gamma) * n.p + M.rP * (1 - n.p)) * dt;
    n.p = Math.min(1, Math.max(0.02, n.p));

    n.h += (M.kH * u - M.rH * n.h) * dt;
    if (n.h >= 1 && n.lockedFor <= 0) {
      n.lockedFor = M.lockSeconds;
      onLock?.(n);
    }
    n.h = Math.min(1, Math.max(0, n.h));

    const V = BALANCE.volatility;
    n.priceMult += (-V.pull * (n.priceMult - 1) + V.sigma * rng.signed() * 0.5) * dt;
    n.priceMult = Math.min(V.max, Math.max(V.min, n.priceMult));
  }
  return { revenue, sold };
}
