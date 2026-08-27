/**
 * SORTEN: die Belohnung fuer eine Uebernahme.
 *
 * Jedes Gebiet bringt eine eigene Sorte mit - Name aus dem Ortsnamen, Vorteil
 * und Staerke aus dem Seed. Damit ist keine der 120 Uebernahmen mehr die 120.
 * gleiche (TIEFE.md, Befund 1.5), und die Zielwahl entscheidet, WAS DU WIRST,
 * nicht nur, wie schnell es geht.
 *
 * Kein handgeschriebener Inhalt, kein eigenes Menue, keine zweite Waehrung:
 * ein Feld an `Territory`, fuenf Zahlen in `Bonuses` und eine Anzeige. Das ist
 * der ganze Eingriff.
 *
 * WARUM ADDITIV, NICHT MULTIPLIKATIV: 20 Sorten derselben Art summieren sich
 * auf einen planbaren Faktor (bei 0.05 je Sorte auf etwa das Doppelte), waehrend
 * ein Produkt ueber 120 Uebernahmen jede Balance sprengt. Die "weniger ist
 * besser"-Arten laufen ueber 1/(1+Summe) und koennen deshalb nie null werden.
 */
import { BALANCE } from './balance.js';
import { production, totalSeats } from './rooms.js';
import type { Rng } from './rng.js';

export type StrainKind = 'yield' | 'seats' | 'upkeep' | 'sales' | 'seed' | 'rent';

/** Die fuenf Arten, die sich sammeln - `rent` wirkt nur im eigenen Gebiet. */
export type GlobalKind = Exclude<StrainKind, 'rent'>;

const KINDS: ReadonlyArray<StrainKind> = ['yield', 'seats', 'upkeep', 'sales', 'seed', 'rent'];

export interface Strain {
  readonly kind: StrainKind;
  readonly name: string;
  /** Staerke des Vorteils. Was daraus wird, sagen die Faktoren unten. */
  readonly power: number;
}

/** Die gesammelten Staerken je Art - SUMMEN, keine fertigen Faktoren. */
export interface Bonuses {
  yield: number;
  seats: number;
  upkeep: number;
  sales: number;
  seed: number;
  /** Wie viele Sorten insgesamt im Beet stehen. Nur fuer die Anzeige. */
  count: number;
}

export const noBonuses = (): Bonuses =>
  ({ yield: 0, seats: 0, upkeep: 0, sales: 0, seed: 0, count: 0 });

export const yieldFactor = (b: Bonuses): number => 1 + b.yield;
export const seatFactor = (b: Bonuses): number => 1 + b.seats;
export const salesFactor = (b: Bonuses): number => 1 + b.sales;
/** Weniger ist besser - deshalb 1/(1+x): naehert sich der Null, erreicht sie nie. */
export const upkeepFactor = (b: Bonuses): number => 1 / (1 + b.upkeep);
export const seedFactor = (b: Bonuses): number => 1 / (1 + b.seed);

/** Eine uebernommene Sorte ins Beet aufnehmen. */
export function applyStrain(b: Bonuses, strain: Strain): void {
  b.count++;
  if (strain.kind === 'rent') return;  // wirkt im Gebiet selbst, siehe rentFactor
  b[strain.kind] += strain.power;
}

/**
 * Was eine Sorte mit der Rente ihres eigenen Gebiets macht. Als einzige Art
 * wirkt sie nicht ueberall, sondern nur dort - "doppelte Rente, sonst nichts".
 * Weil sie schon bei der Weltgenerierung eingerechnet wird, sieht die Zielwahl
 * sie von allein: ein kleines Gebiet mit dieser Sorte ist ein Schnaeppchen.
 */
export const rentFactor = (strain: Strain): number =>
  strain.kind === 'rent' ? 1 + strain.power * BALANCE.strain.rentScale : 1;

// --- Wirkung auf die Anlage ------------------------------------------------

/** Plaetze inklusive Sortenvorteil. Immer ganzzahlig - ein halber Platz waere Unfug. */
export const boostedSeats = (rooms: readonly number[], b: Bonuses): number =>
  Math.floor(totalSeats(rooms) * seatFactor(b));

/** Ernte je Sekunde bei voller Pflege, inklusive Sortenvorteil. */
export const boostedProduction = (
  plants: number, rooms: readonly number[], b: Bonuses,
): number => production(plants, rooms) * yieldFactor(b);

// --- Namen -----------------------------------------------------------------

/**
 * Die Endungen. Eine LISTE, kein Fliesstext - der Deckel fuer Stimmen-Zeilen
 * gilt davon unberuehrt (CLAUDE.md).
 */
