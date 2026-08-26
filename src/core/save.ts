/**
 * Speichern, Laden, Offline-Fortschritt.
 *
 * Der StorageAdapter ist die einzige Stelle, an der das Spiel etwas ueber
 * seine Umgebung weiss. Web nutzt localStorage, der Desktop-Build eine Datei,
 * spaeter optional Steam Cloud - der Spielcode merkt davon nichts.
 * Direkte localStorage-Zugriffe ausserhalb dieser Datei sind verboten
 * (CLAUDE.md, Architektur-Regel 2).
 */
import { BALANCE } from './balance.js';

export const SAVE_VERSION = 2;

export interface SaveV2 {
  v: number;
  savedAt: number;          // Wanduhr, fuer den Offline-Fortschritt
  time: number;             // gespielte Sekunden
  cash: string;             // Decimal als String - ueberlebt jede Groesse
  lifetime: string;
  level: number;
  cook: number[];
  sell: number[];
  rooms: number[];
  storage: number;
  storageLevel: number;
  pastRent: number;
  targetId: number | null;
  seed: number;
  rngState: number;
  /** Nur der Versorgungsstand - die Gebiete selbst kommen aus dem Seed. */
  supplied: number[];
}

export interface StorageAdapter {
  load(): string | null;
  save(payload: string): void;
  clear(): void;
}

/** Fuer Tests und den Headless-Betrieb. */
export class MemoryStorage implements StorageAdapter {
  private payload: string | null = null;
  load(): string | null { return this.payload; }
  save(payload: string): void { this.payload = payload; }
  clear(): void { this.payload = null; }
}

/** Ein Stand, der zu diesem Build nicht passt. Die Schale faengt das ab und
 *  faengt neu an, statt mit einer weissen Seite dazustehen. */
export class IncompatibleSaveError extends Error {}

/**
 * Alte Staende auf die aktuelle Version heben.
 *
 * Version 1 war das Marktmodell mit Preis, Hitze und Statthaltern (Tag
 * `v1-marktmodell`). Daraus laesst sich kein Stand dieses Spiels ableiten -
 * es gibt keine Gebiete, keine Ketten und keine Raeume darin. Solche Staende
 * werden deshalb abgelehnt, nicht halb uebersetzt.
 */
export function migrate(raw: unknown): SaveV2 {
  if (typeof raw !== 'object' || raw === null) {
    throw new IncompatibleSaveError('Speicherstand unlesbar');
  }
  const save = raw as Partial<SaveV2>;
  const version = save.v ?? 0;
  if (version > SAVE_VERSION) {
    throw new IncompatibleSaveError(
      `Speicherstand ist aus einer neueren Version (${version} > ${SAVE_VERSION})`);
  }
  if (version < SAVE_VERSION) {
    throw new IncompatibleSaveError(`Speicherstand ist aus Version ${version} und passt nicht mehr`);
  }
  return save as SaveV2;
}

/** Vergangene Zeit seit dem Speichern, gedeckelt. */
export function offlineSeconds(save: SaveV2, now = Date.now()): { seconds: number; capped: boolean } {
  const elapsed = Math.max(0, (now - save.savedAt) / 1000);
  const capped = elapsed > BALANCE.offlineCapSeconds;
  return { seconds: Math.min(elapsed, BALANCE.offlineCapSeconds), capped };
}
