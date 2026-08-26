/**
 * Abnahme M2: Speichern, Beenden, Laden, Weiterspielen - plus Offline-Fortschritt.
 * Laeuft headless und ohne Testframework; ein fehlgeschlagener Check setzt den
 * Exitcode, damit das spaeter in CI taugt.
 */
import { Sim } from '../src/core/sim.js';
import { MemoryStorage } from '../src/core/save.js';
import { BALANCE } from '../src/core/balance.js';
import { fmt } from '../src/core/numbers.js';
import type { GameEvent } from '../src/core/events.js';
import { decide as autoplay } from './autoplay.js';

let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures++;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(46)} ${detail}`);
}

/**
 * Gespielt wird mit der GEMEINSAMEN Kaufpolitik. Vorher stand hier eine eigene
 * Kopie - die kannte den Handverkauf nicht und verdiente deshalb nichts mehr,
 * sobald die Simulation ohne Statthalter niemanden mehr beliefern liess.
 */
function decide(sim: Sim): void {
  autoplay(sim, { buyPilots: true });
}

function run(sim: Sim, seconds: number): void {
  for (let t = 0; t < seconds; t++) { sim.tick(); decide(sim); }
}

// --- 1. Speichern und Laden erhaelt den Zustand ---------------------------
console.log('\n=== Speichern und Laden ===');
const storage = new MemoryStorage();
const original = new Sim({ seed: 7 });
run(original, 1800); // 30 min spielen
const savedAt = 1_000_000;
original.save(storage, savedAt);

const restored = Sim.load(storage, {}, savedAt)!; // kein Zeitversatz
check('Stand geladen', restored !== null);
check('Bargeld gleich', restored.cash.eq(original.cash), fmt(restored.cash));
check('Spielzeit gleich', restored.time === original.time, `${restored.time} s`);
check('Stufe gleich', restored.level === original.level, `Stufe ${restored.level}`);
check('Parzellen gleich', restored.parcels === original.parcels, `${restored.parcels}`);
check('Statthalter gleich', restored.pilotLevel === original.pilotLevel, `S${restored.pilotLevel - 1}`);
check('Orte gleich', JSON.stringify(restored.owned) === JSON.stringify(original.owned));
check('Marktzustand gleich',
  restored.nodes.every((n, i) => n.p === original.nodes[i]!.p && n.h === original.nodes[i]!.h));

// --- 2. Weiterspielen laeuft identisch weiter ------------------------------
console.log('\n=== Weiterspielen nach dem Laden ===');
const continued = Sim.load(storage, {}, savedAt)!;
run(continued, 600);
run(original, 600);
check('Bargeld nach 10 min identisch', continued.cash.eq(original.cash),
  `${fmt(continued.cash)} vs ${fmt(original.cash)}`);
check('Stufe nach 10 min identisch', continued.level === original.level);

// --- 3. Offline-Fortschritt ----------------------------------------------
console.log('\n=== Offline-Fortschritt ===');
const base = new Sim({ seed: 7 });
run(base, 1800);
base.save(storage, savedAt);
const cashAtSave = base.cash;

const afterThreeHours = Sim.load(storage, {}, savedAt + 3 * 3600 * 1000)!;
check('Abwesenheit bringt Ertrag', afterThreeHours.cash.gt(cashAtSave),
  `${fmt(cashAtSave)} -> ${fmt(afterThreeHours.cash)}`);
check('Spielzeit ist gewachsen', afterThreeHours.time > base.time,
  `${((afterThreeHours.time - base.time) / 3600).toFixed(1)} h gutgeschrieben`);

let offlineEvent: GameEvent | null = null;
const capTest = Sim.load(
  storage,
  { onEvent: e => { if (e.type === 'offlineProgress') offlineEvent = e; } },
  savedAt + 40 * 3600 * 1000,
)!;
const capped = offlineEvent as GameEvent | null;
check('Deckel greift bei langer Abwesenheit',
  capped?.type === 'offlineProgress' && capped.capped === true);
check(`Gutschrift auf ${BALANCE.offlineCapSeconds / 3600} h begrenzt`,
  capped?.type === 'offlineProgress' && Math.abs(capped.seconds - BALANCE.offlineCapSeconds) < 1,
  capped?.type === 'offlineProgress' ? `${(capped.seconds / 3600).toFixed(1)} h` : '');
check('Deckel-Lauf ist nicht laenger als 8 h',
  capTest.time - base.time <= BALANCE.offlineCapSeconds + 1);

// --- 4. Ohne Statthalter kein Offline-Ertrag ------------------------------
console.log('\n=== Handverkauf: niemand verkauft in der Abwesenheit ===');
const manualStorage = new MemoryStorage();
const manual = new Sim({ seed: 7 });
for (let t = 0; t < 120; t++) manual.tick();  // nur ticken, nichts kaufen
manual.save(manualStorage, savedAt);
const manualCash = manual.cash;
const manualLoaded = Sim.load(manualStorage, {}, savedAt + 5 * 3600 * 1000)!;
check('Statthalter-Stufe ist 0', manualLoaded.pilotLevel === 0);
check('Kein Ertrag ohne Statthalter', manualLoaded.cash.eq(manualCash), fmt(manualLoaded.cash));

// --- 5. Migration und kaputte Staende --------------------------------------
console.log('\n=== Speicherformat ===');
const raw = JSON.parse(storage.load()!);
check('Version im Stand vermerkt', raw.v === 1, `v${raw.v}`);
check('Grosse Zahlen als Text gesichert', typeof raw.cash === 'string', raw.cash);
check('RNG-Zustand gesichert', typeof raw.rngState === 'number');
let rejected = false;
try {
  const future = new MemoryStorage();
  future.save(JSON.stringify({ ...raw, v: 99 }));
  Sim.load(future, {}, savedAt);
} catch { rejected = true; }
check('Neuerer Stand wird abgelehnt statt falsch gelesen', rejected);

// --- 6. Gebiete an- und abschalten ----------------------------------------
console.log('\n=== Gebiete schalten ===');
const toggle = new Sim({ seed: 7, pilot: 's2' });
run(toggle, 600);
const before = toggle.nodes[0]!.enabled;
const heatBefore = toggle.nodes[0]!.h;
const priceBefore = toggle.nodes[0]!.p;
toggle.setNodeEnabled(0, false);
check('Gebiet laesst sich abschalten', before && !toggle.nodes[0]!.enabled);

for (let t = 0; t < 300; t++) toggle.tick();
const node = toggle.nodes[0]!;
// Ohne Belieferung muss die Hitze fallen und der Preis sich erholen - genau das
// ist der Sinn des Handgriffs.
check('Hitze faellt im abgeschalteten Gebiet', node.h < heatBefore,
  `${heatBefore.toFixed(3)} -> ${node.h.toFixed(3)}`);
check('Preis erholt sich im abgeschalteten Gebiet', node.p > priceBefore,
  `${priceBefore.toFixed(3)} -> ${node.p.toFixed(3)}`);

// Und die Nachbarn muessen die Ware uebernehmen, statt dass sie liegen bleibt.
const otherSold = toggle.nodes.slice(1).some(n => n.p < 1);
check('Nachbargebiete uebernehmen die Ware', otherSold);

console.log(`\nM2 ${failures === 0 ? 'BESTANDEN' : `NICHT bestanden (${failures} Fehler)`}`);
process.exit(failures === 0 ? 0 : 1);
