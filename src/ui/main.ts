/**
 * Schale um die Simulation: fixer Timestep, Karte, Bedienfeld, Stimmen.
 *
 * Hier steht bewusst nur die Verdrahtung. Was angezeigt wird, entscheidet
 * model.ts (headless pruefbar), wie es aussieht panel.ts, was gesagt wird
 * content/voices.ts. Der Tempo-Regler bleibt drin - ohne ihn dauert jeder
 * Testdurchlauf fuenf Stunden.
 */
import { BALANCE } from '../core/balance.js';
import { Sim } from '../core/sim.js';
import { applyDemoLimit } from '../core/config.js';
import { maxLevel } from '../core/world.js';
import { BrowserStorage } from '../platform/browser-storage.js';
import { MapView } from '../render/map.js';
import { VoiceDirector } from '../content/voices.js';
import { applyAction, buildViewModel } from './model.js';
import { Panel } from './panel.js';
import { VoicesView } from './voices-view.js';
import { EndingView } from './ending.js';
import type { Territory } from '../core/territory.js';

// Der Zuschnitt wird HIER gesetzt, nicht im Kern: die Simulation soll nichts
// von Build-Variablen wissen (CLAUDE.md, Architektur). Gebaut wird die Demo mit
// `npm run build:demo`.
if (import.meta.env.VITE_DEMO === '1') applyDemoLimit();

const storage = new BrowserStorage();

/**
 * Laden darf nie die Seite kosten. Ein Stand aus einer aelteren Fassung, ein
 * halb geschriebener Eintrag, ein fremder Schluessel - in jedem Fall faengt das
 * Spiel neu an, statt mit einer weissen Seite dazustehen. Ohne diesen Fang
 * haette ein Spieler mit kaputtem Stand keinen Weg zurueck.
 */
function loadOrStartFresh(): { sim: Sim; discarded: boolean } {
  try {
    const loaded = Sim.load(storage);
    if (loaded) return { sim: loaded, discarded: false };
  } catch (error) {
    console.warn('Speicherstand passt nicht zu dieser Fassung, fange neu an:', error);
    storage.clear();
    return { sim: new Sim({ seed: 1 }), discarded: true };
  }
  return { sim: new Sim({ seed: 1 }), discarded: false };
}

const { sim } = loadOrStartFresh();

const director = new VoiceDirector(sim.level);
sim.events.on(event => director.handle(event));

const map = new MapView({
  /** Ein Klick waehlt das Zielgebiet - der einzige aktive Handgriff im Spiel. */
  onPickNode: id => {
    sim.setTarget(id);
    map.pulse(id);
    refreshPanel();
  },
});

const mapHost = document.getElementById('map')!;
await map.mount(mapHost, 1);
map.setLevel(sim.level, sim.territories);

const panel = new Panel(document.getElementById('panel')!, action => {
  applyAction(sim, action);
  refreshPanel();
});
const voices = new VoicesView(document.getElementById('voices')!);
const ending = new EndingView(document.getElementById('ending')!);
const mapHintEl = document.getElementById('mapHint')!;

/** Waehrend des Ebenenwechsels wird noch die ALTE Ebene gezeichnet. */
let renderTerritories: readonly Territory[] = sim.territories;
let lastLevel = sim.level;

let speed = 1;
let accumulator = 0;
let lastFrame = performance.now();
let sincePanel = 0;

/** Ab dieser Luecke war der Tab weg (Hintergrund, Standby) - dann wird
 *  nicht Bild fuer Bild nachgeholt, sondern grob nachgerechnet. */
const CATCHUP_THRESHOLD = 2;
/** Das Bedienfeld muss nicht mit 60 Hz rechnen; viermal je Sekunde liest
 *  sich ruhiger. */
const PANEL_INTERVAL = 0.25;

function refreshPanel(): void {
  const vm = buildViewModel(sim);
  panel.update(vm);
  if (mapHintEl.textContent !== vm.mapHint) mapHintEl.textContent = vm.mapHint;
  map.setTarget(vm.target?.id ?? null);
  ending.update(vm.ending);
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
    const nextTerritories = sim.territories;
    lastLevel = nextLevel;
    map.playLevelChange(() => {
      renderTerritories = nextTerritories;
      map.setLevel(nextLevel, nextTerritories);
    });
  }

  map.render(renderTerritories, realDt);
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
// man Ebenen anspringen kann, ohne fuenf Stunden zu spielen.
if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    sim,
    map,
    panel,
    /** Alle Gebiete der aktuellen Ebene uebernehmen und weiterziehen. */
    jumpTo(level: number) {
      while (sim.level < level && sim.level < maxLevel()) {
        for (const t of sim.territories) { t.supplied = t.demand; t.owned = true; }
        sim.tick(0.001);
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
