/**
 * Abnahme: Speichern, Beenden, Laden, Weiterspielen - plus Offline-Fortschritt.
 * Laeuft headless und ohne Testframework; ein fehlgeschlagener Check setzt den
 * Exitcode, damit das spaeter in CI taugt.
 */
import { Sim } from '../src/core/sim.js';
import { IncompatibleSaveError, MemoryStorage } from '../src/core/save.js';
import { BALANCE } from '../src/core/balance.js';
import { fmt } from '../src/core/numbers.js';
import type { GameEvent } from '../src/core/events.js';
import { decide } from './autoplay.js';

let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures++;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(46)} ${detail}`);
}

/** Gespielt wird mit der GEMEINSAMEN Kaufpolitik - eine eigene Kopie hier hat
 *  schon einmal ein voellig anderes Spiel gemessen. */
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
check('Ebene gleich', restored.level === original.level, `Ebene ${restored.level}`);
check('Ketten gleich',
  JSON.stringify(restored.cook) === JSON.stringify(original.cook) &&
  JSON.stringify(restored.sell) === JSON.stringify(original.sell),
  `Koch ${restored.cook.map(c => Math.floor(c)).join('/')}`);
check('Raeume gleich', JSON.stringify(restored.rooms) === JSON.stringify(original.rooms));
check('Versorgung der Gebiete gleich',
  restored.territories.every((t, i) => Math.abs(t.supplied - original.territories[i]!.supplied) < 1e-9));
check('Uebernahmen gleich',
  restored.territories.filter(t => t.owned).length === original.territories.filter(t => t.owned).length,
  `${restored.territories.filter(t => t.owned).length} Gebiete`);
check('Renten frueherer Ebenen gleich', restored.pastRent === original.pastRent,
  fmt(restored.pastRent));

// --- 2. Weiterspielen laeuft identisch weiter ------------------------------
console.log('\n=== Weiterspielen nach dem Laden ===');
const continued = Sim.load(storage, {}, savedAt)!;
run(continued, 600);
run(original, 600);
check('Bargeld nach 10 min identisch', continued.cash.eq(original.cash),
  `${fmt(continued.cash)} vs ${fmt(original.cash)}`);
check('Ebene nach 10 min identisch', continued.level === original.level);

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

// --- 4. Ohne Helfer passiert in der Abwesenheit nichts --------------------
console.log('\n=== Handbetrieb: niemand arbeitet, wenn niemand angestellt ist ===');
const manualStorage = new MemoryStorage();
const manual = new Sim({ seed: 7 });
for (let t = 0; t < 120; t++) manual.tick();  // nur ticken, nichts kaufen
manual.save(manualStorage, savedAt);
const manualCash = manual.cash;
const manualLoaded = Sim.load(manualStorage, {}, savedAt + 5 * 3600 * 1000)!;
check('Keine Arbeiter, keine Verkaeufer', manualLoaded.cook[0] === 0 && manualLoaded.sell[0] === 0);
check('Kein Ertrag ohne Helfer', manualLoaded.cash.eq(manualCash), fmt(manualLoaded.cash));

// --- 5. Speicherformat -----------------------------------------------------
console.log('\n=== Speicherformat ===');
const raw = JSON.parse(storage.load()!);
check('Version im Stand vermerkt', raw.v === 2, `v${raw.v}`);
check('Grosse Zahlen als Text gesichert', typeof raw.cash === 'string', raw.cash);
check('RNG-Zustand gesichert', typeof raw.rngState === 'number');
check('Nur der Versorgungsstand wird gesichert', Array.isArray(raw.supplied),
  `${raw.supplied.length} Werte`);

for (const [label, payload] of [
  ['neuere Version', JSON.stringify({ ...raw, v: 99 })],
  ['alter Marktmodell-Stand', JSON.stringify({ v: 1, nodes: [], owned: [] })],
] as Array<[string, string]>) {
  let rejected = false;
  try {
    const other = new MemoryStorage();
    other.save(payload);
    Sim.load(other, {}, savedAt);
  } catch (error) { rejected = error instanceof IncompatibleSaveError; }
  check(`${label} wird abgelehnt statt falsch gelesen`, rejected);
}

// --- 6. Zielwahl -----------------------------------------------------------
console.log('\n=== Zielwahl ===');
const targeting = new Sim({ seed: 7 });
run(targeting, 600);
const open = targeting.territories.find(t => !t.owned)!;
targeting.setTarget(open.id);
check('Gewaehltes Ziel wird beliefert', targeting.target()?.id === open.id, open.name);
const before = open.supplied;
run(targeting, 60);
check('Das Ziel fuellt sich', open.supplied > before || open.owned,
  `${fmt(before)} -> ${fmt(open.supplied)}`);

const auto = new Sim({ seed: 7 });
run(auto, 300);
auto.setTarget(null);
check('Ohne Wahl waehlt das Spiel selbst', auto.target() !== null, auto.target()?.name ?? '-');

console.log(`\nSpeichern ${failures === 0 ? 'BESTANDEN' : `NICHT bestanden (${failures} Fehler)`}`);
process.exit(failures === 0 ? 0 : 1);
