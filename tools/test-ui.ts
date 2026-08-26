/**
 * Abnahme M5: die Bedienung.
 *
 * Das Kriterium aus PLAN.md lautet "ein Fremder spielt 20 min ohne muendliche
 * Erklaerung". Das kann kein Skript pruefen - pruefbar sind aber die
 * Eigenschaften, ohne die es sicher scheitert:
 *
 *   1. Es gibt IMMER etwas zu tun, oder wenigstens eine Wartezeit, die sagt,
 *      wann es wieder etwas zu tun gibt. Keine Sackgasse, kein leeres Feld.
 *   2. An jedem Kauf steht, was er kostet und wann er moeglich ist.
 *   3. Die Wartezeiten stimmen ungefaehr - sonst sind sie schlimmer als keine.
 *   4. Max-Buy kauft genau so viel, wie es ankuendigt.
 *   5. Kein Wall aus Knoepfen: die Liste bleibt ueberschaubar.
 *   6. Die Stimmen halten den Deckel ein UND kommen im Spiel wirklich vor.
 *
 * Gespielt wird mit derselben Kaufpolitik wie im Regressionslauf - ein eigener
 * Autoplay hier hat schon einmal ein voellig anderes Spiel gemessen.
 */
import { Sim } from '../src/core/sim.js';
import { fmt } from '../src/core/numbers.js';
import { levelName, maxLevel } from '../src/core/world.js';
import { siteName } from '../src/core/production.js';
import { VOICE_LINES, VoiceDirector } from '../src/content/voices.js';
import { applyAction, buildViewModel, type ViewModel } from '../src/ui/model.js';
import { decide } from './autoplay.js';

let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures++;
  console.log(`  ${passed ? 'OK  ' : 'FEHL'}  ${label.padEnd(48)} ${detail}`);
}

/**
 * Ein Stand mitten im Spiel. Die unteren Stufen werden uebersprungen statt
 * ausgespielt - sonst dauert allein die Vorbereitung eine halbe Stunde
 * Spielzeit, und geprueft werden hier die Kaufwege, nicht die Kurve.
 */
function primed(seed: number, level: number, playSeconds = 600): Sim {
  const sim = new Sim({ seed, pilot: 's2' });
  while (sim.level < level) {
    sim.cash = sim.cash.add(sim.levelUpCost().mul(2));
    sim.levelUp();
  }
  for (let t = 0; t < playSeconds; t++) { sim.tick(); decide(sim); }
  return sim;
}

/** Jede Schaltflaeche, die das Modell gerade anbietet. */
function options(vm: ViewModel) {
  return [
    ...vm.sites.filter(r => r.visible).flatMap(r => r.buys),
    ...vm.land.buys,
    vm.storage.buy,
    ...(vm.pilot.next ? [vm.pilot.next] : []),
    ...(vm.levelUp.buy ? [vm.levelUp.buy] : []),
  ];
}

// --- 1. Die ersten Sekunden ------------------------------------------------
console.log('\n=== Erste Sekunden ===');
{
  const sim = new Sim({ seed: 1 });
  let firstBuyable = Infinity;
  for (let t = 0; t < 120 && firstBuyable === Infinity; t++) {
    sim.tick();
    if (options(buildViewModel(sim)).some(o => o.enabled)) firstBuyable = sim.time;
  }
  // CLAUDE.md: das erste Upgrade muss in SEKUNDEN erreichbar sein, nicht in Minuten.
  check('Erster Kauf innerhalb von 30 s möglich', firstBuyable <= 30, `nach ${firstBuyable} s`);

  const vm = buildViewModel(new Sim({ seed: 1 }));
  check('Startbild zeigt Herstellorte', vm.sites.filter(r => r.visible).length > 0,
    `${vm.sites.filter(r => r.visible).length} Zeilen`);
  check('Startbild erklärt den Handbetrieb', vm.pilot.manualWarning && vm.pilot.currentText.length > 20);
  check('Jede Schaltfläche hat Preis und Text',
    options(vm).every(o => o.label.length > 0 && o.costText.length > 0));
}

// --- 2. Ein ganzer Durchlauf ----------------------------------------------
console.log('\n=== Durchlauf: keine Sackgassen ===');
const sim = new Sim({ seed: 1 });
const director = new VoiceDirector(0);
sim.events.on(event => director.handle(event));

let deadEnds = 0;
let deadEndAt = '';
let widest = 0;
let widestAt = '';
let missingWait = 0;
let modelSeconds = 0;
let samples = 0;
const seenLines = new Set<string>();

