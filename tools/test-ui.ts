/**
 * Abnahme der Bedienung: erste Minute, keine Sackgassen, Stimmen, Ende.
 *
 * "Ein Fremder spielt 20 min ohne Erklaerung" kann kein Skript pruefen -
 * pruefbar sind aber die Eigenschaften, ohne die es sicher scheitert:
 *
 *   1. Die erste Minute traegt: von Hand kochen und verkaufen bringt zuegig
 *      den ersten Junkie und den ersten Dealer, und die beenden das Klicken.
 *   2. Es gibt IMMER etwas zu tun, oder wenigstens eine Wartezeit, die sagt,
 *      wann es wieder etwas zu tun gibt.
 *   3. An jedem Kauf steht, was er kostet und wann er moeglich ist.
 *   4. Max-Buy kauft genau so viel, wie es ankuendigt.
 *   5. Die Stimmen halten den Deckel ein UND kommen im Spiel wirklich vor.
 *   6. Das Ende kommt durch vollstaendige Uebernahme, und die Demo endet
 *      frueher, aber vollstaendig.
 */
import { Sim } from '../src/core/sim.js';
import { fmt } from '../src/core/numbers.js';
import { levelName, maxLevel } from '../src/core/world.js';
import { applyDemoLimit, applyFullVersion, DEMO_MAX_LEVEL } from '../src/core/config.js';
import { VOICE_LINES, VoiceDirector } from '../src/content/voices.js';
import { applyAction, buildViewModel, type ViewModel } from '../src/ui/model.js';
import { decide } from './autoplay.js';

