/**
 * Das Anzeigemodell: aus der Simulation wird eine Liste fertig formatierter
 * Zeilen und Knoepfe. Kein DOM, keine Pixi, kein Zustand.
 *
 * Warum getrennt vom Bedienfeld: so laesst sich die Bedienung headless pruefen -
 * "gibt es hier ueberhaupt etwas zu tun?", "steht an jedem Kauf eine Wartezeit?"
 * sind Fragen an dieses Modell, nicht an den Browser. Die Abnahme von M5 (ein
 * Fremder spielt 20 min ohne Erklaerung) haengt genau daran, und ein Test, der
 * einen Browser braucht, wuerde nie laufen.
 */
import { BALANCE } from '../core/balance.js';
import { fmt, fmtTime, type Num } from '../core/numbers.js';
import {
  milestoneMultiplier, nextMilestone, siteArea, siteCount, siteName, siteOutput,
} from '../core/production.js';
import { levelName, maxLevel } from '../core/world.js';
import { CONFIG } from '../core/config.js';
import { isSellable } from '../core/market.js';
import { BLOCKED, ENDING, HINTS, PILOT_DESCRIPTIONS, PILOT_MANUAL, WARNINGS } from '../content/texts.js';
import type { Sim } from '../core/sim.js';

// --- Aktionen -------------------------------------------------------------

/** Alles, was der Spieler ausloesen kann. Bewusst Daten statt Funktionen:
 *  dadurch bleibt das Modell rein und der Test kann Aktionen nachspielen. */
export type UiAction =
  | { kind: 'site'; tier: number; count: number }
  | { kind: 'land'; count: number }
  | { kind: 'storage' }
  | { kind: 'pilot' }
  | { kind: 'levelUp' };

export function applyAction(sim: Sim, action: UiAction): boolean {
  switch (action.kind) {
    case 'site':    return sim.buySiteWithLand(action.tier, action.count) > 0;
    case 'land':    return sim.buyParcels(action.count) > 0;
    case 'storage': return sim.buyStorage();
    case 'pilot':   return sim.buyPilot();
    case 'levelUp': return sim.levelUp();
  }
}

// --- Formen ---------------------------------------------------------------

export interface BuyOption {
  label: string;
  action: UiAction;
  cost: Num;
  costText: string;
  /** Land, das bei diesem Kauf mitbezahlt wird. 0 = keins noetig. */
  parcels: number;
  enabled: boolean;
}

export interface SiteRow {
  tier: number;
  name: string;
  owned: number;
  areaText: string;
  gainText: string;          // was die naechste Einheit bringt
  shareText: string;         // Anteil an der Produktion
  milestoneText: string | null;
  best: boolean;             // schnellste Amortisation
  visible: boolean;          // spaete Stufen blenden Kleinkram aus
  waitText: string;
  blocked: string | null;
  buys: BuyOption[];
}

export interface Meter {
  label: string;
  value: string;
  fill: number;              // 0..1
  warn: boolean;
  hint: string;
}

export interface PilotStep {
  name: string;
  description: string;
  owned: boolean;
  costText: string;
}

export interface ViewModel {
  levelName: string;
  levelIndexText: string;
  /** Was ein Klick auf die Karte gerade bedeutet - das aendert sich mit S0. */
  mapHint: string;
  /** Handbetrieb: was der naechste Klick ausliefern wuerde. */
  manual: { active: boolean; ready: number; readyText: string };
  cashText: string;
  rateText: string;
  playTimeText: string;
  warnings: string[];
  meters: Meter[];
  facts: Array<[string, string]>;
  sites: SiteRow[];
  hiddenSites: number;
  land: {
    ownedText: string;
    freeAreaText: string;
    fraction: number;
    soldOut: boolean;
    waitText: string;
    buys: BuyOption[];
  };
  storage: {
    fillText: string;
    fill: number;
    stalled: boolean;
    bufferText: string;
    waitText: string;
    buy: BuyOption;
  };
  pilot: {
    currentText: string;
    steps: PilotStep[];
    manualWarning: boolean;
    next: BuyOption | null;
    waitText: string;
  };
  levelUp: {
    label: string;
    saturation: number;
    saturationText: string;
    waitText: string;
    finished: boolean;
    buy: BuyOption | null;
  };
  /** Nur am Ende gesetzt: die Bilanz. */
  ending: Ending | null;
}

