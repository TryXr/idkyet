/**
 * Raeume: sie bieten PLAETZE und bestimmen die QUALITAET.
 *
 * Qualitaet ist kein eigener Hebel, sondern die Ware je Sekunde, die EIN
 * Arbeiter in diesem Raum schafft (CLAUDE.md). Ein Junkie im Badezimmer bringt
 * wenig, derselbe Junkie im Labor viel - ohne dass es dafuer ein Menue braucht.
 *
 * Die Zuteilung passiert automatisch in den besten freien Raum. Der Spieler
 * soll Leute nicht auf Zimmer verteilen; seine einzige Entscheidung ist
 * "mehr Raeume oder mehr Arbeiter?", und die stellt sich von allein.
 */
import { BALANCE, ROOM_NAMES } from './balance.js';
import { D, type Num } from './numbers.js';

const R = BALANCE.rooms;

export const roomCount = (): number => ROOM_NAMES.length;

export const roomName = (tier: number): string => ROOM_NAMES[tier] ?? `Raum ${tier + 1}`;

/** Plaetze eines Raumes dieser Art. */
export const roomSeats = (tier: number): number =>
  Math.max(1, Math.round(R.seats0 * Math.pow(R.seatsMult, tier)));

/** Ware je Sekunde und Arbeiter in einem Raum dieser Art. */
export const roomQuality = (tier: number): number =>
  R.quality0 * Math.pow(R.qualityMult, tier);

/** Preis des naechsten Raumes dieser Art. */
export const roomCost = (tier: number, owned: number): Num =>
  D(R.cost0).mul(Math.pow(R.costMult, tier)).mul(Math.pow(R.costGrowth, owned));

/** Was ein Raum dieser Art voll besetzt liefert - fuer Vergleiche in der UI. */
export const roomOutput = (tier: number): number => roomSeats(tier) * roomQuality(tier);

/** Alle Plaetze zusammen. */
export function totalSeats(owned: readonly number[]): number {
  let sum = 0;
  for (let tier = 0; tier < owned.length; tier++) sum += (owned[tier] ?? 0) * roomSeats(tier);
  return sum;
}

/**
 * Ware je Sekunde. Die Arbeiter fuellen immer zuerst die besten Raeume -
 * deshalb von oben nach unten.
 */
export function production(workers: number, owned: readonly number[]): number {
  let left = workers;
  let rate = 0;
  for (let tier = owned.length - 1; tier >= 0 && left > 0; tier--) {
    const seats = (owned[tier] ?? 0) * roomSeats(tier);
    if (seats <= 0) continue;
    const used = Math.min(left, seats);
    rate += used * roomQuality(tier);
    left -= used;
  }
  return rate * BALANCE.cook.workRate;
}

/** Beste Qualitaet, die gerade zur Verfuegung steht - fuer den Handbetrieb. */
export function bestQuality(owned: readonly number[]): number {
  for (let tier = owned.length - 1; tier >= 0; tier--) {
    if ((owned[tier] ?? 0) > 0) return roomQuality(tier);
  }
  return R.quality0;
}

/** Arbeiter ohne Platz. Sichtbar herumstehende Leute sind das Signal,
 *  dass es Zeit fuer einen weiteren Raum ist. */
export function idleWorkers(workers: number, owned: readonly number[]): number {
  return Math.max(0, workers - totalSeats(owned));
}