while (!sim.finished && sim.time < 40 * 3600) {
  sim.tick();
  decide(sim, { buyPilots: true });
  while (director.take() !== null) { /* Zeilen abholen, s. u. */ }

  if (sim.time % 10 !== 0) continue;
  const started = performance.now();
  const vm = buildViewModel(sim);
  modelSeconds += (performance.now() - started) / 1000;
  samples++;

  const offered = options(vm);
  // Sackgasse: nichts kaufbar UND keine Aussicht darauf, dass sich das aendert.
  const reachable = offered.some(o => o.enabled) ||
    offered.some(o => Number.isFinite(sim.secondsUntil(o.cost)));
  if (!reachable) { deadEnds++; if (!deadEndAt) deadEndAt = levelName(sim.level); }

  const visible = vm.sites.filter(r => r.visible).length;
  if (visible > widest) { widest = visible; widestAt = levelName(sim.level); }

  if (offered.some(o => !o.costText) || !vm.levelUp.waitText && !vm.levelUp.finished) missingWait++;
}

check('Durchlauf erreicht das Ende', sim.finished, `${(sim.time / 3600).toFixed(1)} h`);
check('Keine Sackgasse', deadEnds === 0, deadEnds ? `${deadEnds}× ab ${deadEndAt}` : `${samples} Stichproben`);
check('Ortsliste bleibt überschaubar (<= 8)', widest <= 8, `höchstens ${widest} (${widestAt})`);
check('Überall Preis und Wartezeit', missingWait === 0, `${missingWait} Lücken`);
check('Anzeigemodell ist billig genug', modelSeconds / samples < 0.005,
  `${((modelSeconds / samples) * 1000).toFixed(2)} ms je Aufbau`);

// --- 3. Stimmen ------------------------------------------------------------
console.log('\n=== Stimmen ===');
{
  const perLevel = new Map<number, number>();
  for (const line of VOICE_LINES) perLevel.set(line.level, (perLevel.get(line.level) ?? 0) + 1);
  const overCap = [...perLevel.entries()].filter(([, n]) => n > 5);
  const empty = [];
  for (let level = 0; level <= maxLevel(); level++) if (!perLevel.has(level)) empty.push(level);

  check('Höchstens 5 Zeilen je Zoomstufe', overCap.length === 0,
    overCap.map(([l, n]) => `${levelName(l)}: ${n}`).join(', '));
  check('Insgesamt höchstens 70 Zeilen', VOICE_LINES.length <= 70, `${VOICE_LINES.length} Zeilen`);
  check('Jede Zoomstufe hat eine Stimme', empty.length === 0, empty.map(levelName).join(', '));
  check('Keine doppelten Kennungen', new Set(VOICE_LINES.map(l => l.id)).size === VOICE_LINES.length);
  check('Keine doppelten Texte', new Set(VOICE_LINES.map(l => l.text)).size === VOICE_LINES.length);

  // Zeilen, die nie fallen, sind verschenkte Arbeit - und Arbeit ist hier der
  // knappste Rohstoff, weil dieser Text als einziger nicht generiert wird.
  //
  // Geprueft wird gegen ZWEI Spieler: den umsichtigen von oben und einen
  // Anfaenger, der nur baut und das Lager nie anfasst. Der umsichtige laeuft nie
  // ueber - der Anfaenger schon, und genau ihm gilt die Zeile, die es erklaert.
  const sloppy = new Sim({ seed: 2 });
  const sloppyDirector = new VoiceDirector(0);
  sloppy.events.on(event => sloppyDirector.handle(event));
  for (let t = 0; t < 3600; t++) {
    sloppy.tick();
    if (sloppy.canBuySite(1)) sloppy.buySite(1);
    else if (sloppy.canBuySite(0)) sloppy.buySite(0);
    else sloppy.buyParcel();
  }

  for (const line of VOICE_LINES) {
    if (director.hasFired(line.id) || sloppyDirector.hasFired(line.id)) seenLines.add(line.id);
  }
  const unseen = VOICE_LINES.filter(l => !seenLines.has(l.id));
  check('Jede Zeile kommt im Spiel wirklich vor', unseen.length === 0,
    unseen.length ? unseen.map(l => l.id).join(', ') : `${seenLines.size} von ${VOICE_LINES.length}`);
}

