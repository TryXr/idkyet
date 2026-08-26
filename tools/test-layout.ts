/**
 * Abnahme: die Karte muss ueber alle Ebenen tragen.
 *
 * Der eigentliche Fallstrick sind nicht die Bilder pro Sekunde, sondern die
 * Zahlen: der Bedarf waechst ueber acht Ebenen um viele Groessenordnungen.
 * Wuerde die Karte absolute Weltkoordinaten fuehren, waere die
 * Fliesskomma-Genauigkeit lange vorher dahin. Deshalb wird hier geprueft, dass
 * die Koordinaten auf JEDER Ebene im lokalen Bereich bleiben - das ist die
 * Eigenschaft, die der Umsetz-Mechanismus garantieren muss.
 */
import { generateLevel, levelDemand, levelName, maxLevel } from '../src/core/world.js';
import { layoutLevel } from '../src/render/layout.js';
import { fmt } from '../src/core/numbers.js';

const SEED = 1;
const checks: Array<[string, boolean, string]> = [];
let worstExtent = 0;
let worstOverlap = Infinity;
let smallestGapLevel = '';
let namesMissing = 0;

for (let level = 0; level <= maxLevel(); level++) {
  const territories = generateLevel(level, SEED);
  const layout = layoutLevel(level, SEED, territories);

  for (const item of layout) {
    // Gebiete muessen vollstaendig in der Einheitsscheibe liegen.
    const extent = Math.hypot(item.x, item.y) + item.radius;
    worstExtent = Math.max(worstExtent, extent);
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.radius)) {
      checks.push([`Ebene ${level} hat unendliche Koordinaten`, false, 'NaN/Infinity']);
    }
  }

  // Ueberlappung messen: negativer Abstand heisst, zwei Gebiete liegen ineinander.
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

  // Der Gesamtbedarf der erzeugten Gebiete muss zur geplanten Zahl passen -
  // sonst stimmt der ganze Zeitplan aus BALANCING.md nicht mehr.
  const demand = territories.reduce((sum, t) => sum + t.demand, 0);
  const deviation = Math.abs(demand - levelDemand(level)) / levelDemand(level);
  if (deviation > 0.001) {
    checks.push([`Ebene ${level}: Bedarf weicht ab`, false, `${(deviation * 100).toFixed(2)}%`]);
  }

  // Jedes Gebiet braucht einen Namen, eine Rente und einen Preis.
  for (const t of territories) {
    if (!t.name || /^Gebiet \d+$/.test(t.name)) namesMissing++;
    if (!(t.price > 0) || !(t.rent > 0) || !(t.demand > 0)) {
      checks.push([`Ebene ${level}: ${t.name} hat unbrauchbare Zahlen`, false,
        `Bedarf ${fmt(t.demand)}, Preis ${fmt(t.price)}, Rente ${fmt(t.rent)}`]);
    }
  }
}

checks.unshift(
  ['Koordinaten bleiben lokal (<= 1.0)', worstExtent <= 1.0001, `groesste Ausdehnung ${worstExtent.toFixed(3)}`],
  ['Gebiete ueberlappen nicht stark', worstOverlap > -0.05,
    `engster Abstand ${worstOverlap.toFixed(3)} (${smallestGapLevel})`],
  ['Alle Ebenen erzeugbar', true, `Ebene 0 bis ${maxLevel()}`],
  ['Jedes Gebiet hat einen echten Namen', namesMissing === 0,
    namesMissing ? `${namesMissing} ohne Namen` : `${(maxLevel() + 1) * 15} Namen`],
);

console.log('--- Abnahme Karte ---');
let allPassed = true;
for (const [label, passed, value] of checks) {
  if (!passed) allPassed = false;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(36)} ${value}`);
}
console.log(`\nKarte ${allPassed ? 'BESTANDEN' : 'NICHT bestanden'}`);
process.exit(allPassed ? 0 : 1);
