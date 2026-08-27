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
import type { StoredNum } from './numbers.js';

export const SAVE_VERSION = 4;

export interface SaveV4 {
  v: number;
  savedAt: number;          // Wanduhr, fuer den Offline-Fortschritt
  time: number;             // gespielte Sekunden
  /** Mantisse und Exponent - verlustfrei, siehe numbers.ts. */
  cash: StoredNum;
  lifetime: StoredNum;
  level: number;
  cook: number[];
  sell: number[];
  rooms: number[];
  /** Pflanzen, reifende Stecklinge und die Stellung des Reglers. */
  plants: number;
  seedlings: number;
  seedShare: number;
  storage: number;
  storageLevel: number;
  pastRent: number;
  targetId: number | null;
  seed: number;
  rngState: number;
  /** Nur der Versorgungsstand - die Gebiete selbst kommen aus dem Seed. */
  supplied: number[];
  /** Was die Konkurrenz dort schon abgesetzt hat, und was ihr gehoert. */
  rival: number[];
  lost: boolean[];
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
 * `v1-marktmodell`), Version 2 das Gebietsmodell ohne Pflanzen. Aus beiden
 * laesst sich kein Stand dieses Spiels ableiten: in v1 gibt es weder Gebiete
 * noch Raeume, in v2 keine Pflanzen - und ohne Pflanzen ist der Ertrag null,
 * der Stand also unspielbar. Solche Staende werden abgelehnt, nicht halb
 * uebersetzt.
 */
export function migrate(raw: unknown): SaveV4 {
  if (typeof raw !== 'object' || raw === null) {
    throw new IncompatibleSaveError('Speicherstand unlesbar');
  }
  const save = raw as Partial<SaveV4>;
  const version = save.v ?? 0;
  if (version > SAVE_VERSION) {
    throw new IncompatibleSaveError(
      `Speicherstand ist aus einer neueren Version (${version} > ${SAVE_VERSION})`);
  }
  if (version < SAVE_VERSION) {
    throw new IncompatibleSaveError(`Speicherstand ist aus Version ${version} und passt nicht mehr`);
  }
  return save as SaveV4;
}

/** Vergangene Zeit seit dem Speichern, gedeckelt. */
export function offlineSeconds(save: SaveV4, now = Date.now()): { seconds: number; capped: boolean } {
  const elapsed = Math.max(0, (now - save.savedAt) / 1000);
  const capped = elapsed > BALANCE.offlineCapSeconds;
  return { seconds: Math.min(elapsed, BALANCE.offlineCapSeconds), capped };
}
