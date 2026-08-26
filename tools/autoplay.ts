/**
 * Kaufpolitik eines vernuenftigen Spielers, gemeinsam genutzt von Regressions-
 * lauf, Sweep, Diagnose und Speichertest. Vorher stand dieselbe Logik viermal
 * leicht unterschiedlich herum - dadurch massen die Werkzeuge verschiedene
 * Spiele.
 *
 * Wichtig: Land wird im SAMMELKAUF beschafft. Eine Parzelle pro Tick liess den
 * Spieler bis zu 53% einer Zoomstufe an der Flaeche haengen (siehe Diagnose).
 */
import type { Sim } from '../src/core/sim.js';
import { siteArea, siteOutput } from '../src/core/production.js';
import { isSellable, nodePrice } from '../src/core/market.js';

export interface AutoplayOptions {
  /** Statthalter selbst kaufen. Fuer Messlaeufe aus, dort ist die Politik gesetzt. */
  buyPilots?: boolean;
}

export interface Decision {
  kind: 'pilot' | 'levelUp' | 'storage' | 'site' | 'land' | 'wait';
  tier?: number;
  count?: number;
  /** Der gewuenschte Kauf scheiterte nur an fehlender Flaeche. */
  areaBlocked?: boolean;
}

/**
 * Von Hand ausliefern, solange kein Statthalter angestellt ist.
 *
 * Gehoert hierher und nicht in die Simulation: es ist eine SPIELERHANDLUNG.
 * Ohne sie steht jeder Messlauf ohne Politik-Vorgabe still, denn im Handbetrieb
 * verkauft niemand ausser dem Spieler - genau das ist der Sinn der ersten
 * Minute. Geliefert wird ins lohnendste offene Gebiet.
 */
export function handSell(sim: Sim): number {
  if (sim.hasAutopilot()) return 0;
  let best = -1;
  let bestValue = -1;
  for (const node of sim.nodes) {
    if (!isSellable(node)) continue;
    const value = nodePrice(node) * node.p * node.demand;
    if (value > bestValue) { bestValue = value; best = node.id; }
  }
  return best >= 0 ? sim.deliver(best) : 0;
}

export function decide(sim: Sim, opts: AutoplayOptions = {}): Decision {
  handSell(sim);
  if (opts.buyPilots && sim.buyPilot()) return { kind: 'pilot' };

  // Maerkte ausgereizt: nichts mehr bauen, auf die naechste Stufe sparen.
  if (sim.marketsSaturated()) {
    return sim.levelUp() ? { kind: 'levelUp' } : { kind: 'wait' };
  }

  if (sim.storage >= sim.storageCap() * 0.9 && sim.buyStorage()) {
    return { kind: 'storage' };
  }

  // Bestes Angebot nach Amortisation - erst ohne Ruecksicht auf die Flaeche,
  // damit wir erkennen, ob nur Land fehlt.
  let best = -1;
  let bestPayback = Infinity;
  for (let tier = 0; tier < sim.unlockedTiers(); tier++) {
    const payback = sim.paybackSeconds(tier);
    if (payback < bestPayback) { bestPayback = payback; best = tier; }
  }
  if (best < 0) return { kind: 'wait' };

  const area = siteArea(best);

  if (area > sim.freeArea()) {
    // Gleich Flaeche fuer mehrere Einheiten kaufen, sonst wechselt der Spieler
    // staendig zwischen einer Parzelle und einem Gebaeude hin und her.
    const bought = sim.buyParcelsForArea(area * 25);
    if (bought > 0) return { kind: 'land', count: bought, areaBlocked: true };

    // Kein Land mehr zu haben: auf den besten Ort ausweichen, der noch passt.
    // Genau das ist der Kipppunkt im Spiel - ab hier zaehlt Ertrag pro FLAECHE
    // statt Ertrag pro Geld, und flaechenlose Orte (Frachtschiff,
    // Orbitalstation) werden attraktiv.
    let fallback = -1;
    let fallbackPayback = Infinity;
    for (let tier = 0; tier < sim.unlockedTiers(); tier++) {
      if (siteArea(tier) > sim.freeArea()) continue;
      const payback = sim.paybackSeconds(tier);
      if (payback < fallbackPayback) { fallbackPayback = payback; fallback = tier; }
    }
    if (fallback < 0) return { kind: 'wait', areaBlocked: true };
    best = fallback;
  }

  if (sim.canBuySite(best)) {
    // NICHT ueber die Kapazitaet der Stufe hinaus bauen. Was die Maerkte nicht
    // aufnehmen, bleibt im Lager, stoppt die Produktion und ist damit totes
    // Kapital. Ohne diese Bremse kaufte der Messlauf am Stufenanfang 25 Stueck
    // auf einmal und lag danach beim 3.5-fachen dessen, was die Stufe abnimmt -
    // ein Verhalten, das kein Spieler zeigen wuerde, der das Bedienfeld liest.
    const room = sim.capacity() * 1.15 - sim.output().toNumber();
    const perUnit = siteOutput(best).toNumber();
    const byRoom = perUnit > 0 ? Math.floor(room / perUnit) : 25;
    const count = Math.max(1, Math.min(sim.affordableSites(best), 25, byRoom));
    const bought = sim.buySites(best, count);
    if (bought > 0) return { kind: 'site', tier: best, count: bought };
  }

  return { kind: 'wait' };
}

/** Ticken und entscheiden, bis das Spiel durch ist oder die Zeit reicht. */
export function playThrough(sim: Sim, limitSeconds = 40 * 3600, opts: AutoplayOptions = {}): void {
  while (!sim.finished && sim.time < limitSeconds) {
    sim.tick();
    decide(sim, opts);
  }
}
