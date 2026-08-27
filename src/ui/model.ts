/**
 * Das Anzeigemodell: aus der Simulation wird eine Liste fertig formatierter
 * Abschnitte, Zeilen und Knoepfe. Kein DOM, keine Pixi, kein Zustand.
 *
 * Warum getrennt vom Bedienfeld: so laesst sich die Bedienung headless pruefen -
 * "gibt es hier ueberhaupt etwas zu tun?", "steht an jedem Kauf eine Wartezeit?"
 * sind Fragen an dieses Modell, nicht an den Browser. Ein Test, der einen
 * Browser braucht, wuerde nie laufen.
 *
 * Alle Abschnitte haben dieselbe Form (Zeilen mit Kaufknoepfen). Dadurch ist
 * das Bedienfeld ein einziger generischer Renderer statt vier handgebauter.
 */
import { BALANCE } from '../core/balance.js';
import { fmt, fmtTime, type Num } from '../core/numbers.js';
import { CONFIG } from '../core/config.js';
import {
  milestoneMultiplier, nextMilestone, TIERS, unitName, type ChainKey,
} from '../core/chains.js';
import { roomName, roomQuality, roomSeats } from '../core/rooms.js';
import { fraction, missing, type Territory } from '../core/territory.js';
import { levelName, levelPrice, maxLevel } from '../core/world.js';
import { ENDING, HANDS, HINTS, SEED, WARNINGS } from '../content/texts.js';
import type { Sim } from '../core/sim.js';

// --- Aktionen -------------------------------------------------------------

/** Alles, was der Spieler ausloesen kann. Bewusst Daten statt Funktionen:
 *  dadurch bleibt das Modell rein und der Test kann Aktionen nachspielen. */
export type UiAction =
  | { kind: 'cook' }
  | { kind: 'sell' }
  | { kind: 'unit'; chain: ChainKey; tier: number; count: number }
  | { kind: 'room'; tier: number; count: number }
  | { kind: 'storage' }
  | { kind: 'seed'; share: number }
  | { kind: 'target'; id: number | null };

export function applyAction(sim: Sim, action: UiAction): boolean {
  switch (action.kind) {
    case 'cook':    return sim.cookByHand() > 0;
    case 'sell':    return sim.sellByHand() > 0;
    case 'unit':    return sim.buyUnits(action.chain, action.tier, action.count) > 0;
    case 'room':    return sim.buyRooms(action.tier, action.count) > 0;
    case 'storage': return sim.buyStorage();
    case 'seed':    sim.setSeedShare(action.share); return true;
    case 'target':  sim.setTarget(action.id); return true;
  }
}

// --- Formen ---------------------------------------------------------------

export interface BuyOption {
  label: string;
  action: UiAction;
  cost: Num;
  costText: string;
  enabled: boolean;
}

export interface Row {
  key: string;
  name: string;
  /** Bestand, z.B. "12×". Leer, wenn es noch keinen gibt. */
  count: string;
  /** Was die Zeile leistet. */
  facts: string;
  /** Meilenstein oder Hinweis, warum es gerade klemmt. */
  note: string | null;
  waitText: string;
  highlight: boolean;
  buys: BuyOption[];
}

export interface Section {
  key: string;
  title: string;
  hint: string;
  rows: Row[];
}

export interface Meter {
  label: string;
  value: string;
  fill: number;
  warn: boolean;
  hint: string;
}

export interface TargetView {
  id: number;
  name: string;
  fraction: number;
  fractionText: string;
  missingText: string;
  priceText: string;
  rentText: string;
  etaText: string;
}

/**
 * Der Regler. Ein einziges Bedienelement, das keinem der Abschnitte gleicht -
 * deshalb bekommt er eine eigene Form statt einer erzwungenen Kaufzeile.
 */
export interface SeedView {
  title: string;
  hint: string;
  /** Anteil, der zurueckgelegt wird, 0 bis 1. */
  share: number;
  backLabel: string;
  sellLabel: string;
  /** Was gerade daraus wird, in Worten. */
  facts: string;
}

export interface Ending {
  title: string;
  lead: string;
  closing: string;
  demo: boolean;
  tally: Array<[string, string]>;
}

export interface ViewModel {
  levelName: string;
  levelIndexText: string;
  mapHint: string;
  cashText: string;
  rateText: string;
  hands: {
    /** Nur zeigen, solange es noch etwas von Hand zu tun gibt. */
    visible: boolean;
    hint: string;
    cook: BuyOption;
    sell: BuyOption;
  };
  warnings: string[];
  meters: Meter[];
  seed: SeedView;
  target: TargetView | null;
  sections: Section[];
  facts: Array<[string, string]>;
  ending: Ending | null;
}

// --- Hilfen ---------------------------------------------------------------

