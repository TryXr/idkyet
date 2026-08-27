/**
 * Balance-Sweep: dreht einzelne Konstanten und misst die Design-Ziele.
 *
 * Zwei Hebel bestimmen die Spiellaenge:
 *   demandMult    wie schnell der Bedarf je Zoomstufe waechst
 *   qualityMult   wie schnell die Raeume besser werden (= der Durchsatz)
 * Die Dauer einer Stufe ist Bedarf geteilt durch Durchsatz - waechst der
 * Bedarf schneller, werden die spaeten Stufen laenger, und umgekehrt.
 *
 * Ziele: Gesamtdauer 5-8 h, erste Stufe unter 10 min, keine Stufe ueber 60 min,
 * und die kluge Zielwahl muss sich gegen den sturen Autopiloten lohnen.
 */
import { BALANCE } from '../src/core/balance.js';
import { Sim } from '../src/core/sim.js';
import { maxLevel } from '../src/core/world.js';
import { decide } from './autoplay.js';

export function measure(dumbTargeting = false, seed = 1) {
  const marks: number[] = [];
  const sim = new Sim({
    seed, dumbTargeting,
    onEvent: e => { if (e.type === 'levelUp') marks.push(e.at); },
  });
  while (!sim.finished && sim.time < 40 * 3600) { sim.tick(); decide(sim); }

  const spans: number[] = [];
  let previous = 0;
  for (const at of marks) { spans.push(at - previous); previous = at; }
  spans.push(sim.time - previous);

  return {
    hours: sim.time / 3600,
    firstMinutes: (spans[0] ?? 0) / 60,
    longestMinutes: Math.max(...spans) / 60,
    shortestMinutes: Math.min(...spans) / 60,
    spans: spans.map(s => Math.round(s / 60)),
    rentShare: sim.rentPerSecond() / Math.max(1e-9, sim.incomeRate),
    finished: sim.finished,
  };
}

const defaults = {
  demandMult: BALANCE.levels.demandMult,
  demand0: BALANCE.levels.demand0,
  qualityMult: BALANCE.rooms.qualityMult,
  hireRate: BALANCE.chain.hireRate,
};

function restore(): void {
  BALANCE.levels.demandMult = defaults.demandMult;
  BALANCE.levels.demand0 = defaults.demand0;
  BALANCE.rooms.qualityMult = defaults.qualityMult;
  BALANCE.chain.hireRate = defaults.hireRate;
}

console.log('=== Bedarf gegen Raumqualitaet ===');
console.log('demandMult | qualityMult | gesamt h | Stufe 0 | kuerzeste | laengste | Rente | ok?');
for (const demandMult of [9, 11, 13, 15]) {
  for (const qualityMult of [1.55, 1.7, 1.9]) {
    restore();
    BALANCE.levels.demandMult = demandMult;
    BALANCE.rooms.qualityMult = qualityMult;
    const run = measure();
    const ok = run.finished && run.hours >= 5 && run.hours <= 8
      && run.firstMinutes <= 10 && run.longestMinutes <= 60;
    console.log(
      String(demandMult).padStart(10), '|', qualityMult.toFixed(2).padStart(11), '|',
      run.hours.toFixed(2).padStart(8), '|',
      `${run.firstMinutes.toFixed(0)} min`.padStart(7), '|',
      `${run.shortestMinutes.toFixed(0)} min`.padStart(9), '|',
      `${run.longestMinutes.toFixed(0)} min`.padStart(8), '|',
      `${(run.rentShare * 100).toFixed(0)}%`.padStart(5), '|', ok ? 'JA' : '-');
  }
}
restore();
console.log(`\nZum Vergleich Stand aus balance.ts: demandMult ${defaults.demandMult},` +
  ` qualityMult ${defaults.qualityMult}`);
const current = measure();
console.log(`  ${current.hours.toFixed(2)} h, Stufen (min): ${current.spans.join(' ')}`);

/**
 * Der Pflanzen-Kreislauf. Zwei Werte bestimmen, wie sich der Rhythmus anfuehlt:
 *
 *   seedCost0    wie teuer ein Steckling ist, also wie schnell ein neuer Raum
 *                voll wird
 *   growSeconds  wie lange ein Steckling reift, also wie viel Vorlauf noetig ist
 *
 * Gemessen wird nicht nur die Dauer, sondern auch der ANTEIL DER ZEIT IM
 * AUFBAU. Ist der winzig, gibt es zwar rechnerisch eine Entscheidung, aber
 * keine spuerbare Phase - und genau die soll den Raumkauf zum Ereignis machen.
 */
const plantDefaults = {
  seedCost0: BALANCE.plant.seedCost0,
  growSeconds: BALANCE.plant.growSeconds,
};

function buildShare(seed = 1): { hours: number; back: number; finished: boolean } {
  const sim = new Sim({ seed });
  let back = 0;
  let total = 0;
  while (!sim.finished && sim.time < 40 * 3600) {
    sim.tick();
    decide(sim);
    total++;
    if (sim.seedShare > 0.5) back++;
  }
  return { hours: sim.time / 3600, back: total > 0 ? back / total : 0, finished: sim.finished };
}

console.log('\n=== Pflanzen: Stecklingspreis gegen Reifezeit ===');
console.log('seedCost0 | growSeconds | gesamt h | im Aufbau | ok?');
for (const seedCost0 of [1.5, 4, 8, 16]) {
  for (const growSeconds of [90, 240]) {
    BALANCE.plant.seedCost0 = seedCost0;
    BALANCE.plant.growSeconds = growSeconds;
    const run = buildShare();
    const ok = run.finished && run.hours >= 5 && run.hours <= 8 && run.back >= 0.15;
    console.log(
      seedCost0.toFixed(1).padStart(9), '|', String(growSeconds).padStart(11), '|',
      (run.finished ? run.hours.toFixed(2) : '-').padStart(8), '|',
      `${(run.back * 100).toFixed(0)}%`.padStart(9), '|', ok ? 'JA' : '-');
  }
}
BALANCE.plant.seedCost0 = plantDefaults.seedCost0;
BALANCE.plant.growSeconds = plantDefaults.growSeconds;
