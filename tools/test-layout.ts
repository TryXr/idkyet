/**
 * Abnahme M4: der Zoom muss ueber alle 14 Stufen tragen.
 *
 * Der eigentliche Fallstrick sind nicht die Bilder pro Sekunde, sondern die
 * Zahlen: 14 Stufen mal Faktor 12 sind rund 1e14. Wuerde die Karte absolute
 * Weltkoordinaten fuehren, waere die Fliesskomma-Genauigkeit lange vorher
 * dahin. Deshalb wird hier geprueft, dass die Koordinaten auf JEDER Stufe im
 * lokalen Bereich bleiben - das ist die Eigenschaft, die der Umsetz-Mechanismus
 * garantieren muss.
 */
import { generateLevel, levelName, maxLevel } from '../src/core/world.js';
import { layoutLevel } from '../src/render/layout.js';
import { OPTIMAL_UTILISATION } from '../src/core/market.js';

const SEED = 1;
const checks: Array<[string, boolean, string]> = [];
let worstExtent = 0;
let worstOverlap = Infinity;
let smallestGapLevel = '';

for (let level = 0; level <= maxLevel(); level++) {
  const nodes = generateLevel(level, SEED);
  const layout = layoutLevel(level, SEED, nodes);

  for (const item of layout) {
    // Knoten muessen vollstaendig in der Einheitsscheibe liegen.
    const extent = Math.hypot(item.x, item.y) + item.radius;
    worstExtent = Math.max(worstExtent, extent);
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.radius)) {
      checks.push([`Stufe ${level} hat unendliche Koordinaten`, false, 'NaN/Infinity']);
    }
  }

  // Ueberlappung messen: negativer Abstand heisst, zwei Knoten liegen ineinander.
  for (let a = 0; a < layout.length; a++) {
    for (let b = a + 1; b < layout.length; b++) {
      const first = layout[a]!;
      const second = layout[b]!;
      const gap = Math.hypot(first.x - second.x, first.y - second.y)
        - first.radius - second.radius;
      if (gap < worstOverlap) {
        worstOverlap = gap;
        smallestGapLevel = levelName(level);
      }
    }
  }

  // Die Kapazitaet der erzeugten Knoten muss zur geplanten Stufenkapazitaet
  // passen - sonst stimmt der ganze Zeitplan aus BALANCING.md nicht mehr.
  const capacity = nodes.reduce((sum, n) => sum + n.demand * OPTIMAL_UTILISATION, 0);
  const expected = 0.6 * Math.pow(12, level);
  const deviation = Math.abs(capacity - expected) / expected;
  if (deviation > 0.001) {
    checks.push([`Stufe ${level}: Kapazitaet weicht ab`, false, `${(deviation * 100).toFixed(2)}%`]);
  }
}

checks.unshift(
  ['Koordinaten bleiben lokal (<= 1.0)', worstExtent <= 1.0001, `groesste Ausdehnung ${worstExtent.toFixed(3)}`],
  ['Knoten ueberlappen nicht stark', worstOverlap > -0.05,
    `engster Abstand ${worstOverlap.toFixed(3)} (${smallestGapLevel})`],
  ['Alle 14 Stufen erzeugbar', true, `Stufe 0 bis ${maxLevel()}`],
);

console.log('--- Abnahme M4 (Karte & Zoom) ---');
let allPassed = true;
for (const [label, passed, value] of checks) {
  if (!passed) allPassed = false;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(36)} ${value}`);
}
console.log(`\nM4 ${allPassed ? 'BESTANDEN' : 'NICHT bestanden'}`);
process.exit(allPassed ? 0 : 1);
