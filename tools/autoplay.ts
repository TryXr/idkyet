/**
 * Kaufpolitik eines vernuenftigen Spielers, gemeinsam genutzt von Regressions-
 * lauf, Sweep, Diagnose und Speichertest. Vorher stand dieselbe Logik viermal
 * leicht unterschiedlich herum - dadurch massen die Werkzeuge verschiedene
 * Spiele.
 *
 * Der Kern der Politik ist ein Satz: KAUFE, WAS DEN NETTOERTRAG AM MEISTEN
 * HEBT, JE AUSGEGEBENEM EURO.
 *
 * Frueher wurde nach "welche Haelfte ist kleiner" entschieden. Das ging nur,
 * solange der Durchsatz min(Produktion, Absatz) war. Seit die Ernte auch
 * zurueckgelegt werden kann und Raeume laufend Strom kosten, gibt es drei
 * Faktoren und einen Abfluss - dafuer taugt keine Faustregel mehr, sondern nur
 * noch das Nachrechnen: was braechte diese Anschaffung wirklich?
 */
import type { Sim } from '../src/core/sim.js';
import { BALANCE } from '../src/core/balance.js';
import { TIERS } from '../src/core/chains.js';
import { billedPotential, roomQuality } from '../src/core/rooms.js';
import {
  boostedProduction, boostedSeats, salesFactor, upkeepFactor, type Bonuses,
} from '../src/core/strains.js';
import { levelPrice } from '../src/core/world.js';
import type { ChainKey } from '../src/core/chains.js';

/** Zeithorizont, ueber den ein Kauf bewertet wird. */
const HORIZON = 300;

/**
 * Winziger Sockel auf beiden Seiten, damit die Bewertung keinen TOTEN PUNKT
 * hat: sind Ernte und Absatz beide null, hebt sonst kein einzelner Kauf das
 * Ergebnis, und der Messlauf kauft nie etwas. Genau dieser Fehler hat schon
 * einmal ein Spiel gemessen, das niemand spielt (BALANCING.md).
 */
const EPS = 1e-9;