// --- 4. Max-Buy und Wartezeiten -------------------------------------------
console.log('\n=== Max-Buy und Wartezeiten ===');
{
  const probe = primed(3, 4);
  probe.cash = probe.cash.mul(4);

  const tier = probe.unlockedTiers() - 2;
  const want = probe.affordableSitesWithLand(tier);
  check('Max-Buy hat überhaupt etwas anzubieten', want > 0, `${want}× ${siteName(tier)}`);
  const quoted = probe.siteTotalCost(tier, want);
  const before = probe.cash;
  const bought = probe.buySiteWithLand(tier, want);
  const spent = before.sub(probe.cash);
  check('Max-Buy kauft die angekündigte Menge', bought === want, `${bought} von ${want}`);
  check('Max-Buy kostet den angekündigten Preis',
    spent.sub(quoted).abs().div(quoted.max(1)).lt(0.001), `${fmt(spent)} statt ${fmt(quoted)}`);
  check('Max-Buy überzieht das Bargeld nicht', probe.cash.gte(0), fmt(probe.cash));

  // Landkauf auf einem eigenen Stand: nach dem Max-Buy oben ist der Vorrat
  // moeglicherweise leer, und ein Test, der nichts kauft, prueft nichts.
  const landProbe = primed(4, 3, 0);
  landProbe.cash = landProbe.cash.add(1e6);
  const parcelsBefore = landProbe.parcels;
  const parcelQuote = landProbe.parcelBulkCost(10);
  const cashBefore = landProbe.cash;
  const got = landProbe.buyParcels(10);
  check('Landpreis stimmt mit dem Sammelkauf überein', got === 10 &&
    cashBefore.sub(landProbe.cash).sub(parcelQuote).abs().div(parcelQuote.max(1)).lt(1e-6),
    `${got} Parzellen, ${fmt(cashBefore.sub(landProbe.cash))} statt ${fmt(parcelQuote)}`);
  check('Parzellen tatsächlich gutgeschrieben', landProbe.parcels === parcelsBefore + got);

  // Wartezeit pruefen: so lange laufen lassen und schauen, ob es dann reicht.
  const waiting = primed(5, 2);
  const target = waiting.levelUpCost();
  const predicted = waiting.secondsUntil(target);
  if (Number.isFinite(predicted) && predicted > 0) {
    for (let t = 0; t < Math.ceil(predicted); t++) waiting.tick();  // NUR ticken, nichts kaufen
    check('Nach der angesagten Wartezeit reicht das Geld',
      waiting.cash.gte(target.mul(0.7)),
      `${fmt(waiting.cash)} von ${fmt(target)} nach ${Math.round(predicted)} s`);
  } else {
    check('Wartezeit war endlich', false, `${predicted}`);
  }
}

// --- 5. Aktionen greifen ---------------------------------------------------
console.log('\n=== Aktionen ===');
{
  const probe = primed(9, 3);
  probe.cash = probe.cash.mul(10);

  const tier = probe.unlockedTiers() - 2;
  const ownedBefore = probe.owned[tier] ?? 0;
  check('Ort bauen', applyAction(probe, { kind: 'site', tier, count: 2 }) &&
    (probe.owned[tier] ?? 0) === ownedBefore + 2, siteName(tier));
  const parcels = probe.parcels;
  check('Land kaufen', applyAction(probe, { kind: 'land', count: 5 }) && probe.parcels > parcels);
  const storageLevel = probe.storageLevel;
  check('Lager vergrößern', applyAction(probe, { kind: 'storage' }) &&
    probe.storageLevel === storageLevel + 1);
  const pilotLevel = probe.pilotLevel;
  check('Statthalter anstellen', applyAction(probe, { kind: 'pilot' }) &&
    probe.pilotLevel === pilotLevel + 1);
  const level = probe.level;
  check('Reichweite ausbauen', applyAction(probe, { kind: 'levelUp' }) && probe.level === level + 1);

  // Bauen muss fehlendes Land mitkaufen - sonst rechnet der Spieler Parzellen
  // im Kopf aus, und genau das verbietet das Leitprinzip.
  // Frisch aufgestiegen, also mit der Startparzelle: der grosse Ort passt nicht
  // aufs eigene Land - genau der Fall, um den es geht.
  const tight = primed(11, 3, 0);
  const big = tight.unlockedTiers() - 1;
  tight.cash = tight.cash.add(1e9);
  const parcelsNeeded = tight.parcelsNeededFor(big, 1);
  const landBefore = tight.parcels;
  const built = tight.buySiteWithLand(big, 1);
  check('Bauen kauft fehlendes Land mit',
    parcelsNeeded > 0 && built === 1 && tight.parcels === landBefore + parcelsNeeded,
    `${parcelsNeeded} Parzellen für ${siteName(big)}`);
}

console.log(`\nM5 ${failures === 0 ? 'BESTANDEN' : `NICHT bestanden (${failures} Fehler)`}`);
process.exit(failures === 0 ? 0 : 1);
