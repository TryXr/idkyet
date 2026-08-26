/**
 * Was von diesem Build ueberhaupt erreichbar ist.
 *
 * Getrennt von balance.ts, weil hier keine Balance steht, sondern der
 * ZUSCHNITT: die Demo endet frueher als die Vollversion. Laut CLAUDE.md muss
 * dieses Flag von Anfang an existieren - ein fertiges Spiel nachtraeglich in
 * Demo und Vollversion zu trennen ist Handarbeit an hundert Stellen.
 *
 * Der Kern liest nur diese Werte. Gesetzt werden sie am Rand (src/ui/main.ts
 * aus der Build-Variable, in Werkzeugen von Hand) - so weiss die Simulation
 * nichts von Vite, und der spaetere Desktop-Build setzt sie genauso.
 */
import { LEVELS } from './balance.js';

/** Bis hierher reicht die Demo: rund die ersten anderthalb Stunden. */
export const DEMO_MAX_LEVEL = 5;

export const CONFIG = {
  /** Hoechste erreichbare Zoomstufe. */
  maxLevel: LEVELS.length - 1,
  /** Nur fuer die Anzeige am Ende: "weiter geht es in der Vollversion". */
  demo: false,
};

/** Den Build auf die Demo zuschneiden. */
export function applyDemoLimit(): void {
  CONFIG.demo = true;
  CONFIG.maxLevel = Math.min(CONFIG.maxLevel, DEMO_MAX_LEVEL);
}

/** Zurueck auf die Vollversion - fuer Messlaeufe, die beides pruefen. */
export function applyFullVersion(): void {
  CONFIG.demo = false;
  CONFIG.maxLevel = LEVELS.length - 1;
}