let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures++;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(50)} ${detail}`);
}

/** Jede Schaltflaeche, die das Modell gerade anbietet. */
function options(vm: ViewModel) {
  return vm.sections.flatMap(s => s.rows.flatMap(r => r.buys));
}

// --- 1. Die erste Minute ---------------------------------------------------
console.log('\n=== Erste Minute: beide Knöpfe von Hand ===');
{
  const sim = new Sim({ seed: 1 });
  const start = buildViewModel(sim);
  check('Beide Knöpfe sind da', start.hands.visible &&
    start.hands.cook.label.length > 0 && start.hands.sell.label.length > 0);
  check('Kochen geht sofort, Verkaufen noch nicht',
    start.hands.cook.enabled && !start.hands.sell.enabled);
  check('Startbild zeigt ein Ziel', start.target !== null, start.target?.name ?? '-');
  check('Erstes Gebiet ist Duisburg', start.target?.name === 'Duisburg');

  // Kochen, verkaufen, kochen, verkaufen - wie ein Mensch es taete.
  let firstWorker = Infinity;
  let firstDealer = Infinity;
  for (let t = 0; t < 600; t++) {
    sim.tick();
    sim.cookByHand();
    sim.sellByHand();
    if (firstWorker === Infinity && sim.cash.gte(sim.unitCost('cook', 0))) firstWorker = t;
    if (firstDealer === Infinity && sim.cash.gte(sim.unitCost('sell', 0))) firstDealer = t;
  }
  check('Genug für den ersten Junkie in unter 30 s', firstWorker <= 30, `nach ${firstWorker} s`);
  check('Genug für den ersten Dealer in unter 2 min', firstDealer <= 120, `nach ${firstDealer} s`);

  // Und die Helfer beenden das Klicken.
  const hired = new Sim({ seed: 1 });
  hired.cash = hired.cash.add(1000);
  hired.buyUnit('cook', 0);
  hired.buyUnit('sell', 0);
  const before = hired.cash;
  for (let t = 0; t < 120; t++) hired.tick();
  check('Mit Junkie und Dealer läuft es von allein', hired.cash.gt(before),
    `${fmt(before)} -> ${fmt(hired.cash)}`);
  check('Die Handknöpfe verschwinden', !buildViewModel(hired).hands.visible);

  // Ohne Verkäufer bleibt die Ware liegen - das ist der Sinn der zweiten Kette.
  const noSeller = new Sim({ seed: 1 });
  noSeller.cash = noSeller.cash.add(1000);
  noSeller.buyUnit('cook', 0);
  for (let t = 0; t < 300; t++) noSeller.tick();
  check('Ohne Verkäufer wächst nur das Lager', noSeller.cash.lte(1000) && noSeller.storage > 0,
    `${fmt(noSeller.storage)} Ware im Lager`);
}

// --- 2. Ein ganzer Durchlauf ----------------------------------------------
console.log('\n=== Durchlauf: keine Sackgassen ===');
const sim = new Sim({ seed: 1 });
const director = new VoiceDirector(0);
sim.events.on(event => director.handle(event));

let deadEnds = 0;
let deadEndAt = '';
let missingText = 0;
let modelSeconds = 0;
let samples = 0;
let widest = 0;

while (!sim.finished && sim.time < 40 * 3600) {
  sim.tick();
  decide(sim);
  while (director.take() !== null) { /* Zeilen abholen, s. u. */ }

  if (sim.time % 10 !== 0) continue;
  const started = performance.now();
  const vm = buildViewModel(sim);
  modelSeconds += (performance.now() - started) / 1000;
  samples++;

  const offered = options(vm);
  // Die Haende zaehlen mit, solange sie da sind: in der ersten Minute IST
  // Klicken das, was es zu tun gibt (CLAUDE.md, erste 60 Sekunden).
  const reachable = offered.some(o => o.enabled) ||
    offered.some(o => Number.isFinite(sim.secondsUntil(o.cost))) ||
    (vm.hands.visible && (vm.hands.cook.enabled || vm.hands.sell.enabled));
  if (!reachable) { deadEnds++; if (!deadEndAt) deadEndAt = levelName(sim.level); }
  if (offered.some(o => !o.costText) || vm.sections.some(s => s.rows.some(r => !r.waitText))) {
    missingText++;
  }
  widest = Math.max(widest, offered.length);
}

check('Durchlauf erreicht das Ende', sim.finished, `${(sim.time / 3600).toFixed(2)} h`);
check('Keine Sackgasse', deadEnds === 0,
  deadEnds ? `${deadEnds}× ab ${deadEndAt}` : `${samples} Stichproben`);
check('Überall Preis und Wartezeit', missingText === 0, `${missingText} Lücken`);
// 14 Zeilen in vier beschrifteten Abschnitten (Kochen, Räume, Verkaufen,
// Lager) mal drei Kaufknöpfen. Mehr darf es nicht werden - dann ist es eine
// Wand statt einer Liste.
check('Nicht zu viele Knöpfe auf einmal', widest <= 45, `höchstens ${widest}`);
check('Anzeigemodell ist billig genug', modelSeconds / samples < 0.005,
  `${((modelSeconds / samples) * 1000).toFixed(2)} ms je Aufbau`);

// --- 3. Stimmen ------------------------------------------------------------
console.log('\n=== Stimmen ===');
{
  const perLevel = new Map<number, number>();
  for (const line of VOICE_LINES) perLevel.set(line.level, (perLevel.get(line.level) ?? 0) + 1);
  const overCap = [...perLevel.entries()].filter(([, n]) => n > 5);
  const empty: number[] = [];
  for (let level = 0; level <= maxLevel(); level++) if (!perLevel.has(level)) empty.push(level);

  check('Höchstens 5 Zeilen je Ebene', overCap.length === 0,
    overCap.map(([l, n]) => `${levelName(l)}: ${n}`).join(', '));
  check('Insgesamt höchstens 70 Zeilen', VOICE_LINES.length <= 70, `${VOICE_LINES.length} Zeilen`);
  check('Jede Ebene hat eine Stimme', empty.length === 0, empty.map(levelName).join(', '));
  check('Keine doppelten Kennungen', new Set(VOICE_LINES.map(l => l.id)).size === VOICE_LINES.length);
  check('Keine doppelten Texte', new Set(VOICE_LINES.map(l => l.text)).size === VOICE_LINES.length);

  // Zeilen, die nie fallen, sind verschenkte Arbeit - und Arbeit ist hier der
  // knappste Rohstoff, weil dieser Text als einziger nicht generiert wird.
  // Geprueft wird gegen ZWEI Spieler: den umsichtigen von oben und einen
  // Anfaenger, der das Lager nie ausbaut und deshalb hineinlaeuft.
  const sloppy = new Sim({ seed: 2 });
  const sloppyDirector = new VoiceDirector(0);
  sloppy.events.on(event => sloppyDirector.handle(event));
  while (sloppy.level < 1 && sloppy.time < 3600) { sloppy.tick(); decide(sloppy); }
  // Ab hier wird nur noch angebaut: viele Raeume, viele Gaertner, viele
  // Pflanzen - und alles wird verkauft statt zurueckgelegt, obwohl viel zu
  // wenige Dealer da sind. Genau so laeuft ein Anfaenger in ein volles Lager.
  sloppy.cash = sloppy.cash.add(1e6);
  sloppy.buyRooms(1, 20);
  sloppy.buyUnits('cook', 0, 60);
  sloppy.plants = sloppy.seats();
  sloppy.setSeedShare(0);
  for (let t = 0; t < 1800; t++) sloppy.tick();

  const unseen = VOICE_LINES.filter(
    l => !director.hasFired(l.id) && !sloppyDirector.hasFired(l.id));
  check('Jede Zeile kommt im Spiel wirklich vor', unseen.length === 0,
    unseen.length ? unseen.map(l => l.id).join(', ') : `${VOICE_LINES.length} von ${VOICE_LINES.length}`);
}

// --- 4. Max-Buy und Aktionen ----------------------------------------------
console.log('\n=== Max-Buy und Aktionen ===');
{
  const probe = new Sim({ seed: 3 });
  for (let t = 0; t < 1200; t++) { probe.tick(); decide(probe); }
  probe.cash = probe.cash.mul(10).add(10_000);

  const want = probe.affordableUnits('cook', 0);
  check('Max-Buy hat etwas anzubieten', want > 0, `${want}× Junkie`);
  const quoted = probe.unitBulkCost('cook', 0, want);
  const before = probe.cash;
  const bought = probe.buyUnits('cook', 0, want);
  const spent = before.sub(probe.cash);
  check('Max-Buy kauft die angekündigte Menge', bought === want, `${bought} von ${want}`);
  check('Max-Buy kostet den angekündigten Preis',
    spent.sub(quoted).abs().div(quoted.max(1)).lt(0.001), `${fmt(spent)} statt ${fmt(quoted)}`);
  check('Max-Buy überzieht das Bargeld nicht', probe.cash.gte(0), fmt(probe.cash));

  probe.cash = probe.cash.add(1e9);
  const rooms = probe.rooms[0] ?? 0;
  check('Raum kaufen', applyAction(probe, { kind: 'room', tier: 0, count: 3 }) &&
    (probe.rooms[0] ?? 0) === rooms + 3);
  const level = probe.storageLevel;
  check('Lager ausbauen', applyAction(probe, { kind: 'storage' }) &&
    probe.storageLevel === level + 1);
  const open = probe.territories.find(t => !t.owned)!;
  check('Ziel wählen', applyAction(probe, { kind: 'target', id: open.id }) &&
    probe.target()?.id === open.id, open.name);
  const dealers = Math.floor(probe.sell[0] ?? 0);
  check('Verkäufer anstellen', applyAction(probe, { kind: 'unit', chain: 'sell', tier: 0, count: 2 }) &&
    Math.floor(probe.sell[0] ?? 0) === dealers + 2);

  // Und von Hand geht es auch noch, wenn Ware da ist.
  probe.storage = 5;
  check('Von Hand verkaufen', applyAction(probe, { kind: 'sell' }));
}

// --- 5. Ende und Demo-Zuschnitt -------------------------------------------
console.log('\n=== Ende und Demo ===');
{
  const finishedVm = buildViewModel(sim);
  check('Durchlauf endet mit Bilanz', sim.finished && finishedVm.ending !== null);
  check('Bilanz zählt auf, was übernommen wurde',
    (finishedVm.ending?.tally.length ?? 0) >= 5,
    finishedVm.ending?.tally.map(([k]) => k).join(', '));
  check('Bilanz nennt keine Demo', finishedVm.ending?.demo === false);
  check('Nach dem Ende keine Hinweise mehr', finishedVm.warnings.length === 0);

  applyDemoLimit();
  check('Demo endet früher', maxLevel() === DEMO_MAX_LEVEL, `Ebene ${maxLevel() + 1}`);
  const demo = new Sim({ seed: 1 });
  while (!demo.finished && demo.time < 8 * 3600) { demo.tick(); decide(demo); }
  const demoVm = buildViewModel(demo);
  check('Demo ist durchspielbar', demo.finished, `${(demo.time / 3600).toFixed(2)} h`);
  check('Demo dauert ein bis drei Stunden', demo.time >= 3000 && demo.time <= 3 * 3600,
    `${(demo.time / 3600).toFixed(2)} h`);
  check('Demo-Bilanz weist auf die Vollversion hin', demoVm.ending?.demo === true,
    demoVm.ending?.title ?? '');
  applyFullVersion();
  check('Vollversion wieder hergestellt', maxLevel() === 7, `Ebene ${maxLevel() + 1}`);
}

console.log(`\nBedienung ${failures === 0 ? 'BESTANDEN' : `NICHT bestanden (${failures} Fehler)`}`);
process.exit(failures === 0 ? 0 : 1);
