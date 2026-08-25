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

export const SAVE_VERSION = 1;

export interface SaveV1 {
  v: number;
  savedAt: number;          // Wanduhr, fuer den Offline-Fortschritt
  time: number;             // gespielte Sekunden
  cash: string;             // Decimal als String - ueberlebt jede Groesse
  lifetime: string;
  level: number;
  parcels: number;
  owned: number[];
  storage: number;
  storageLevel: number;
  pilotLevel: number;
  seed: number;
  rngState: number;
  /** Nur der veraenderliche Zustand der Knoten - der Rest kommt aus dem Seed. */
  nodes: Array<{ p: number; h: number; lockedFor: number; priceMult: number; enabled: boolean }>;
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

/**
 * Alte Staende auf die aktuelle Version heben.
 * Jede kuenftige Version bekommt hier einen eigenen Schritt - deshalb steht die
 * Versionsnummer von Anfang an im Format, auch wenn es erst eine gibt.
 */
export function migrate(raw: unknown): SaveV1 {
  if (typeof raw !== 'object' || raw === null) throw new Error('Speicherstand unlesbar');
  const save = raw as Partial<SaveV1>;
  const version = save.v ?? 0;
  if (version > SAVE_VERSION) {
    throw new Error(`Speicherstand ist aus einer neueren Version (${version} > ${SAVE_VERSION})`);
  }
  // Kuenftig: if (version < 2) { ...auf 2 heben... }
  return save as SaveV1;
}

/** Vergangene Zeit seit dem Speichern, gedeckelt. */
export function offlineSeconds(save: SaveV1, now = Date.now()): { seconds: number; capped: boolean } {
  const elapsed = Math.max(0, (now - save.savedAt) / 1000);
  const capped = elapsed > BALANCE.offlineCapSeconds;
  return { seconds: Math.min(elapsed, BALANCE.offlineCapSeconds), capped };
}
