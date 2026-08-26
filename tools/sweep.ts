/**
 * Balance-Sweep: dreht einzelne Konstanten und misst die Design-Ziele.
 * Ziele: Gesamtdauer 5-8 h, keine Stufe ueber 45 min, idle langsamer als aktiv,
 * und Land muss im Spaetspiel WIRKLICH knapp werden - sonst faellt der
 * thematische Grund fuers Weltall weg.
 *
 * Seit M6 wird zusaetzlich die ENTSCHEIDUNGSDICHTE gemessen: wie viele Kaeufe
 * fallen je Stufe, und wie viel Zeit vergeht nur mit Sparen. Ein Spiel, das je
 * Stufe einen einzigen Knopf braucht, ist kein Spiel, sondern eine Wartezeit
 * (siehe BALANCING.md, Abschnitt 10).
 */
import { BALANCE } from '../src/core/balance.js';
import { Sim } from '../src/core/sim.js';
import { ownedFraction, parcelPool } from '../src/core/land.js';
import type { PILOT_TRAITS } from '../src/core/policy.js';
import { decide } from './autoplay.js';

export function measure(pilot: keyof typeof PILOT_TRAITS, seed = 1) {
  const marks: number[] = [];
  const sim = new Sim({ seed, pilot, onEvent: e => { if (e.type === 'levelUp') marks.push(e.at); } });
  let buys = 0;
  let savingSeconds = 0;
  while (!sim.finished && sim.time < 40 * 3600) {
    sim.tick();
    const decision = decide(sim);
    if (decision.kind === 'wait') savingSeconds++; else buys++;
  }
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
    firstLevelMinutes: (marks[0] ?? 0) / 60,
    secondLevelMinutes: ((marks[1] ?? 0) - (marks[0] ?? 0)) / 60,
    buysPerLevel: buys / Math.max(1, marks.length),
    savingShare: savingSeconds / Math.max(1, sim.time),
    landFraction: ownedFraction(sim.parcels, parcelPool(sim.level)),
    finished: sim.finished,
  };
}

const defaults = {
  milestones: [...BALANCE.production.milestones],
  costGrowth: BALANCE.production.costGrowth,
  poolMult: BALANCE.land.poolMult,
  upgradeSeconds: BALANCE.levels.upgradeSeconds,
  upgradeSeconds0: BALANCE.levels.upgradeSeconds0,
  upgradeRamp: BALANCE.levels.upgradeRamp,
};

function restore(): void {
  BALANCE.production.milestones = [...defaults.milestones];
  BALANCE.production.costGrowth = defaults.costGrowth;
  BALANCE.land.poolMult = defaults.poolMult;
  BALANCE.levels.upgradeSeconds = defaults.upgradeSeconds;
  BALANCE.levels.upgradeSeconds0 = defaults.upgradeSeconds0;
  BALANCE.levels.upgradeRamp = defaults.upgradeRamp;
}

console.log('=== Land und Aufstiegskosten ===');
console.log('poolMult | upgradeSec | aktiv h | idle h | Faktor | kuerzeste-laengste | Land | ok?');
for (const poolMult of [1.5, 1.8, 2.1, 2.5]) {
  for (const upgradeSeconds of [1400, 1600, 1800]) {
    restore();
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

/**
 * Die Rampe der Aufstiegskosten. Sie bestimmt, wie lang eine Stufe dauert -
 * ausgereizt ist eine Stufe lange vorher, der Rest ist Sparen auf den Aufstieg.
 *
 * Gesucht: vorne kurz (die erste Stufe unter 10 min, sonst steht der Neuling
 * eine halbe Stunde vor drei Knoepfen), hinten lang, aber keine Stufe ueber
 * 45 min, und die Summe muss die Gesamtdauer bei 5-8 h halten.
 *
 * NICHT gefunden: ein Hebel gegen die duenne Entscheidungsdichte. Meilensteine
 * (25/50/100/200 gegen 10/25/50/100 gegen 5/15/40/100) und costGrowth (1.115
 * bis 1.07) wurden durchgemessen und bewegen die Kaeufe je Stufe kaum
 * (6.4 bis 8.1). Die Ursache liegt tiefer - siehe BALANCING.md, Abschnitt 10.
 */
console.log('\n=== Rampe der Aufstiegskosten ===');
console.log('start | rampe | deckel | aktiv h | idle h | Stufe 0 | Stufe 1 | laengste | Kaeufe/Stufe | ok?');
for (const upgradeSeconds0 of [350, 420]) {
  for (const upgradeRamp of [1.35, 1.45, 1.55]) {
    for (const cap of [1750, 1900]) {
      restore();
      BALANCE.levels.upgradeSeconds0 = upgradeSeconds0;
      BALANCE.levels.upgradeRamp = upgradeRamp;
      BALANCE.levels.upgradeSeconds = cap;
      const active = measure('human');
      const idle = measure('s0');
      const ok = active.finished && idle.finished
        && active.hours >= 5 && active.hours <= 8
        && idle.hours > active.hours
        && active.longestMinutes <= 45
        && active.firstLevelMinutes <= 10;
      console.log(
        String(upgradeSeconds0).padStart(5), '|',
        upgradeRamp.toFixed(2).padStart(5), '|', String(cap).padStart(6), '|',
        active.hours.toFixed(2).padStart(7), '|', idle.hours.toFixed(2).padStart(6), '|',
        `${active.firstLevelMinutes.toFixed(0)} min`.padStart(7), '|',
        `${active.secondLevelMinutes.toFixed(0)} min`.padStart(7), '|',
        `${active.longestMinutes.toFixed(0)} min`.padStart(8), '|',
        active.buysPerLevel.toFixed(1).padStart(12), '|', ok ? 'JA' : '-');
    }
  }
}
restore();
