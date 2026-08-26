/**
 * Schale um die Simulation: fixer Timestep, Karte, ein paar Knoepfe.
 *
 * Die eigentliche Bedienung kommt in M5. Was hier steht, reicht, um sich durch
 * alle 14 Stufen zu spielen und den Zoom zu pruefen - inklusive Tempo-Regler,
 * denn sonst dauert ein Testdurchlauf sechs Stunden.
 */
import { BALANCE } from '../core/balance.js';
import { fmt, fmtTime } from '../core/numbers.js';
import { Sim } from '../core/sim.js';
import { levelName, maxLevel } from '../core/world.js';
import { siteName } from '../core/production.js';
import { ownedFraction, parcelPool } from '../core/land.js';
import { BrowserStorage } from '../platform/browser-storage.js';
import { MapView } from '../render/map.js';
import type { MarketNode } from '../core/market.js';

const storage = new BrowserStorage();
const sim = Sim.load(storage) ?? new Sim({ seed: 1 });

const map = new MapView({
  onToggleNode: id => {
    const node = sim.nodes.find(n => n.id === id);
    if (node) sim.setNodeEnabled(id, !node.enabled);
  },
});

const mapHost = document.getElementById('map')!;
await map.mount(mapHost, 1);
map.setLevel(sim.level, sim.nodes);

/** Waehrend des Stufenwechsels wird noch die ALTE Ebene gezeichnet. */
let renderNodes: readonly MarketNode[] = sim.nodes;
let lastLevel = sim.level;

let speed = 1;
let accumulator = 0;
let lastFrame = performance.now();

/** Ab dieser Luecke war der Tab weg (Hintergrund, Standby) - dann wird
 *  nicht Bild fuer Bild nachgeholt, sondern grob nachgerechnet. */
const CATCHUP_THRESHOLD = 2;

function step(now: number): void {
  const gap = (now - lastFrame) / 1000;
  lastFrame = now;

  if (gap > CATCHUP_THRESHOLD) {
    // Hintergrund-Tabs bekommen kaum noch Frames. Die verstrichene Zeit einfach
    // wegzuwerfen waere bei einem Idle-Game das Schlimmste, was man tun kann -
    // also grob nachrechnen, gedeckelt wie beim Offline-Fortschritt.
    sim.applyOffline(Math.min(gap * speed, BALANCE.offlineCapSeconds));
    accumulator = 0;
  } else {
    // Fixer Timestep. Die Simulation sieht immer exakt gleich grosse Schritte,
    // egal wie schnell der Rechner zeichnet - sonst waere sie nicht deterministisch.
    accumulator += gap * speed;
    let steps = 0;
    while (accumulator >= BALANCE.tickSeconds && steps < 4000) {
      sim.tick(BALANCE.tickSeconds);
      accumulator -= BALANCE.tickSeconds;
      steps++;
    }
    if (steps >= 4000) accumulator = 0;
  }
  const realDt = Math.min(0.25, gap);

  if (sim.level !== lastLevel && !map.isTransitioning) {
    const nextLevel = sim.level;
    const nextNodes = sim.nodes;
    lastLevel = nextLevel;
    map.playLevelChange(() => {
      renderNodes = nextNodes;
      map.setLevel(nextLevel, nextNodes);
    });
  }

  map.render(renderNodes, realDt);
  updatePanel();
  requestAnimationFrame(step);
}

// --- Bedienfeld ----------------------------------------------------------

const statsEl = document.getElementById('stats')!;
const actionsEl = document.getElementById('actions')!;
const levelNameEl = document.getElementById('levelName')!;
const levelIndexEl = document.getElementById('levelIndex')!;

interface Action {
  label: string;
  cost?: string;
  enabled: boolean;
  run: () => void;
}

function bestTier(): number {
  let best = -1;
  let bestPayback = Infinity;
  for (let tier = 0; tier < sim.unlockedTiers(); tier++) {
    if (!sim.canBuySite(tier)) continue;
    const payback = sim.paybackSeconds(tier);
    if (payback < bestPayback) { bestPayback = payback; best = tier; }
  }
  return best;
}