export interface Ending {
  title: string;
  lead: string;
  closing: string;
  demo: boolean;
  tally: Array<[string, string]>;
}

// --- Hilfen ---------------------------------------------------------------

/** "Zeit bis zum naechsten Kauf" - Pflichtfeature laut CLAUDE.md. */
export function whenText(seconds: number): string {
  if (seconds <= 0) return 'jetzt';
  if (!Number.isFinite(seconds)) return 'kein Ertrag';
  // Alles jenseits der Spiellaenge ist keine Auskunft mehr, sondern Rauschen -
  // "in 129065115 h" hat niemandem je geholfen.
  if (seconds > 12 * 3600) return 'nicht absehbar';
  return `in ${fmtTime(seconds)}`;
}

/** Flaechen laufen ueber acht Groessenordnungen - ab km² wird es lesbar. */
export function fmtArea(m2: number): string {
  if (m2 < 1_000_000) return `${fmt(m2, 0)} m²`;
  return `${fmt(m2 / 1_000_000)} km²`;
}

const BULK_STEPS = [1, 10] as const;

function buyOption(
  sim: Sim, label: string, action: UiAction, cost: Num, parcels: number,
): BuyOption {
  return {
    label,
    action,
    cost,
    costText: fmt(cost),
    parcels,
    enabled: sim.cash.gte(cost),
  };
}

// --- Aufbau ---------------------------------------------------------------

function siteRows(sim: Sim): SiteRow[] {
  const total = sim.output().toNumber();
  let best = -1;
  let bestPayback = Infinity;
  for (let t = 0; t < sim.unlockedTiers(); t++) {
    const payback = sim.paybackSeconds(t);
    if (payback < bestPayback) { bestPayback = payback; best = t; }
  }

  let lowestUnowned = -1;
  for (let t = 0; t < sim.unlockedTiers(); t++) {
    if ((sim.owned[t] ?? 0) === 0) { lowestUnowned = t; break; }
  }

  const rows: SiteRow[] = [];
  for (let tier = 0; tier < sim.unlockedTiers(); tier++) {
    const owned = sim.owned[tier] ?? 0;
    const each = siteOutput(tier);
    // Was die naechste Einheit WIRKLICH bringt - Meilensteine multiplizieren
    // den ganzen Bestand, nicht nur die neue Einheit.
    const gain = each.mul((owned + 1) * milestoneMultiplier(owned + 1) - owned * milestoneMultiplier(owned));
    const share = total > 0 ? each.mul(owned * milestoneMultiplier(owned)).toNumber() / total : 0;

    const maxCount = sim.affordableSitesWithLand(tier);
    const buys: BuyOption[] = [];
    for (const count of BULK_STEPS) {
      const parcels = sim.parcelsNeededFor(tier, count);
      const cost = sim.siteTotalCost(tier, count);
      const fits = sim.parcels + parcels <= sim.parcelPool();
      const option = buyOption(sim, `${count}×`, { kind: 'site', tier, count }, cost, parcels);
      buys.push({ ...option, enabled: option.enabled && fits });
    }
    if (maxCount > BULK_STEPS[BULK_STEPS.length - 1]!) {
      buys.push(buyOption(
        sim, `Max ${maxCount}×`, { kind: 'site', tier, count: maxCount },
        sim.siteTotalCost(tier, maxCount), sim.parcelsNeededFor(tier, maxCount),
      ));
    }

    const first = buys[0]!;
    const wait = sim.secondsUntil(first.cost);
    const needsParcels = sim.parcelsNeededFor(tier, 1);
    const landGone = sim.parcels + needsParcels > sim.parcelPool();
    const nextStone = nextMilestone(owned);

    const negligible = owned > 0 && share < 0.005 && tier !== best;
    const tooFar = owned === 0 && wait > 1800 && tier !== lowestUnowned;

    rows.push({
      tier,
      name: siteName(tier),
      owned,
      areaText: siteArea(tier) === 0 ? 'kein Land nötig' : fmtArea(siteArea(tier)),
      gainText: `+${fmt(gain)} Ware/s`,
      shareText: owned > 0 ? `${(share * 100).toFixed(0)} % der Produktion` : 'noch keiner',
      milestoneText: nextStone ? `noch ${nextStone - owned} bis ×${BALANCE.production.milestoneMult}` : null,
      best: tier === best,
      visible: !negligible && !tooFar,
      waitText: whenText(wait),
      blocked: landGone ? BLOCKED.landGone : first.enabled ? null : BLOCKED.cash,
      buys,
    });
  }
  return rows;
}

