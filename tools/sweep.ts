/**
 * Balance-Sweep: dreht einzelne Konstanten und misst die Design-Ziele.
 * Ziele: Gesamtdauer 5-8 h, keine Stufe ueber 45 min, idle langsamer als aktiv.
 */
import { BALANCE } from '../src/core/balance.js';
import { Sim } from '../src/core/sim.js';
import { maxLevel } from '../src/core/world.js';
import { siteCount } from '../src/core/production.js';
import type { PILOT_TRAITS } from '../src/core/policy.js';

function decide(sim: Sim): void {
  if (sim.marketsSaturated()) { sim.levelUp(); return; }
  if (sim.storage >= sim.storageCap() * 0.9 && sim.buyStorage()) return;
  let best = -1, bestPayback = Infinity;
  for (let tier = 0; tier < sim.unlockedTiers() && tier < siteCount(); tier++) {
    if (!sim.canBuySite(tier)) continue;
    const p = sim.paybackSeconds(tier);
    if (p < bestPayback) { bestPayback = p; best = tier; }
  }
  if (best >= 0) { sim.buySite(best); return; }
  sim.buyParcel();
}

export function measure(pilot: keyof typeof PILOT_TRAITS, seed = 1) {
  const marks: number[] = [];
  const sim = new Sim({ seed, pilot, onEvent: e => { if (e.type === 'levelUp') marks.push(e.at); } });
  while (!sim.finished && sim.time < 40 * 3600) { sim.tick(); decide(sim); }
  let longest = 0, previous = 0;
  for (const at of marks) { longest = Math.max(longest, at - previous); previous = at; }
  return { hours: sim.time / 3600, longestMinutes: longest / 60, finished: sim.finished };
}

const label = (v: number) => v.toFixed(3).padStart(6);
BALANCE.production.costGrowth = 1.115;
console.log('outMult | upgradeSec | aktiv h | idle h | Faktor | laengste | ok?');
for (const outputTierMult of [13.5, 13.2, 13.0, 12.8]) {
  for (const upgradeSeconds of [900, 1100, 1300]) {
    BALANCE.production.outputTierMult = outputTierMult;
    BALANCE.levels.upgradeSeconds = upgradeSeconds;
    const active = measure('human');
    const idle = measure('s0');
    const ok = active.finished && active.hours >= 5 && active.hours <= 8
      && idle.hours <= 8.5 && active.longestMinutes <= 45 && idle.hours > active.hours;
    console.log(
      label(outputTierMult), ' |', String(upgradeSeconds).padStart(10), '|',
      active.hours.toFixed(2).padStart(7), '|', idle.hours.toFixed(2).padStart(6), '|',
      (idle.hours / active.hours).toFixed(2).padStart(6), '|',
      (active.longestMinutes.toFixed(0) + ' min').padStart(8), '|', ok ? 'JA' : '-');
  }
}
