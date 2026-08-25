/**
 * Balance-Sweep: dreht einzelne Konstanten und misst die Design-Ziele.
 * Ziele: Gesamtdauer 5-8 h, keine Stufe ueber 45 min, idle langsamer als aktiv,
 * und Land muss im Spaetspiel WIRKLICH knapp werden - sonst faellt der
 * thematische Grund fuers Weltall weg.
 */
import { BALANCE } from '../src/core/balance.js';
import { Sim } from '../src/core/sim.js';
import { ownedFraction, parcelPool } from '../src/core/land.js';
import type { PILOT_TRAITS } from '../src/core/policy.js';
import { decide } from './autoplay.js';

export function measure(pilot: keyof typeof PILOT_TRAITS, seed = 1) {
  const marks: number[] = [];
  const sim = new Sim({ seed, pilot, onEvent: e => { if (e.type === 'levelUp') marks.push(e.at); } });
  while (!sim.finished && sim.time < 40 * 3600) { sim.tick(); decide(sim); }
  let longest = 0, shortest = Infinity, previous = 0;
  for (const at of marks) {
    const span = at - previous;
    longest = Math.max(longest, span);
    shortest = Math.min(shortest, span);
    previous = at;
  }
  return {
    hours: sim.time / 3600,
    longestMinutes: longest / 60,
    shortestMinutes: shortest / 60,
    landFraction: ownedFraction(sim.parcels, parcelPool(sim.level)),
    finished: sim.finished,
  };
}

console.log('poolMult | upgradeSec | aktiv h | idle h | Faktor | kuerzeste-laengste | Land | ok?');
for (const poolMult of [1.5, 1.8, 2.1, 2.5]) {
  for (const upgradeSeconds of [1400, 1600, 1800]) {
    BALANCE.land.poolMult = poolMult;
    BALANCE.levels.upgradeSeconds = upgradeSeconds;
    const active = measure('human');
    const idle = measure('s0');
    const ok = active.finished && idle.finished
      && active.hours >= 5 && active.hours <= 8
      && idle.hours <= 8.5 && idle.hours > active.hours
      && active.longestMinutes <= 45;
    console.log(
      String(poolMult).padStart(8), '|', String(upgradeSeconds).padStart(10), '|',
      active.hours.toFixed(2).padStart(7), '|', idle.hours.toFixed(2).padStart(6), '|',
      (idle.hours / active.hours).toFixed(2).padStart(6), '|',
      `${active.shortestMinutes.toFixed(0)}-${active.longestMinutes.toFixed(0)} min`.padStart(18), '|',
      `${(active.landFraction * 100).toFixed(1)}%`.padStart(6), '|', ok ? 'JA' : '-');
  }
}