function landPart(sim: Sim): ViewModel['land'] {
  const pool = sim.parcelPool();
  const free = pool - sim.parcels;
  const maxCount = sim.affordableParcels();
  const buys: BuyOption[] = [];
  for (const count of BULK_STEPS) {
    const take = Math.min(count, free);
    // parcels bleibt 0: der Zusatz "inklusive Land" gilt dem Ortskauf. Hier
    // waere er albern - man kauft ja gerade Land.
    const option = buyOption(
      sim, `${count}×`, { kind: 'land', count }, sim.parcelBulkCost(count), 0,
    );
    buys.push({ ...option, enabled: option.enabled && take === count });
  }
  if (maxCount > BULK_STEPS[BULK_STEPS.length - 1]!) {
    buys.push(buyOption(
      sim, `Max ${maxCount}×`, { kind: 'land', count: maxCount },
      sim.parcelBulkCost(maxCount), 0,
    ));
  }
  return {
    ownedText: `${sim.parcels} von ${pool} Parzellen`,
    freeAreaText: fmtArea(sim.freeArea()),
    fraction: Math.min(1, sim.parcels / pool),
    soldOut: free <= 0,
    waitText: whenText(sim.secondsUntil(sim.nextParcelCost())),
    buys,
  };
}

function storagePart(sim: Sim): ViewModel['storage'] {
  const cap = sim.storageCap();
  const seconds = BALANCE.storage.bufferSeconds *
    Math.pow(BALANCE.storage.bufferPerLevel, sim.storageLevel);
  const cost = sim.storageCost();
  return {
    fillText: `${fmt(sim.storage)} / ${fmt(cap)} Ware`,
    fill: cap > 0 ? Math.min(1, sim.storage / cap) : 0,
    stalled: cap > 0 && sim.storage >= cap * 0.999,
    bufferText: `${fmtTime(seconds)} Puffer`,
    waitText: whenText(sim.secondsUntil(cost)),
    buy: buyOption(sim, 'Lager vergrößern', { kind: 'storage' }, cost, 0),
  };
}

function pilotPart(sim: Sim): ViewModel['pilot'] {
  const steps: PilotStep[] = BALANCE.pilots.map((entry, i) => ({
    name: entry.name,
    description: PILOT_DESCRIPTIONS[i] ?? '',
    owned: sim.pilotLevel > i,
    costText: fmt(entry.cost),
  }));
  const next = sim.nextPilot();
  return {
    currentText: sim.pilotLevel === 0
      ? PILOT_MANUAL
      : `${BALANCE.pilots[sim.pilotLevel - 1]!.name} – ${PILOT_DESCRIPTIONS[sim.pilotLevel - 1] ?? ''}`,
    steps,
    manualWarning: sim.pilotLevel === 0,
    next: next ? buyOption(sim, next.name, { kind: 'pilot' }, next.cost, 0) : null,
    waitText: next ? whenText(sim.secondsUntil(next.cost)) : 'ausgebaut',
  };
}

function levelUpPart(sim: Sim): ViewModel['levelUp'] {
  const finished = sim.level >= maxLevel();
  const cost = sim.levelUpCost();
  const saturation = sim.capacity() > 0 ? sim.output().toNumber() / sim.capacity() : 0;
  return {
    label: finished ? 'Geschafft' : `Weiter nach ${levelName(sim.level + 1)}`,
    saturation: Math.min(1, saturation),
    saturationText: `${(Math.min(1, saturation) * 100).toFixed(0)} % der Märkte hier bedient`,
    waitText: finished ? '' : whenText(sim.secondsUntil(cost)),
    finished,
    buy: finished ? null : buyOption(sim, 'Reichweite ausbauen', { kind: 'levelUp' }, cost, 0),
  };
}

/**
 * Die Schlussbilanz. Sie ist die einzige Belohnung am Ende - deshalb steht hier,
 * was der Spieler wirklich getan hat, nicht eine Punktzahl.
 */