const SUFFIXES: ReadonlyArray<string> = [
  'Nebel', 'Kush', 'Haze', 'Diesel', 'Frost', 'Wolke', 'Express', 'Dunst',
  'Traum', 'Schleier', 'Glut', 'Nacht', 'Bomber', 'Feierabend', 'Sonne', 'Rakete',
];

/** Das namengebende Wort eines Ortes: Ziffern und Beiwerk fliegen raus. */
function stem(place: string): string {
  const words = place.split(/[\s]+/).filter(w => /[A-Za-zÄÖÜäöüß]/.test(w));
  const word = words[words.length - 1] ?? place;
  return word.replace(/[^A-Za-zÄÖÜäöüß-]+$/, '').replace(/-$/, '');
}

/**
 * "Duisburg" -> "Duisburger". Gibt null zurueck, wo die Regel Unfug ergaebe
 * ("Nordamerikaer") - dann steht der Ort einfach unveraendert davor, so wie in
 * "Oberhausen Kush". Beide Formen sind gewollt, das ist die Streuung.
 */
function adjective(word: string): string | null {
  const last = word.slice(-1).toLowerCase();
  if (last === 'e') return `${word}r`;
  if (word.toLowerCase().endsWith('er') || 'aiouyäöü'.includes(last)) return null;
  return `${word}er`;
}

export function strainName(place: string, rng: Rng): string {
  const word = stem(place);
  const long = adjective(word);
  const front = long !== null && rng.next() < 0.6 ? long : word;
  const suffix = SUFFIXES[Math.floor(rng.next() * SUFFIXES.length)] ?? 'Kush';
  return `${front} ${suffix}`;
}

/** Eine Sorte wuerfeln. Art gleichverteilt, Staerke gestreut. */
export function makeStrain(place: string, rng: Rng): Strain {
  const kind = KINDS[Math.floor(rng.next() * KINDS.length)] ?? 'yield';
  const power = BALANCE.strain.power * rng.logNormal(BALANCE.strain.sigma);
  return { kind, name: strainName(place, rng), power };
}

// --- Beschriftung ----------------------------------------------------------

/**
 * Eine Nachkommastelle unter 10 %. Eine einzelne Sorte liegt bei rund 3 %, und
 * "+3 %" neben "+3 %" sieht aus wie zweimal dasselbe - dabei ist die eine
 * doppelt so gut wie die andere. Die Streuung ist der Punkt, also muss sie
 * sichtbar sein.
 */
const pct = (x: number): string =>
  `${(x * 100).toFixed(x < 0.1 ? 1 : 0)} %`;

/** Was diese eine Sorte bringt, in einem Halbsatz. */
export function strainEffect(strain: Strain): string {
  const p = strain.power;
  switch (strain.kind) {
    case 'yield':  return `+${pct(p)} Ertrag`;
    case 'seats':  return `+${pct(p)} Plätze`;
    case 'sales':  return `+${pct(p)} Absatz`;
    case 'upkeep': return `−${pct(p / (1 + p))} Strom`;
    case 'seed':   return `−${pct(p / (1 + p))} je Steckling`;
    case 'rent':   return `×${rentFactor(strain).toFixed(1)} Rente hier`;
  }
}

/**
 * Die Kurzform fuer die Karte: nur WAS es gibt, nicht wie viel. Auf einem
 * Kreis von 40 Pixeln ist "+3 % Ertrag" nicht lesbar, "+Ertrag" schon - und
 * fuer die Zielwahl reicht die Richtung.
 */
export function strainTag(strain: Strain): string {
  switch (strain.kind) {
    case 'yield':  return '+Ertrag';
    case 'seats':  return '+Plätze';
    case 'sales':  return '+Absatz';
    case 'upkeep': return '−Strom';
    case 'seed':   return '−Stecklinge';
    case 'rent':   return `×${rentFactor(strain).toFixed(1)} Rente`;
  }
}

/** Das ganze Beet in fuenf Zeilen - die Sammlung, sichtbar gemacht. */
export function bonusLines(b: Bonuses): string[] {
  return [
    `Ertrag ×${yieldFactor(b).toFixed(2)}`,
    `Plätze ×${seatFactor(b).toFixed(2)}`,
    `Absatz ×${salesFactor(b).toFixed(2)}`,
    `Strom ×${upkeepFactor(b).toFixed(2)}`,
    `Stecklinge ×${seedFactor(b).toFixed(2)}`,
  ];
}
