/** Land: endlich. Der Preis steigt mit der Knappheit, aber 100% bleiben
 *  erreichbar - die letzten Prozent sind nur teuer. */
import { BALANCE } from './balance.js';
import { D, type Num } from './numbers.js';

const L = BALANCE.land;

/** Verfuegbare Parzellen auf einer Stufe. */
export const parcelPool = (level: number): number =>
  Math.floor(L.pool0 * Math.pow(L.poolMult, level));

/** Preis der naechsten Parzelle. */
export function parcelCost(owned: number, pool: number): Num {
  const fraction = Math.min(owned / pool, 0.999999);
  return D(L.priceBase).mul(Math.pow(1 / (1 - fraction), L.scarcityExp));
}

/** Verfuegbare Flaeche in m2. */
export const ownedArea = (parcels: number): number => parcels * L.parcelArea;

/** Anteil der Welt, der einem gehoert - 100% ist ein Meilenstein, kein Ende. */
export const ownedFraction = (owned: number, pool: number): number =>
  Math.min(owned / pool, 1);