/** "Zeit bis zum naechsten Kauf" - Pflichtfeature laut CLAUDE.md. */
export function whenText(seconds: number): string {
  if (seconds <= 0) return 'jetzt';
  if (!Number.isFinite(seconds)) return 'kein Ertrag';
  // Alles jenseits der Spiellaenge ist keine Auskunft mehr, sondern Rauschen.
  if (seconds > 12 * 3600) return 'nicht absehbar';
  return `in ${fmtTime(seconds)}`;
}

const BULK_STEPS = [1, 10] as const;

function option(sim: Sim, label: string, action: UiAction, cost: Num): BuyOption {
  return { label, action, cost, costText: fmt(cost), enabled: sim.cash.gte(cost) };
}

/** Die drei Kaufknoepfe einer Zeile: einer, zehn, so viele wie moeglich. */
function buyRow(
  sim: Sim, make: (count: number) => UiAction, cost: (count: number) => Num, max: number,
): BuyOption[] {
  const buys = BULK_STEPS.map(count => option(sim, `${count}×`, make(count), cost(count)));
  if (max > BULK_STEPS[BULK_STEPS.length - 1]!) {
    buys.push(option(sim, `Max ${max}×`, make(max), cost(max)));
  }
  return buys;
}

// --- Abschnitte -----------------------------------------------------------

function chainSection(sim: Sim, chain: ChainKey): Section {
  const list = chain === 'cook' ? sim.cook : sim.sell;
  const rows: Row[] = [];

  for (let tier = 0; tier < sim.unlockedTiers(chain); tier++) {
    const count = Math.floor(list[tier] ?? 0);
    const max = sim.affordableUnits(chain, tier);
    const stone = nextMilestone(count);

    // Was eine weitere Einheit bringt: Stufe 0 arbeitet, alle darueber stellen ein.
    const facts = tier === 0
      ? (chain === 'cook'
        ? `pflegt ${fmt(BALANCE.care.perGardener)} Ernte/s`
        : `setzt ${fmt(BALANCE.sell.sellRate)} Ernte/s ab`)
      : `stellt ${unitName(chain, tier - 1)} ein`;

    rows.push({
      key: `${chain}-${tier}`,
      name: unitName(chain, tier),
      count: count > 0 ? `${count}×` : '',
      facts,
      note: stone ? `noch ${stone - count} bis ×${BALANCE.chain.milestoneMult}` : null,
      waitText: whenText(sim.secondsUntil(sim.unitCost(chain, tier))),
      highlight: tier === 0 && count === 0,
      buys: buyRow(sim,
        c => ({ kind: 'unit', chain, tier, count: c }),
        c => sim.unitBulkCost(chain, tier, c), max),
    });
  }

  return {
    key: chain,
    title: chain === 'cook' ? 'Pflege' : 'Verkaufen',
    hint: chain === 'cook' ? HINTS.cook : HINTS.sell,
    rows,
  };
}

function roomSection(sim: Sim): Section {
  const rows: Row[] = [];
  const idle = sim.idle();
  const unlocked = sim.unlockedRooms();
  const seats = sim.seats();

  for (let tier = 0; tier < unlocked; tier++) {
    const count = sim.rooms[tier] ?? 0;

    // Alte Raeume ausblenden, sobald sie nichts mehr beitragen. Sonst steht auf
    // der letzten Ebene eine Wand aus fuenfzig Knoepfen, in der das Badezimmer
    // genauso breit ist wie die Mondbasis.
    const share = seats > 0 ? (count * roomSeats(tier)) / seats : 0;
    const newest = tier >= unlocked - 2;
    if (!newest && share < 0.04) continue;

    const max = sim.affordableRooms(tier);
    rows.push({
      key: `room-${tier}`,
      name: roomName(tier),
      count: count > 0 ? `${count}×` : '',
      facts: `${roomSeats(tier)} Plätze · ${fmt(roomQuality(tier))} Ernte/s je Pflanze`,
      note: count > 0 ? `${count * roomSeats(tier)} Plätze insgesamt` : null,
      waitText: whenText(sim.secondsUntil(sim.roomCost(tier))),
      highlight: idle > 0 && tier === sim.unlockedRooms() - 2,
      buys: buyRow(sim,
        c => ({ kind: 'room', tier, count: c }),
        c => sim.roomBulkCost(tier, c), max),
    });
  }

  return { key: 'rooms', title: 'Räume', hint: HINTS.rooms, rows };
}

function storageSection(sim: Sim): Section {
  const cost = sim.storageCost();
  const seconds = BALANCE.storage.bufferSeconds *
    Math.pow(BALANCE.storage.bufferPerLevel, sim.storageLevel);
  return {
    key: 'storage',
    title: 'Lager',
    hint: HINTS.storage,
    rows: [{
      key: 'storage',
      name: 'Lager vergrößern',
      count: `Stufe ${sim.storageLevel + 1}`,
      facts: `${fmt(sim.storage)} / ${fmt(sim.storageCap())} Ernte · ${fmtTime(seconds)} Puffer`,
      note: null,
      waitText: whenText(sim.secondsUntil(cost)),
      highlight: false,
      buys: [option(sim, 'Ausbauen', { kind: 'storage' }, cost)],
    }],
  };
}

