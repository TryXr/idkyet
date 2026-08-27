/**
 * Raeume: sie bieten PLAETZE fuer Pflanzen und bestimmen die QUALITAET.
 *
 * Qualitaet ist kein eigener Hebel, sondern die Ernte je Sekunde, die EINE
 * Pflanze in diesem Raum bringt (CLAUDE.md). Dieselbe Pflanze bringt im
 * Badezimmer wenig und im Gewaechshaus viel - ohne dass es dafuer ein Menue
 * braucht. Sichtbar ist sie trotzdem, als Prozentzahl am Lagerbestand.
 *
 * Die Zuteilung passiert automatisch in den besten freien Raum. Der Spieler
 * soll keine Pflanzen auf Zimmer verteilen.
 */
import { BALANCE, ROOM_NAMES } from './balance.js';
import { D, type Num } from './numbers.js';

const R = BALANCE.rooms;

export const roomCount = (): number => ROOM_NAMES.length;

export const roomName = (tier: number): string => ROOM_NAMES[tier] ?? `Raum ${tier + 1}`;

/** Plaetze eines Raumes dieser Art. */
export const roomSeats = (tier: number): number =>
  Math.max(1, Math.round(R.seats0 * Math.pow(R.seatsMult, tier)));

/** Ernte je Sekunde und Pflanze in einem Raum dieser Art. */
export const roomQuality = (tier: number): number =>
  R.quality0 * Math.pow(R.qualityMult, tier);

/** Preis des naechsten Raumes dieser Art. */
export const roomCost = (tier: number, owned: number): Num =>
  D(R.cost0).mul(Math.pow(R.costMult, tier)).mul(Math.pow(R.costGrowth, owned));

/** Was ein Raum dieser Art voll bepflanzt liefert - fuer Vergleiche in der UI. */
export const roomOutput = (tier: number): number => roomSeats(tier) * roomQuality(tier);

/** Alle Plaetze zusammen. */
export function totalSeats(owned: readonly number[]): number {
  let sum = 0;
  for (let tier = 0; tier < owned.length; tier++) sum += (owned[tier] ?? 0) * roomSeats(tier);
  return sum;
}

/**
 * Ernte je Sekunde bei voller Pflege. Die Pflanzen stehen immer zuerst in den
 * besten Raeumen - deshalb von oben nach unten. Mehr Pflanzen als Plaetze
 * bringen nichts; sie warten (siehe `idlePlants`).
 */
export function production(plants: number, owned: readonly number[]): number {
  let left = plants;
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

/**
 * Was alle Raeume zusammen braechten, wenn jeder Platz bepflanzt und gepflegt
 * waere. Grundlage der Betriebskosten: bezahlt wird der PLATZ, nicht die
 * Pflanze - ein leerer Raum kostet also trotzdem Strom.
 */
export function potential(owned: readonly number[]): number {
  let sum = 0;
  for (let tier = 0; tier < owned.length; tier++) {
    sum += (owned[tier] ?? 0) * roomSeats(tier) * roomQuality(tier);
  }
  return sum * BALANCE.cook.workRate;
}

/**
 * Der Teil des Potenzials, der wirklich abgerechnet wird: alles ausser dem
 * ersten Badezimmer. Die Freigrenze ist keine Balance-Feinheit, sondern der
 * Startzustand - siehe `Sim.upkeepRate`.
 */
export function billedPotential(owned: readonly number[]): number {
  const free = roomSeats(0) * roomQuality(0) * BALANCE.cook.workRate;
  return Math.max(0, potential(owned) - free);
}

/** Beste Raumstufe, die schon steht. Bestimmt Handbetrieb und Stecklingspreis. */
export function bestTier(owned: readonly number[]): number {
  for (let tier = owned.length - 1; tier >= 0; tier--) {
    if ((owned[tier] ?? 0) > 0) return tier;
  }
  return 0;
}

/** Beste Qualitaet, die gerade zur Verfuegung steht. */
export function bestQuality(owned: readonly number[]): number {
  return roomQuality(bestTier(owned));
}

/** Pflanzen ohne Platz. Sie warten sichtbar - das Signal fuer den naechsten Raum. */
export function idlePlants(plants: number, owned: readonly number[]): number {
  return Math.max(0, plants - totalSeats(owned));
}
