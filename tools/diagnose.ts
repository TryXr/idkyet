/**
 * Diagnose: Wo geht die Zeit hin? Pro Zoomstufe wird aufgeschluesselt, womit
 * der Spieler sie verbringt - kaufen, sparen, oder an der Flaeche haengen.
 *
 * Benutzt bewusst DENSELBEN Autoplay wie Regressionslauf und Sweep. Eine eigene
 * Kaufpolitik hier hat schon einmal ein voellig anderes Spiel gemessen (Stillstand
 * bei Stufe 6, waehrend der Regressionslauf sauber durchlief).
 */
import { Sim } from '../src/core/sim.js';
import { levelName, maxLevel } from '../src/core/world.js';
import { fmt } from '../src/core/numbers.js';
import { siteName } from '../src/core/production.js';
import { ownedFraction, parcelPool } from '../src/core/land.js';
import { decide } from './autoplay.js';

interface LevelStats {
  seconds: number;
  siteBuys: number;
  sitesBought: number;
  landBuys: number;
  parcelsBought: number;
  storageBuys: number;
  savingSeconds: number;      // Maerkte voll, es wird auf den Aufstieg gespart
  areaBlockedSeconds: number; // gewuenschter Kauf scheitert an der Flaeche
  topTier: number;
  landFractionEnd: number;
}

const empty = (): LevelStats => ({
  seconds: 0, siteBuys: 0, sitesBought: 0, landBuys: 0, parcelsBought: 0,
  storageBuys: 0, savingSeconds: 0, areaBlockedSeconds: 0, topTier: 0, landFractionEnd: 0,
});

const stats: LevelStats[] = Array.from({ length: maxLevel() + 1 }, empty);
const sim = new Sim({ seed: 1, pilot: 'human' });

while (!sim.finished && sim.time < 40 * 3600) {
  const level = sim.level;
  const s = stats[level]!;
  sim.tick();
  s.seconds++;

  const decision = decide(sim, { buyPilots: true });
  if (decision.areaBlocked) s.areaBlockedSeconds++;
  switch (decision.kind) {
    case 'site':
      s.siteBuys++;
      s.sitesBought += decision.count ?? 1;
      s.topTier = Math.max(s.topTier, decision.tier ?? 0);
      break;
    case 'land':
      s.landBuys++;
      s.parcelsBought += decision.count ?? 1;
      break;
    case 'storage': s.storageBuys++; break;
    case 'wait': s.savingSeconds++; break;
  }
  s.landFractionEnd = ownedFraction(sim.parcels, parcelPool(level));
}

console.log('Stufe             Dauer  Kaeufe   Orte    Land  Lager  sparen  Flaeche  Landbesitz  hoechster Ort');
for (let level = 0; level <= maxLevel(); level++) {
  const s = stats[level]!;
  if (s.seconds === 0) continue;
  const pct = (v: number) => `${((100 * v) / s.seconds).toFixed(0)}%`.padStart(7);
  console.log(
    `${String(level).padStart(2)} ${levelName(level).padEnd(15)}` +
    `${(s.seconds / 60).toFixed(0).padStart(5)}m` +
    `${String(s.siteBuys).padStart(8)}` +
    `${String(s.sitesBought).padStart(7)}` +
    `${String(s.parcelsBought).padStart(8)}` +
    `${String(s.storageBuys).padStart(7)}` +
    `${pct(s.savingSeconds)}${pct(s.areaBlockedSeconds)}` +
    `${(s.landFractionEnd * 100).toFixed(1).padStart(10)}%` +
    `  ${siteName(s.topTier)}`);
}
console.log(`\nGesamt ${(sim.time / 3600).toFixed(2)} h, Bargeld ${fmt(sim.cash)}, Parzellen ${sim.parcels}`);
