/**
 * Diagnose: Wo geht die Zeit hin? Pro Zoomstufe wird aufgeschluesselt, wie
 * lange sie dauert, was der Spieler dort kauft und wo der Engpass liegt.
 *
 * Benutzt bewusst DENSELBEN Autoplay wie Regressionslauf und Sweep. Eine eigene
 * Kaufpolitik hier hat schon einmal ein voellig anderes Spiel gemessen.
 */
import { Sim } from '../src/core/sim.js';
import { levelDemand, levelName, maxLevel } from '../src/core/world.js';
import { fmt } from '../src/core/numbers.js';
import { roomName } from '../src/core/rooms.js';
import { decide } from './autoplay.js';

interface LevelStats {
  seconds: number;
  unitBuys: number;
  roomBuys: number;
  waits: number;
  /** Sekunden, in denen die Produktion der Engpass war. */
  cookBound: number;
  outputEnd: number;
  sellEnd: number;
  rentEnd: number;
  topRoom: number;
}

const empty = (): LevelStats => ({
  seconds: 0, unitBuys: 0, roomBuys: 0, waits: 0, cookBound: 0,
  outputEnd: 0, sellEnd: 0, rentEnd: 0, topRoom: 0,
});

const stats: LevelStats[] = Array.from({ length: maxLevel() + 1 }, empty);
const sim = new Sim({ seed: 1 });

while (!sim.finished && sim.time < 40 * 3600) {
  const level = sim.level;
  const s = stats[level]!;
  sim.tick();
  s.seconds++;

  const decision = decide(sim);
  if (decision.kind === 'unit') s.unitBuys++;
  else if (decision.kind === 'room') s.roomBuys++;
  else if (decision.kind === 'wait') s.waits++;

  if (sim.output() <= sim.sellRate()) s.cookBound++;
  s.outputEnd = sim.output();
  s.sellEnd = sim.sellRate();
  s.rentEnd = sim.rentPerSecond();
  for (let tier = 0; tier < sim.rooms.length; tier++) {
    if ((sim.rooms[tier] ?? 0) > 0) s.topRoom = tier;
  }
}

console.log('Stufe             Dauer  Kaeufe  Raeume  warten  kochbegrenzt   Ware/s   Absatz/s     Rente/s  Bedarf   bester Raum');
for (let level = 0; level <= maxLevel(); level++) {
  const s = stats[level]!;
  if (s.seconds === 0) continue;
  const pct = (v: number) => `${((100 * v) / s.seconds).toFixed(0)}%`.padStart(6);
  console.log(
    `${String(level).padStart(2)} ${levelName(level).padEnd(15)}` +
    `${(s.seconds / 60).toFixed(0).padStart(5)}m` +
    `${String(s.unitBuys).padStart(8)}` +
    `${String(s.roomBuys).padStart(8)}` +
    `${pct(s.waits)}` +
    `${pct(s.cookBound)}       ` +
    `${fmt(s.outputEnd).padStart(9)}` +
    `${fmt(s.sellEnd).padStart(11)}` +
    `${fmt(s.rentEnd).padStart(12)}` +
    `${fmt(levelDemand(level)).padStart(8)}` +
    `  ${roomName(s.topRoom)}`);
}
console.log(`\nGesamt ${(sim.time / 3600).toFixed(2)} h, Bargeld ${fmt(sim.cash)},` +
  ` Rente ${fmt(sim.rentPerSecond())}/s, ${sim.finished ? 'durchgespielt' : 'ABGEBROCHEN'}`);