// --- Ziel und Ende --------------------------------------------------------

function targetView(sim: Sim, territory: Territory | null): TargetView | null {
  if (!territory) return null;
  const rest = missing(territory);
  const rate = Math.min(sim.output(), sim.sellRate());
  return {
    id: territory.id,
    name: territory.lost ? `${territory.name} (zurückholen)` : territory.name,
    fraction: fraction(territory),
    fractionText: `${(fraction(territory) * 100).toFixed(1)} % versorgt`,
    missingText: `noch ${fmt(rest)} Ernte`,
    priceText: `${fmt(territory.price)} je Gramm`,
    rentText: `${fmt(territory.rent)} / s Rente`,
    etaText: rate > 0 ? whenText(rest / rate) : 'kein Nachschub',
  };
}

/**
 * Der Regler und was er gerade anrichtet. Die Beschriftung nennt beide Seiten
 * in denselben Einheiten - Pflanzen gegen Bargeld -, denn genau das ist die
 * Abwaegung, und sie soll nicht im Kopf ausgerechnet werden muessen.
 */
function seedView(sim: Sim): SeedView {
  const harvest = sim.output();
  const back = harvest * sim.seedShare;
  const perMinute = back > 0 ? (back * 60) / sim.seedCost() : 0;
  const cash = (harvest - back) * levelPrice(sim.level);
  return {
    title: SEED.title,
    hint: HINTS.seed,
    share: sim.seedShare,
    backLabel: SEED.back,
    sellLabel: SEED.sell,
    facts: harvest > 0
      ? `${fmt(perMinute)} Pflanzen/min · ${fmt(cash)} / s`
      : 'noch keine Ernte',
  };
}

function endingPart(sim: Sim): Ending | null {
  if (!sim.finished) return null;
  let rooms = 0;
  let biggest = 0;
  for (let tier = 0; tier < sim.rooms.length; tier++) {
    const count = sim.rooms[tier] ?? 0;
    rooms += count;
    if (count > 0) biggest = tier;
  }
  return {
    title: CONFIG.demo ? ENDING.demoTitle : ENDING.title,
    lead: CONFIG.demo ? ENDING.demoLead : ENDING.lead,
    closing: CONFIG.demo ? ENDING.demoClosing : ENDING.closing,
    demo: CONFIG.demo,
    tally: [
      ['Gespielt', fmtTime(sim.time)],
      ['Zuletzt übernommen', levelName(sim.level)],
      ['Gebiete übernommen', `${(maxLevel() + 1) * BALANCE.levels.perLevel}`],
      ['Räume gebaut', `${rooms}`],
      ['Größter Raum', roomName(biggest)],
      ['Pflanzen', fmt(sim.plants)],
      ['Gärtner', String(Math.floor(sim.cook[0] ?? 0))],
      ['Verkäufer', String(Math.floor(sim.sell[0] ?? 0))],
      ['Rente', `${fmt(sim.rentPerSecond())} / s`],
      ['Umsatz insgesamt', fmt(sim.lifetime)],
    ],
  };
}

// --- Aufbau ---------------------------------------------------------------

