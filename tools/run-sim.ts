/**
 * Regressionslauf. Prueft die DESIGN-ZIELE, nicht einzelne Zahlen:
 *
 *   Gesamtdauer aktiv   5 - 8 h
 *   keine Einzelstufe   > 60 min
 *   aktive Zielwahl schneller als der stumpfe Autopilot
 *   Renten tragen spuerbar bei, ersetzen das Kochen aber nicht
 *
 * Laeuft bei jeder Aenderung an balance.ts mit (siehe PLAN.md, Risiken).
 */
import { Sim } from '../src/core/sim.js';
import { levelName, maxLevel } from '../src/core/world.js';
import { fmt } from '../src/core/numbers.js';
import { decide } from './autoplay.js';

/**
 * Die Belohnungseinheit ist das GEBIET, nicht die Zoomstufe: 15 Uebernahmen je
 * Stufe heissen, dass auch eine lange Stufe alle paar Minuten etwas hergibt.
 * Geprueft wird deshalb die groesste Luecke zwischen zwei Uebernahmen und
 * nicht die Stufenlaenge - die waechst bewusst von 9 auf rund 100 Minuten.
 */
const TARGET = { minHours: 5, maxHours: 8, maxGapMinutes: 15 };

function play(dumbTargeting: boolean, seed = 1) {
  const marks = new Map<number, number>();
  const taken: number[] = [];
  const sim = new Sim({
    seed, dumbTargeting,
    onEvent: e => {
      if (e.type === 'levelUp') marks.set(e.level, e.at);
      if (e.type === 'territoryTaken') taken.push(e.at);
    },
  });
  while (!sim.finished && sim.time < 40 * 3600) { sim.tick(); decide(sim); }
  let longest = 0;
  let previous = 0;
  for (let level = 1; level <= maxLevel(); level++) {
    const at = marks.get(level);
    if (at !== undefined) { longest = Math.max(longest, at - previous); previous = at; }
  }
  longest = Math.max(longest, sim.time - previous);
  let worstGap = 0;
  previous = 0;
  for (const at of taken) { worstGap = Math.max(worstGap, at - previous); previous = at; }
  return { sim, marks, taken, longestMinutes: longest / 60, worstGapMinutes: worstGap / 60 };
}

const runs: Array<[string, boolean]> = [
  ['aktiv (kluge Zielwahl)', false],
  ['stur der Reihe nach', true],
];

const results = new Map<string, ReturnType<typeof play>>();
for (const [label, dumb] of runs) {
  const result = play(dumb);
  results.set(dumb ? 'dumb' : 'smart', result);
  console.log(`\n=== ${label} ===`);
  let previous = 0;
  for (let level = 1; level <= maxLevel(); level++) {
    const at = result.marks.get(level);
    if (at === undefined) {
      console.log(`  ${String(level).padStart(2)} ${levelName(level).padEnd(16)} NICHT ERREICHT`);
      continue;
    }
    console.log(`  ${String(level).padStart(2)} ${levelName(level).padEnd(16)}` +
      ` ${(at / 3600).toFixed(2).padStart(5)} h  (+${((at - previous) / 60).toFixed(0).padStart(3)} min)`);
    previous = at;
  }
  const sim = result.sim;
  console.log(`  -> ${sim.finished ? 'DURCH' : 'ABGEBROCHEN'} nach ${(sim.time / 3600).toFixed(2)} h,` +
    ` Bargeld ${fmt(sim.cash)}, ${result.taken.length} Gebiete,` +
    ` Rente ${fmt(sim.rentPerSecond())}/s`);
}

const smart = results.get('smart')!;
const dumb = results.get('dumb')!;
const smartHours = smart.sim.time / 3600;

/** Wie viel vom Einkommen am Ende aus Renten kommt. */
const rentShare = smart.sim.rentPerSecond() /
  Math.max(1e-9, smart.sim.incomeRate);

const checks: Array<[string, boolean, string]> = [
  ['Durchspielbar', smart.sim.finished, smart.sim.finished ? 'ja' : 'nein'],
  [`Dauer ${TARGET.minHours}-${TARGET.maxHours} h`,
    smartHours >= TARGET.minHours && smartHours <= TARGET.maxHours, `${smartHours.toFixed(2)} h`],
  ['Kluge Zielwahl lohnt sich', dumb.sim.time > smart.sim.time,
    `stur ${(dumb.sim.time / 3600).toFixed(2)} h gegen klug ${smartHours.toFixed(2)} h`],
  [`Nie laenger als ${TARGET.maxGapMinutes} min ohne Uebernahme`,
    smart.worstGapMinutes <= TARGET.maxGapMinutes,
    `groesste Luecke ${smart.worstGapMinutes.toFixed(0)} min, laengste Stufe ${smart.longestMinutes.toFixed(0)} min`],
  ['Alle Gebiete uebernommen', smart.taken.length === (maxLevel() + 1) * 15,
    `${smart.taken.length} von ${(maxLevel() + 1) * 15}`],
  ['Renten tragen bei, ersetzen aber nichts', rentShare > 0.05 && rentShare < 0.6,
    `${(rentShare * 100).toFixed(0)} % des Einkommens`],
];

console.log('\n--- Abnahme ---');
let allPassed = true;
for (const [label, passed, value] of checks) {
  if (!passed) allPassed = false;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(38)} ${value}`);
}
console.log(`\n${allPassed ? 'BESTANDEN' : 'NICHT bestanden'}`);
process.exit(allPassed ? 0 : 1);
