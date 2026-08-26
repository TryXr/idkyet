/**
 * Kaufpolitik eines vernuenftigen Spielers, gemeinsam genutzt von Regressions-
 * lauf, Sweep, Diagnose und Speichertest. Vorher stand dieselbe Logik viermal
 * leicht unterschiedlich herum - dadurch massen die Werkzeuge verschiedene
 * Spiele.
 *
 * Der Kern der Politik ist ein Satz: KAUFE, WAS DEN ENGPASS LOEST.
 * Der Durchsatz des Spiels ist min(Produktion, Absatz) - wer nur eine Seite
 * ausbaut, produziert ins volle Lager oder laesst Dealer Daeumchen drehen.
 * Deshalb wird jede Kaufoption danach bewertet, wie viel Durchsatz sie in den
 * naechsten Minuten bringt, geteilt durch ihren Preis.
 */
import type { Sim } from '../src/core/sim.js';
import { BALANCE } from '../src/core/balance.js';
import { TIERS } from '../src/core/chains.js';
import { roomQuality, roomSeats } from '../src/core/rooms.js';
import type { ChainKey } from '../src/core/chains.js';

/** Zeithorizont, ueber den ein Kauf bewertet wird. */
const HORIZON = 300;

export interface AutoplayOptions {
  /** Von Hand kochen und verkaufen, solange noch keine Helfer da sind. */
  useHands?: boolean;
}

export interface Decision {
  kind: 'unit' | 'room' | 'storage' | 'hand' | 'wait';
  chain?: ChainKey;
  tier?: number;
  count?: number;
}

/**
 * Wie viele Einheiten der Stufe 0 eine Einheit der Stufe k nach `seconds`
 * herbeigefuehrt hat. Jede Stufe stellt die darunter ein, also ist das die
 * k-fache Aufleitung: (rate * t)^k / k!.
 */
function reachAfter(tier: number, seconds: number): number {
  const x = BALANCE.chain.hireRate * seconds;
  let value = 1;
  for (let i = 1; i <= tier; i++) value *= x / i;
  return value;
}

/** Qualitaet des besten Platzes, der gerade frei ist (0 = alles besetzt). */
function freeSeatQuality(sim: Sim): number {
  let left = sim.workers();
  for (let tier = sim.rooms.length - 1; tier >= 0; tier--) {
    const seats = (sim.rooms[tier] ?? 0) * roomSeats(tier);
    if (seats <= 0) continue;
    if (left < seats) return roomQuality(tier);
    left -= seats;
  }
  return 0;
}

interface Option {
  decision: Decision;
  gain: number;   // zusaetzlicher Durchsatz in Ware/s
  cost: number;
}

/**
 * Von Hand arbeiten, solange keine Helfer da sind. Das ist die erste Minute
 * des Spiels und gehoert deshalb auch in den Messlauf - ohne sie kaeme kein
 * Durchlauf jemals in Gang.
 */
export function useHands(sim: Sim): boolean {
  let did = false;
  if (sim.cook[0]! < 1) { sim.cookByHand(); did = true; }
  if (sim.sell[0]! < 1 && sim.storage > 0) { sim.sellByHand(); did = true; }
  return did;
}

/**
 * Eine Kaufentscheidung.
 *
 * Erst wird die SEITE gewaehlt (kochen oder verkaufen), dann auf dieser Seite
 * das beste Angebot je Bargeld. Die Seitenwahl ist der ganze Witz: der
 * Durchsatz ist min(Produktion, Absatz), also lohnt immer nur die schwaechere
 * Haelfte.
 *
 * Frueher stand hier eine Bewertung ueber min(...) fuer alle Optionen
 * gemeinsam. Die hatte einen toten Punkt: sind beide Seiten null, verbessert
 * kein einzelner Kauf das Minimum, und der Messlauf kaufte NIE etwas - er
 * klickte sechs Stunden von Hand. Der Fehler war nicht im Spiel, sondern im
 * Messwerkzeug.
 */
export function decide(sim: Sim, opts: AutoplayOptions = {}): Decision {
  // Haende benutzen und TROTZDEM weiter einkaufen. Vorher stand hier ein
  // return: solange kein Junkie da war, wurde nur geklickt und nie einer
  // gekauft - der Lauf haengte sechs Stunden in der ersten Minute fest.
  if (opts.useHands !== false) useHands(sim);

  const cash = sim.cash;
  const output = sim.output();
  const absatz = sim.sellRate();

  // Lager laeuft ueber und es liegt wirklich am Lager: dann zuerst das.
  if (sim.storage >= sim.storageCap() * 0.95 && output > absatz) {
    if (cash.gte(sim.storageCost()) && sim.buyStorage()) return { kind: 'storage' };
  }

  const options: Option[] = [];
  const add = (decision: Decision, gain: number, cost: number): void => {
    if (gain > 0 && cost > 0 && cash.gte(cost)) options.push({ decision, gain, cost });
  };

  // Die schwaechere Haelfte ausbauen. Gleichstand zaehlt als Produktion, denn
  // ohne Ware gibt es nichts zu verkaufen.
  if (output <= absatz) {
    const quality = freeSeatQuality(sim);
    for (let tier = 0; tier < sim.unlockedTiers('cook'); tier++) {
      const workers = reachAfter(tier, HORIZON);
      add({ kind: 'unit', chain: 'cook', tier }, workers * quality,
        sim.unitCost('cook', tier).toNumber());
    }
    for (let tier = 0; tier < sim.unlockedRooms(); tier++) {
      // Ein Raum bringt nur, was auch besetzt werden kann - jetzt oder bald.
      const soon = sim.idle() + (sim.cook[1] ?? 0) * BALANCE.chain.hireRate * HORIZON;
      const used = Math.min(roomSeats(tier), Math.max(soon, roomSeats(tier) * 0.2));
      add({ kind: 'room', tier }, used * roomQuality(tier), sim.roomCost(tier).toNumber());
    }
  } else {
    for (let tier = 0; tier < sim.unlockedTiers('sell'); tier++) {
      const sellers = reachAfter(tier, HORIZON);
      add({ kind: 'unit', chain: 'sell', tier }, sellers * BALANCE.sell.sellRate,
        sim.unitCost('sell', tier).toNumber());
    }
  }

  if (options.length === 0) return { kind: 'wait' };

  let best = options[0]!;
  for (const option of options) {
    if (option.gain / option.cost > best.gain / best.cost) best = option;
  }

  switch (best.decision.kind) {
    case 'unit': sim.buyUnit(best.decision.chain!, best.decision.tier!); break;
    case 'room': sim.buyRoom(best.decision.tier!); break;
  }
  return best.decision;
}

/** Ticken und entscheiden, bis das Spiel durch ist oder die Zeit reicht. */
export function playThrough(sim: Sim, limitSeconds = 40 * 3600, opts: AutoplayOptions = {}): void {
  while (!sim.finished && sim.time < limitSeconds) {
    sim.tick();
    decide(sim, opts);
  }
}

export { TIERS };