export function buildViewModel(sim: Sim): ViewModel {
  const target = sim.target();
  const output = sim.output();
  const absatz = sim.sellRate();
  const cap = sim.storageCap();
  const stalled = cap > 0 && sim.storage >= cap * 0.999 && output > absatz;
  const idle = sim.idle();

  // Die Haende verschwinden, sobald beide Ketten laufen - Klicken ist
  // Tutorial, kein Dauerzustand (CLAUDE.md).
  const handsVisible = !sim.finished && ((sim.cook[0] ?? 0) < 1 || (sim.sell[0] ?? 0) < 1);

  const warnings: string[] = [];
  if (!sim.finished) {
    if (sim.powerShare < 0.999) warnings.push(WARNINGS.unpaid);
    if (stalled) warnings.push(WARNINGS.storageFull);
    if (idle > 0) warnings.push(WARNINGS.idleWorkers);
    // Erst warnen, wenn wirklich etwas brachliegt - und erst, wenn der Betrieb
    // ueberhaupt laeuft. In der ersten Minute steht im Badezimmer eine Pflanze
    // auf zwei Plaetzen; das ist der Startzustand, kein Fehler, und eine
    // Warnung darauf waere das erste, was ein Neuling zu lesen bekommt.
    if (!handsVisible && sim.emptySeats() > sim.seats() * 0.4) {
      warnings.push(WARNINGS.emptySeats);
    }
    // Die Konkurrenz wird NAMENTLICH gemeldet, sobald es eng wird. Eine
    // Warnung ohne Ortsnamen waere keine - der Spieler soll wissen, wohin er
    // liefern muss, nicht nur, dass irgendwo etwas passiert.
    const threatened = sim.territories
      .filter(t => !t.owned && t.demand > 0 && t.rival / t.demand > 0.7)
      .sort((a, b) => b.rival / b.demand - a.rival / a.demand)[0];
    if (threatened) warnings.push(`${WARNINGS.rivalClose} ${threatened.name}`);

    if (absatz <= 0 && sim.storage > 0) warnings.push(WARNINGS.noSellers);
    if ((sim.cook[0] ?? 0) < 1 && !handsVisible) warnings.push(WARNINGS.noWorkers);
  }

  return {
    levelName: levelName(sim.level),
    levelIndexText: `Ebene ${sim.level + 1} von ${maxLevel() + 1}`,
    mapHint: HINTS.map,
    cashText: fmt(sim.cash),
    rateText: `${fmt(sim.incomeRate)} / s`,
    hands: {
      visible: handsVisible,
      hint: HANDS.hint,
      cook: {
        label: HANDS.cook,
        action: { kind: 'cook' },
        cost: sim.cash,
        costText: `+${fmt(BALANCE.manual.cookPortion * roomQuality(0) *
          Math.max(1, Math.min(sim.plants, sim.seats())))} Ernte`,
        enabled: sim.storage < cap,
      },
      sell: {
        label: HANDS.sell,
        action: { kind: 'sell' },
        cost: sim.cash,
        costText: sim.storage > 0 ? `${fmt(sim.storage)} Ernte` : HANDS.sellBlocked,
        enabled: sim.storage > 0 && target !== null,
      },
    },
    warnings,
    meters: [
      {
        label: 'Ebene',
        value: `${sim.territories.filter(t => t.owned).length} von ${sim.territories.length} übernommen`,
        fill: sim.levelProgress(),
        warn: false,
        hint: 'Alle Gebiete dieser Ebene, dann zoomt die Karte heraus.',
      },
      {
        label: 'Pflanzen',
        value: `${fmt(sim.plants)} auf ${sim.seats()} Plätzen` +
          (sim.seedlings >= 0.05 ? ` · ${fmt(sim.seedlings)} reifen` : ''),
        fill: sim.seats() > 0 ? Math.min(1, sim.plants / sim.seats()) : 0,
        warn: idle > 0,
        hint: 'Pflanzen kommen nur aus der eigenen Ernte. Leere Plätze kosten trotzdem Strom.',
      },
      {
        label: 'Lager',
        value: `${fmt(sim.storage)} / ${fmt(cap)} · Güte ${(sim.grade() * 100).toFixed(0)} %`,
        fill: cap > 0 ? Math.min(1, sim.storage / cap) : 0,
        warn: stalled,
        hint: 'Volles Lager stoppt die Ernte. Die Güte sagt, wie gut deine Pflanzen stehen.',
      },
      {
        label: 'Durchsatz',
        value: `${fmt(output)} geerntet · ${fmt(absatz)} verkauft je s`,
        fill: absatz > 0 ? Math.min(1, output / absatz) : 0,
        warn: output <= 0 || absatz <= 0,
        hint: 'Die kleinere der beiden Zahlen bestimmt, wie schnell es vorangeht.',
      },
    ],
    seed: seedView(sim),
    target: targetView(sim, target),
    sections: [
      chainSection(sim, 'cook'),
      roomSection(sim),
      chainSection(sim, 'sell'),
      storageSection(sim),
    ],
    facts: [
      ['Gärtner', `${Math.floor(sim.cook[0] ?? 0)} · Pflege ${(sim.care() * 100).toFixed(0)} %`],
      ['Verkäufer', String(Math.floor(sim.sell[0] ?? 0))],
      ['Strom', `${fmt(sim.upkeepRate())} / s`],
      ['Rente', `${fmt(sim.rentPerSecond())} / s`],
      ['Spielzeit', fmtTime(sim.time)],
    ],
    ending: endingPart(sim),
  };
}

/** Die Gebiete fuer Karte und Liste. */
export function territoryRows(sim: Sim): Array<{
  id: number; name: string; fraction: number; owned: boolean; isTarget: boolean;
  rival: number; lost: boolean;
}> {
  const target = sim.target();
  return sim.territories.map(t => ({
    id: t.id,
    name: t.name,
    fraction: fraction(t),
    owned: t.owned,
    isTarget: target?.id === t.id,
    rival: t.demand > 0 ? Math.min(1, t.rival / t.demand) : 0,
    lost: t.lost,
  }));
}

export { TIERS, milestoneMultiplier };