export interface AutoplayOptions {
  /** Von Hand ernten und verkaufen, solange noch keine Helfer da sind. */
  useHands?: boolean;
  /** Den Regler mitstellen. Aus, wenn ein Messlauf ihn selbst setzt. */
  tuneSeed?: boolean;
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

/**
 * Ernte je Sekunde bei diesem Bestand - dieselbe Rechnung wie in der Sim,
 * Sorten eingeschlossen. Ohne sie bewertete die Politik ein anderes Spiel als
 * das, das laeuft - und der Abstand waechst mit jeder Uebernahme.
 */
function outputWith(
  plants: number, gardeners: number, rooms: readonly number[], bonuses: Bonuses,
): number {
  const active = Math.min(plants, boostedSeats(rooms, bonuses));
  if (active <= 0) return 0;
  const full = boostedProduction(active, rooms, bonuses);
  const ratio = (gardeners * BALANCE.care.perGardener) / full;
  return full * (1 - Math.exp(-ratio));
}

/**
 * Nettoertrag je Sekunde: was durchkommt, mal Preis, minus Strom. Genau die
 * Zahl, die der Spieler oben rechts sieht - und damit die richtige Messlatte
 * fuer jeden Kauf.
 */
function netRate(
  sim: Sim, plants: number, gardeners: number, sellers: number, rooms: readonly number[],
): number {
  const price = levelPrice(sim.level);
  const b = sim.bonuses;
  const out = outputWith(plants, gardeners, rooms, b) + EPS;
  const sold = sellers * BALANCE.sell.sellRate * salesFactor(b) + EPS;
  const upkeep = billedPotential(rooms) * price * BALANCE.upkeep.share * upkeepFactor(b);
  // WEICHES MINIMUM statt min(): (a*b)/(a+b). Es verhaelt sich wie das
  // Minimum, sobald eine Seite deutlich kleiner ist, hat aber keine Kante -
  // deshalb bringt jeder Kauf etwas, und zwar immer weniger, je weiter die
  // Seite schon vorn liegt.
  //
  // Mit einem harten min() plus Trostpreis fuer die grosse Seite lief die
  // Verkaufskette davon: gemessen 1.02 Mrd Absatz gegen 75 k Ernte, also das
  // Dreizehntausendfache dessen, was je gebraucht wurde. Der Trostpreis wuchs
  // mit, das Minimum nicht.
  return ((out * sold) / (out + sold)) * price - upkeep;
}

/**
 * Wie viele Pflanzen in einem Zeithorizont dazukaemen, wenn zurueckgelegt
 * wird. Ohne diese Schaetzung waere ein neuer Raum immer wertlos: im Moment
 * des Kaufs steht er leer, und die Bewertung saehe nur die Stromrechnung.
 */
function plantsAfter(sim: Sim, rooms: readonly number[]): number {
  const seats = boostedSeats(rooms, sim.bonuses);
  const have = sim.plants + sim.seedlings;
  if (have >= seats) return seats;
  // Wachstumsrate je Pflanze: was sie erntet, geteilt durch den Stecklingspreis.
  const perPlant = sim.activePlants() > 0
    ? sim.capacity() / sim.activePlants()
    : roomQuality(0);
  const rate = (perPlant * 0.9) / sim.seedCost();
  const lag = HORIZON / (1 + BALANCE.plant.growSeconds / HORIZON);
  return Math.min(seats, have * Math.exp(rate * lag));
}

interface Option {
  decision: Decision;
  gain: number;   // zusaetzlicher Nettoertrag je Sekunde
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
 * Die Reglerstellung eines vernuenftigen Spielers: zuruecklegen, solange
 * Plaetze frei sind, sonst verkaufen.
 *
 * Bewusst grob. Ob ein Mensch mit Voraussicht (vor dem Raumkauf saeen) besser
 * faehrt, ist genau die Frage, die der Messlauf beantworten soll - deshalb
 * darf die Messlatte hier nicht schon optimal spielen.
 */
export function tuneSeedShare(sim: Sim): void {
  const have = sim.plants + sim.seedlings;
  sim.setSeedShare(have < sim.seats() ? 0.9 : 0);
}

/**
 * Eine Kaufentscheidung. Jede Option wird durchgerechnet: was waere der
 * Nettoertrag danach? Der groesste Zugewinn je Euro gewinnt.
 */
export function decide(sim: Sim, opts: AutoplayOptions = {}): Decision {
  // Haende benutzen und TROTZDEM weiter einkaufen. Vorher stand hier ein
  // return: solange kein Gaertner da war, wurde nur geklickt und nie einer
  // gekauft - der Lauf haengte sechs Stunden in der ersten Minute fest.
  if (opts.useHands !== false) useHands(sim);
  if (opts.tuneSeed !== false) tuneSeedShare(sim);

  const cash = sim.cash;
  const plants = sim.plants;
  const gardeners = sim.gardeners();
  const sellers = sim.sellers();
  const before = netRate(sim, plants, gardeners, sellers, sim.rooms);

  // Lager laeuft ueber und es liegt wirklich am Lager: dann zuerst das.
  if (sim.storage >= sim.storageCap() * 0.95 && sim.output() > sim.sellRate()) {
    if (cash.gte(sim.storageCost()) && sim.buyStorage()) return { kind: 'storage' };
  }

  const options: Option[] = [];
  const add = (decision: Decision, after: number, cost: number): void => {
    const gain = after - before;
    if (gain > 0 && cost > 0 && cash.gte(cost)) options.push({ decision, gain, cost });
  };

  for (let tier = 0; tier < sim.unlockedTiers('cook'); tier++) {
    const more = reachAfter(tier, HORIZON);
    add({ kind: 'unit', chain: 'cook', tier },
      netRate(sim, plants, gardeners + more, sellers, sim.rooms),
      sim.unitCost('cook', tier).toNumber());
  }

  for (let tier = 0; tier < sim.unlockedTiers('sell'); tier++) {
    const more = reachAfter(tier, HORIZON);
    add({ kind: 'unit', chain: 'sell', tier },
      netRate(sim, plants, gardeners, sellers + more, sim.rooms),
      sim.unitCost('sell', tier).toNumber());
  }

  for (let tier = 0; tier < sim.unlockedRooms(); tier++) {
    const rooms = [...sim.rooms];
    rooms[tier] = (rooms[tier] ?? 0) + 1;
    add({ kind: 'room', tier },
      netRate(sim, plantsAfter(sim, rooms), gardeners, sellers, rooms),
      sim.roomCost(tier).toNumber());
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

/**
 * Wie eng liegen die besten Optionen beieinander? Ist die zweitbeste Wahl fast
 * so gut wie die beste, hat der Spieler wirklich etwas zu entscheiden; ist sie
 * weit weg, rechnet er nur nach. Das ist die Messgroesse "Entscheidungsdichte"
 * aus TIEFE.md, Abschnitt 5.
 */
export function closeness(sim: Sim): number | null {
  const plants = sim.plants;
  const gardeners = sim.gardeners();
  const sellers = sim.sellers();
  const before = netRate(sim, plants, gardeners, sellers, sim.rooms);
  const scores: number[] = [];

  const push = (after: number, cost: number): void => {
    const gain = after - before;
    if (gain > 0 && cost > 0) scores.push(gain / cost);
  };

  for (let tier = 0; tier < sim.unlockedTiers('cook'); tier++) {
    push(netRate(sim, plants, gardeners + reachAfter(tier, HORIZON), sellers, sim.rooms),
      sim.unitCost('cook', tier).toNumber());
  }
  for (let tier = 0; tier < sim.unlockedTiers('sell'); tier++) {
    push(netRate(sim, plants, gardeners, sellers + reachAfter(tier, HORIZON), sim.rooms),
      sim.unitCost('sell', tier).toNumber());
  }
  for (let tier = 0; tier < sim.unlockedRooms(); tier++) {
    const rooms = [...sim.rooms];
    rooms[tier] = (rooms[tier] ?? 0) + 1;
    push(netRate(sim, plantsAfter(sim, rooms), gardeners, sellers, rooms),
      sim.roomCost(tier).toNumber());
  }

  if (scores.length < 2) return null;
  scores.sort((a, b) => b - a);
  return scores[1]! / scores[0]!;
}

/** Ticken und entscheiden, bis das Spiel durch ist oder die Zeit reicht. */
export function playThrough(sim: Sim, limitSeconds = 40 * 3600, opts: AutoplayOptions = {}): void {
  while (!sim.finished && sim.time < limitSeconds) {
    sim.tick();
    decide(sim, opts);
  }
}

export { TIERS };
