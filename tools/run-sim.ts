/**
 * Regressionslauf. Prueft die DESIGN-ZIELE, nicht die alte Ueberschlagstabelle:
 * das Knotenmodell ist genauer als die Rechnung, aus der die frueheren
 * Sollzeiten stammten.
 *
 *   Gesamtdauer aktiv   5 - 8 h
 *   Gesamtdauer idle    <= 8.5 h und langsamer als aktiv
 *   keine Einzelstufe   > 50 min
 *
 * Laeuft bei jeder Aenderung an balance.ts mit (siehe PLAN.md, Risiken).
 */
import { Sim } from '../src/core/sim.js';
import { levelName, maxLevel } from '../src/core/world.js';
import { fmt } from '../src/core/numbers.js';
import { siteCount } from '../src/core/production.js';
import type { PILOT_TRAITS } from '../src/core/policy.js';

const TARGET = { minHours: 5, maxHours: 8, maxIdleHours: 8.5, maxLevelMinutes: 50 };

/** Kaufpolitik eines vernuenftigen Spielers. */
function decide(sim: Sim): void {
  if (sim.marketsSaturated()) { sim.levelUp(); return; }
  if (sim.storage >= sim.storageCap() * 0.9 && sim.buyStorage()) return;
  let best = -1, bestPayback = Infinity;
  for (let tier = 0; tier < sim.unlockedTiers() && tier < siteCount(); tier++) {
    if (!sim.canBuySite(tier)) continue;
    const payback = sim.paybackSeconds(tier);
    if (payback < bestPayback) { bestPayback = payback; best = tier; }
  }
  if (best >= 0) { sim.buySite(best); return; }
  sim.buyParcel();
}

function play(pilot: keyof typeof PILOT_TRAITS, seed = 1) {
  const marks = new Map<number, number>();
  const sim = new Sim({ seed, pilot, onEvent: e => { if (e.type === 'levelUp') marks.set(e.level, e.at); } });
  while (!sim.finished && sim.time < 40 * 3600) { sim.tick(); decide(sim); }
  let longest = 0, previous = 0;
  for (let level = 1; level <= maxLevel(); level++) {
    const at = marks.get(level);
    if (at !== undefined) { longest = Math.max(longest, at - previous); previous = at; }
  }
  return { sim, marks, longestMinutes: longest / 60 };
}

const runs = [
  ['aktiv (Mensch, 30 s)', 'human'],
  ['idle S3 (Statthalter ausgebaut)', 's3'],
  ['idle S0 (roher Autopilot)', 's0'],
] as const;

const results = new Map<string, ReturnType<typeof play>>();
for (const [label, pilot] of runs) {
  const result = play(pilot);
  results.set(pilot, result);
  console.log(`\n=== ${label} ===`);
  let previous = 0;
  for (let level = 1; level <= maxLevel(); level++) {
    const at = result.marks.get(level);
    if (at === undefined) { console.log(`  ${String(level).padStart(2)} ${levelName(level).padEnd(16)} NICHT ERREICHT`); continue; }
    console.log(`  ${String(level).padStart(2)} ${levelName(level).padEnd(16)}` +
      ` ${(at / 3600).toFixed(2).padStart(5)} h  (+${((at - previous) / 60).toFixed(0).padStart(3)} min)`);
    previous = at;
  }
  console.log(`  -> ${result.sim.finished ? 'DURCH' : 'ABGEBROCHEN'} nach ${(result.sim.time / 3600).toFixed(2)} h,` +
    ` Bargeld ${fmt(result.sim.cash)}, Parzellen ${result.sim.parcels}`);
}

const active = results.get('human')!;
const idle = results.get('s0')!;
const activeHours = active.sim.time / 3600;
const idleHours = idle.sim.time / 3600;

const checks: Array<[string, boolean, string]> = [
  ['Durchspielbar (aktiv)', active.sim.finished, active.sim.finished ? 'ja' : 'nein'],
  ['Durchspielbar (idle)', idle.sim.finished, idle.sim.finished ? 'ja' : 'nein'],
  [`Dauer aktiv ${TARGET.minHours}-${TARGET.maxHours} h`,
    activeHours >= TARGET.minHours && activeHours <= TARGET.maxHours, `${activeHours.toFixed(2)} h`],
  [`Dauer idle <= ${TARGET.maxIdleHours} h`, idleHours <= TARGET.maxIdleHours, `${idleHours.toFixed(2)} h`],
  ['Aktiv schneller als idle', idleHours > activeHours, `Faktor ${(idleHours / activeHours).toFixed(2)}`],
  [`Laengste Stufe <= ${TARGET.maxLevelMinutes} min`,
    active.longestMinutes <= TARGET.maxLevelMinutes, `${active.longestMinutes.toFixed(0)} min`],
];

console.log('\n--- Abnahme M1 ---');
let allPassed = true;
for (const [label, passed, value] of checks) {
  if (!passed) allPassed = false;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(32)} ${value}`);
}
console.log(`\nM1 ${allPassed ? 'BESTANDEN' : 'NICHT bestanden'}`);
process.exit(allPassed ? 0 : 1);