function updatePanel(): void {
  levelNameEl.textContent = levelName(sim.level);
  levelIndexEl.textContent = `Stufe ${sim.level} von ${maxLevel()}`;

  const land = ownedFraction(sim.parcels, parcelPool(sim.level));
  const rows: Array<[string, string]> = [
    ['Bargeld', fmt(sim.cash)],
    ['pro Sekunde', fmt(sim.incomeRate)],
    ['Produktion', `${fmt(sim.output())} /s`],
    ['Absatz möglich', `${fmt(sim.capacity())} /s`],
    ['Lager', `${fmt(sim.storage)} / ${fmt(sim.storageCap())}`],
    ['Land', `${(land * 100).toFixed(1)} %`],
    ['Statthalter', sim.pilotLevel === 0 ? 'Handbetrieb' : `Stufe ${sim.pilotLevel}`],
    ['Spielzeit', fmtTime(sim.time)],
  ];
  statsEl.innerHTML = rows
    .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
    .join('');

  const tier = bestTier();
  const pilot = sim.nextPilot();
  const actions: Action[] = [];

  if (tier >= 0) {
    actions.push({
      label: `${siteName(tier)} bauen`,
      cost: fmt(sim.siteBulkCost(tier, 1)),
      enabled: true,
      run: () => sim.buySite(tier),
    });
    const many = Math.min(sim.affordableSites(tier), 25);
    if (many > 1) {
      actions.push({
        label: `${many}× ${siteName(tier)}`,
        cost: fmt(sim.siteBulkCost(tier, many)),
        enabled: true,
        run: () => sim.buySites(tier, many),
      });
    }
  }
  actions.push({
    label: 'Land kaufen',
    cost: fmt(sim.nextParcelCost()),
    enabled: sim.cash.gte(sim.nextParcelCost()) && sim.parcels < parcelPool(sim.level),
    run: () => sim.buyParcels(25),
  });
  actions.push({
    label: 'Lager vergrößern',
    cost: fmt(sim.storageCost()),
    enabled: sim.cash.gte(sim.storageCost()),
    run: () => sim.buyStorage(),
  });
  if (pilot) {
    actions.push({
      label: pilot.name,
      cost: fmt(pilot.cost),
      enabled: sim.cash.gte(pilot.cost),
      run: () => sim.buyPilot(),
    });
  }
  actions.push({
    label: sim.level >= maxLevel() ? 'Geschafft' : `Weiter nach ${levelName(sim.level + 1)}`,
    cost: sim.level >= maxLevel() ? '' : fmt(sim.levelUpCost()),
    enabled: sim.canLevelUp(),
    run: () => sim.levelUp(),
  });

  renderActions(actions);
}

let actionSignature = '';

function renderActions(actions: Action[]): void {
  // Nur neu aufbauen, wenn sich wirklich etwas aendert - sonst flackert es und
  // Klicks gehen verloren.
  const signature = actions.map(a => `${a.label}|${a.cost}|${a.enabled}`).join('§');
  if (signature === actionSignature) return;
  actionSignature = signature;

  actionsEl.replaceChildren(...actions.map(action => {
    const button = document.createElement('button');
    button.disabled = !action.enabled;
    button.innerHTML = `${action.label}${action.cost ? `<span class="cost">${action.cost}</span>` : ''}`;
    button.addEventListener('click', () => { action.run(); actionSignature = ''; });
    return button;
  }));
}

// --- Tempo (Testhilfe) ---------------------------------------------------

const speedEl = document.getElementById('speed')!;
for (const factor of [1, 10, 120, 900]) {
  const button = document.createElement('button');
  button.textContent = `${factor}×`;
  button.setAttribute('aria-pressed', String(factor === speed));
  button.addEventListener('click', () => {
    speed = factor;
    for (const other of speedEl.children) {
      other.setAttribute('aria-pressed', String(other === button));
    }
  });
  speedEl.appendChild(button);
}

// --- Speichern -----------------------------------------------------------

const autosave = setInterval(() => sim.save(storage), 10_000);
const saveOnExit = () => sim.save(storage);
globalThis.addEventListener('beforeunload', saveOnExit);

// Nur im Entwicklungsbuild: Simulation von der Konsole aus erreichbar, damit
// man Zoomstufen anspringen kann, ohne sechs Stunden zu spielen.
if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    sim,
    map,
    jumpTo(level: number) {
      while (sim.level < level && sim.level < maxLevel()) {
        sim.cash = sim.cash.add(sim.levelUpCost().mul(2));
        sim.levelUp();
      }
    },
    /** Sauber von vorn. Autospeicher und Exit-Handler MUESSEN vorher weg,
     *  sonst schreibt die alte Seite den Stand waehrend des Neuladens zurueck. */
    reset() {
      clearInterval(autosave);
      globalThis.removeEventListener('beforeunload', saveOnExit);
      storage.clear();
      location.reload();
    },
  });
}

requestAnimationFrame(step);
