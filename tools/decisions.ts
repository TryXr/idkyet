/**
 * Misst, ob im Spiel wirklich etwas zu ENTSCHEIDEN ist - die Frage aus
 * TIEFE.md, Abschnitt 5.
 *
 * Drei Messungen:
 *
 *   1. DER REGLER. Wie weit kommt man mit einer festen Stellung, wie weit mit
 *      einer, die sich anpasst? Ist eine feste Stellung genauso gut, ist der
 *      Regler Deko und muss schaerfer werden.
 *   2. WO DAS OPTIMUM LIEGT. Kippt es wirklich mit jedem Raumkauf, wie in
 *      CLAUDE.md behauptet, oder steht es die ganze Zeit still?
 *   3. ENTSCHEIDUNGSDICHTE. Wie oft liegen die beiden besten Kaufoptionen
 *      dicht genug beieinander, dass die Wahl nicht bloss Nachrechnen ist.
 *   4. WAS DIE SORTEN AENDERN. Sehen zwei Durchlaeufe verschieden aus, und
 *      kauft man in ihnen Verschiedenes?
 *
 * Gemessen wird gegen dieselbe Kaufpolitik wie ueberall sonst - ein eigener
 * Autoplay hier haette schon einmal ein anderes Spiel gemessen (BALANCING.md).
 */
import { BALANCE } from '../src/core/balance.js';
import { Sim } from '../src/core/sim.js';
import { closeness, decide, tuneSeedShare } from './autoplay.js';

const LIMIT = 40 * 3600;

/** Ein Durchlauf mit fester Reglerstellung. */
function fixedShare(share: number, seed = 1): { hours: number; finished: boolean } {
  const sim = new Sim({ seed });
  while (!sim.finished && sim.time < LIMIT) {
    sim.setSeedShare(share);
    sim.tick();
    decide(sim, { tuneSeed: false });
  }
  return { hours: sim.time / 3600, finished: sim.finished };
}

/** Ein Durchlauf mit der anpassenden Politik: zuruecklegen, solange Platz ist. */
function adaptive(seed = 1): { hours: number; finished: boolean } {
  const sim = new Sim({ seed });
  while (!sim.finished && sim.time < LIMIT) { sim.tick(); decide(sim); }
  return { hours: sim.time / 3600, finished: sim.finished };
}

/**
 * Ein Spieler mit VORAUSSICHT: er legt schon zurueck, bevor der neue Raum
 * steht - sobald er ihn sich bald leisten kann. Genau der Vorteil, den ein
 * aufmerksamer Mensch gegenueber der Faustregel haben soll.
 */
function foresighted(seed = 1): { hours: number; finished: boolean } {
  const sim = new Sim({ seed });
  while (!sim.finished && sim.time < LIMIT) {
    const seats = sim.seats();
    const have = sim.plants + sim.seedlings;
    if (have < seats) {
      sim.setSeedShare(0.9);
    } else {
      // Raum voll. Trotzdem schon saeen, wenn der naechste Raum bald bezahlt
      // ist - dann steht er nicht leer herum und frisst Strom. Aber nur zur
      // Haelfte: das Geld fuer den Raum muss ja auch noch hereinkommen.
      const next = sim.unlockedRooms() - 1;
      const soon = sim.secondsUntil(sim.roomCost(next)) < 120;
      sim.setSeedShare(soon ? 0.5 : 0);
    }
    sim.tick();
    decide(sim, { tuneSeed: false });
  }
  return { hours: sim.time / 3600, finished: sim.finished };
}

console.log('=== 1. Der Regler: feste Stellung gegen mitdenkende ===\n');
const runs: Array<[string, { hours: number; finished: boolean }]> = [
  ['fest 0 % (alles verkaufen)', fixedShare(0)],
  ['fest 30 %', fixedShare(0.3)],
  ['fest 60 %', fixedShare(0.6)],
  ['fest 90 %', fixedShare(0.9)],
  ['angepasst (Faustregel)', adaptive()],
  ['mit Voraussicht', foresighted()],
];
for (const [label, result] of runs) {
  console.log(`  ${label.padEnd(28)} ${result.finished
    ? `${result.hours.toFixed(2)} h`
    : `NICHT DURCH (${result.hours.toFixed(1)} h abgebrochen)`}`);
}

const best = runs.filter(([, r]) => r.finished).sort((a, b) => a[1].hours - b[1].hours)[0];
const fixedBest = runs.filter(([l, r]) => l.startsWith('fest') && r.finished)
  .sort((a, b) => a[1].hours - b[1].hours)[0];
const adaptiveRun = runs.find(([l]) => l.startsWith('angepasst'))![1];
console.log(`\n  Bester Lauf:            ${best?.[0] ?? '-'}`);
if (fixedBest && adaptiveRun.finished) {
  const edge = fixedBest[1].hours / adaptiveRun.hours;
  console.log(`  Mitdenken gegen starr:  Faktor ${edge.toFixed(2)}` +
    ` (${fixedBest[0]} ${fixedBest[1].hours.toFixed(2)} h)`);
}

