/** Land: endlich. Der Preis steigt mit der Knappheit, aber 100% bleiben
 *  erreichbar - die letzten Prozent sind nur teuer. */
import { BALANCE } from './balance.js';
import { D, type Num } from './numbers.js';

const L = BALANCE.land;

/** Verfuegbare Parzellen auf einer Stufe. */
export const parcelPool = (level: number): number =>
  Math.floor(L.pool0 * Math.pow(L.poolMult, level));

/** Preis der naechsten Parzelle als einfache Zahl. Parzellenpreise bleiben auch
 *  ganz am Ende der Knappheit klein genug fuer double - erst das Bargeld nicht. */
function rawParcelCost(owned: number, pool: number): number {
  const fraction = Math.min(owned / pool, 0.999999);
  return L.priceBase * Math.pow(1 / (1 - fraction), L.scarcityExp);
}

/** Preis der naechsten Parzelle. */
export function parcelCost(owned: number, pool: number): Num {
  return D(rawParcelCost(owned, pool));
}

/**
 * Aufsummierte Parzellenpreise, einmal je Stufe gerechnet.
 *
 * Der Knappheitspreis ist keine geometrische Reihe, also muss summiert werden -
 * und das Bedienfeld fragt viermal je Sekunde nach Sammelpreisen. Ohne diese
 * Tabelle waeren das Millionen Potenzrechnungen pro Sekunde. Sie haengt nur an
 * der Poolgroesse, also gilt sie fuer die ganze Stufe.
 */
let prefixCache: { pool: number; sums: Float64Array } | null = null;

function prefixSums(pool: number): Float64Array {
  if (prefixCache && prefixCache.pool === pool) return prefixCache.sums;
  const sums = new Float64Array(pool + 1);
  for (let i = 0; i < pool; i++) sums[i + 1] = sums[i]! + rawParcelCost(i, pool);
  prefixCache = { pool, sums };
  return sums;
}

/** Kosten fuer die naechsten `count` Parzellen. */
export function parcelBulkCost(owned: number, pool: number, count: number): Num {
  if (count <= 0 || owned >= pool) return D(0);
  const sums = prefixSums(pool);
  const from = Math.min(owned, pool);
  const to = Math.min(owned + count, pool);
  return D(sums[to]! - sums[from]!);
}

/** Wie viele Parzellen ein Betrag hergibt. */
export function parcelsForCash(cash: Num, owned: number, pool: number): number {
  if (owned >= pool) return 0;
  const budget = cash.toNumber();
  if (!(budget > 0)) return 0;
  const sums = prefixSums(pool);
  const base = sums[Math.min(owned, pool)]!;
  let low = 0;
  let high = pool - owned;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (sums[owned + mid]! - base <= budget) low = mid; else high = mid - 1;
  }
  return low;
}

/** Verfuegbare Flaeche in m2. */
export const ownedArea = (parcels: number): number => parcels * L.parcelArea;

/** Anteil der Welt, der einem gehoert - 100% ist ein Meilenstein, kein Ende. */
export const ownedFraction = (owned: number, pool: number): number =>
  Math.min(owned / pool, 1);