function endingPart(sim: Sim): Ending | null {
  if (!sim.finished) return null;

  let sites = 0;
  let biggest = 0;
  for (let tier = 0; tier < siteCount(); tier++) {
    const count = sim.owned[tier] ?? 0;
    sites += count;
    if (count > 0) biggest = tier;
  }

  return {
    title: CONFIG.demo ? ENDING.demoTitle : ENDING.title,
    lead: CONFIG.demo ? ENDING.demoLead : ENDING.lead,
    closing: CONFIG.demo ? ENDING.demoClosing : ENDING.closing,
    demo: CONFIG.demo,
    tally: [
      ['Gespielt', fmtTime(sim.time)],
      ['Zuletzt beliefert', levelName(sim.level)],
      ['Herstellorte gebaut', `${sites}`],
      ['Größter Ort', siteName(biggest)],
      ['Land in Besitz', `${sim.parcels} Parzellen (${fmtArea(sim.parcels * BALANCE.land.parcelArea)})`],
      ['Produktion zuletzt', `${fmt(sim.output())} Ware/s`],
      ['Umsatz insgesamt', fmt(sim.lifetime)],
    ],
  };
}

export function buildViewModel(sim: Sim): ViewModel {
  const sites = siteRows(sim);
  const storage = storagePart(sim);
  const levelUp = levelUpPart(sim);
  const land = landPart(sim);

  const sellable = sim.nodes.filter(isSellable).length;
  const locked = sim.nodes.filter(n => n.lockedFor > 0).length;
  const off = sim.nodes.filter(n => !n.enabled).length;

  // Im Handbetrieb ist die naechste Handlung immer dieselbe: ausliefern.
  // Deshalb steht sie ganz oben und verdraengt alle anderen Hinweise.
  const ready = sim.hasAutopilot() ? 0 : sim.storage;
  const manual = {
    active: !sim.hasAutopilot(),
    ready,
    readyText: `${fmt(ready)} Ware bereit`,
  };

  // Ist das Spiel durch, sind alle Hinweise gegenstandslos: "liefere aus" ist
  // nach der Schlussbilanz kein Rat mehr, sondern ein Fehler.
  const warnings: string[] = [];
  if (!sim.finished) {
    if (manual.active && ready > 0) warnings.push(WARNINGS.deliver);
    if (storage.stalled) warnings.push(WARNINGS.storageFull);
    if (sellable === 0) warnings.push(WARNINGS.allLocked);
    if (levelUp.saturation >= 0.95 && !levelUp.finished) warnings.push(WARNINGS.saturated);
    if (sim.pilotLevel === 0) warnings.push(WARNINGS.noPilot);
  }

  return {
    levelName: levelName(sim.level),
    levelIndexText: `Stufe ${sim.level} von ${maxLevel()}`,
    mapHint: manual.active ? HINTS.mapManual : HINTS.map,
    manual,
    cashText: fmt(sim.cash),
    rateText: `${fmt(sim.incomeRate)} / s`,
    playTimeText: fmtTime(sim.time),
    warnings,
    meters: [
      {
        label: 'Märkte hier',
        value: levelUp.saturationText,
        fill: levelUp.saturation,
        warn: levelUp.saturation >= 0.95,
        hint: 'Produktion gegen das, was diese Reichweite aufnimmt.',
      },
      {
        label: 'Lager',
        value: storage.fillText,
        fill: storage.fill,
        warn: storage.stalled,
        hint: 'Volles Lager stoppt die Produktion.',
      },
      {
        label: 'Land',
        value: `${(land.fraction * 100).toFixed(1)} % – ${land.freeAreaText} frei`,
        fill: land.fraction,
        warn: land.soldOut,
        hint: 'Gekauftes Land dieser Stufe.',
      },
    ],
    facts: [
      ['Produktion', `${fmt(sim.output())} Ware/s`],
      ['Gebiete offen', `${sellable} von ${sim.nodes.length}`],
      ['gesperrt / aus', `${locked} / ${off}`],
      ['Spielzeit', fmtTime(sim.time)],
    ],
    // Alle Zeilen, samt Sichtbarkeitsflagge: das Bedienfeld hat einen Schalter
    // "alles zeigen", und zweimal zu rechnen waere Unsinn.
    sites,
    hiddenSites: sites.filter(row => !row.visible).length,
    land,
    storage,
    pilot: pilotPart(sim),
    levelUp,
    ending: endingPart(sim),
  };
}