// --- 2. Wo das Optimum liegt ----------------------------------------------
console.log('\n=== 2. Kippt das Optimum? Reglerstellung der Faustregel ueber die Zeit ===\n');
{
  const sim = new Sim({ seed: 1 });
  let flips = 0;
  let previous = -1;
  const perLevel = new Map<number, { back: number; sell: number }>();
  while (!sim.finished && sim.time < LIMIT) {
    sim.tick();
    decide(sim);
    const stat = perLevel.get(sim.level) ?? { back: 0, sell: 0 };
    if (sim.seedShare > 0.5) stat.back++; else stat.sell++;
    perLevel.set(sim.level, stat);
    const state = sim.seedShare > 0.5 ? 1 : 0;
    if (previous !== -1 && state !== previous) flips++;
    previous = state;
  }
  console.log('  Ebene   zurueckgelegt   verkauft');
  for (const [level, stat] of [...perLevel.entries()].sort((a, b) => a[0] - b[0])) {
    const total = stat.back + stat.sell;
    console.log(`  ${String(level).padStart(5)}   ${
      `${((100 * stat.back) / total).toFixed(0)} %`.padStart(13)}   ${
      `${((100 * stat.sell) / total).toFixed(0)} %`.padStart(8)}`);
  }
  console.log(`\n  Das Optimum kippt ${flips}× im ganzen Durchlauf` +
    ` (${(flips / (sim.time / 3600)).toFixed(0)}× je Stunde).`);
}

// --- 3. Entscheidungsdichte ------------------------------------------------
console.log('\n=== 3. Entscheidungsdichte: wie dicht liegen die besten Optionen? ===\n');
{
  const sim = new Sim({ seed: 1 });
  let samples = 0;
  let close = 0;
  let sum = 0;
  while (!sim.finished && sim.time < LIMIT) {
    sim.tick();
    decide(sim);
    if (sim.time % 10 !== 0) continue;
    const ratio = closeness(sim);
    if (ratio === null) continue;
    samples++;
    sum += ratio;
    if (ratio >= 0.9) close++;
  }
  const share = samples > 0 ? close / samples : 0;
  console.log(`  Stichproben:                 ${samples}`);
  console.log(`  Zweitbeste im Schnitt bei:   ${((sum / Math.max(1, samples)) * 100).toFixed(0)} % der besten`);
  console.log(`  Davon innerhalb von 10 %:    ${(share * 100).toFixed(0)} %`);
  console.log(`\n  Ziel laut TIEFE.md: mindestens 30 %.` +
    ` ${share >= 0.3 ? 'ERREICHT' : 'NICHT erreicht'}`);
}

// --- 4. Was die Sorten aendern --------------------------------------------
/**
 * Der Punkt, um den es bei E2 wirklich geht: aus 120 gleichen Belohnungen
 * werden 120 verschiedene (TIEFE.md, Befund 1.5). Pruefbar ist das an zwei
 * Zahlen - laufen verschiedene Seeds auseinander, und kaufen sie Verschiedenes?
 *
 * Die zweite Frage ist die haertere. Ein Vorteil, der ueberall gleich wirkt,
 * verschiebt zwar das Tempo, aber nicht die Rangfolge der Kaufoptionen. Genau
 * das ist der Grund, warum die Sorten die Entscheidungsdichte oben NICHT heben.
 */
console.log('\n=== 4. Was die Sorten ändern ===\n');
{
  const profile = (seed: number) => {
    const sim = new Sim({ seed });
    const spend = { cook: 0, sell: 0, room: 0, storage: 0 };
    while (!sim.finished && sim.time < LIMIT) {
      const before = sim.cash;
      sim.tick();
      const decision = decide(sim);
      if (decision.kind === 'wait' || decision.kind === 'hand') continue;
      const paid = before.sub(sim.cash).toNumber();
      if (paid > 0) spend[decision.kind === 'unit' ? decision.chain! : decision.kind] += paid;
    }
    const total = spend.cook + spend.sell + spend.room + spend.storage;
    return { hours: sim.time / 3600, rooms: spend.room / total, bonuses: sim.bonuses };
  };

  const seeds = [1, 2, 3, 4, 5];
  for (const power of [0, BALANCE.strain.power]) {
    BALANCE.strain.power = power;
    const runs = seeds.map(profile);
    const hours = runs.map(r => r.hours);
    const spread = Math.max(...hours) / Math.min(...hours);
    console.log(`  Sortenstärke ${power.toFixed(2)}:`);
    for (const [i, run] of runs.entries()) {
      console.log(`    Seed ${seeds[i]}  ${run.hours.toFixed(2)} h` +
        `  ·  Ertrag ×${(1 + run.bonuses.yield).toFixed(2)}` +
        `  Plätze ×${(1 + run.bonuses.seats).toFixed(2)}` +
        `  Absatz ×${(1 + run.bonuses.sales).toFixed(2)}` +
        `  ·  ${(run.rooms * 100).toFixed(0)} % des Geldes in Räume`);
    }
    console.log(`    Streuung zwischen den Seeds: Faktor ${spread.toFixed(2)}\n`);
  }
  console.log('  Streuen die Durchläufe, sehen zwei Partien verschieden aus.');
  console.log('  Bleibt der Anteil "Geld in Räume" gleich, kauft man trotzdem dasselbe -');
  console.log('  dann verschieben die Sorten das Tempo, nicht die Kaufentscheidung.');
}
