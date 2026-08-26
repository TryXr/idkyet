/**
 * Schale um die Simulation: fixer Timestep, Karte, Bedienfeld, Stimmen.
 *
 * Hier steht bewusst nur die Verdrahtung. Was angezeigt wird, entscheidet
 * model.ts (headless pruefbar), wie es aussieht panel.ts, was gesagt wird
 * content/voices.ts. Der Tempo-Regler bleibt drin - ohne ihn dauert jeder
 * Testdurchlauf sechs Stunden.
 */
import { BALANCE } from '../core/balance.js';
import { Sim } from '../core/sim.js';
import { maxLevel } from '../core/world.js';
import { BrowserStorage } from '../platform/browser-storage.js';
import { MapView } from '../render/map.js';
import { VoiceDirector } from '../content/voices.js';
import { HINTS } from '../content/texts.js';
import { applyAction, buildViewModel } from './model.js';
import { Panel } from './panel.js';
import { VoicesView } from './voices-view.js';
import type { MarketNode } from '../core/market.js';

const storage = new BrowserStorage();
const sim = Sim.load(storage) ?? new Sim({ seed: 1 });

const director = new VoiceDirector(sim.level);
sim.events.on(event => director.handle(event));

const map = new MapView({
  onToggleNode: id => {
    const node = sim.nodes.find(n => n.id === id);
    if (node) sim.setNodeEnabled(id, !node.enabled);
  },
});

const mapHost = document.getElementById('map')!;
await map.mount(mapHost, 1);
map.setLevel(sim.level, sim.nodes);

const panel = new Panel(document.getElementById('panel')!, action => {
  applyAction(sim, action);
  refreshPanel();
});
const voices = new VoicesView(document.getElementById('voices')!);
document.getElementById('mapHint')!.textContent = HINTS.map;

/** Waehrend des Stufenwechsels wird noch die ALTE Ebene gezeichnet. */
let renderNodes: readonly MarketNode[] = sim.nodes;
let lastLevel = sim.level;

let speed = 1;
let accumulator = 0;
let lastFrame = performance.now();
let sincePanel = 0;

/** Ab dieser Luecke war der Tab weg (Hintergrund, Standby) - dann wird
 *  nicht Bild fuer Bild nachgeholt, sondern grob nachgerechnet. */
const CATCHUP_THRESHOLD = 2;
/** Das Bedienfeld muss nicht mit 60 Hz rechnen; viermal je Sekunde liest
 *  sich ruhiger und spart die Sammelpreis-Rechnerei. */
const PANEL_INTERVAL = 0.25;

function refreshPanel(): void {
  panel.update(buildViewModel(sim));
  sincePanel = 0;
}

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
  voices.update(director, realDt);

  sincePanel += realDt;
  if (sincePanel >= PANEL_INTERVAL) refreshPanel();

  requestAnimationFrame(step);
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
    panel,
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

refreshPanel();
requestAnimationFrame(step);
