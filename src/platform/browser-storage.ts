/** localStorage-Anbindung. Einzige Datei im Projekt, die localStorage kennt. */
import type { StorageAdapter } from '../core/save.js';

export class BrowserStorage implements StorageAdapter {
  constructor(private readonly key = 'idkyet.save') {}
  load(): string | null {
    try { return globalThis.localStorage?.getItem(this.key) ?? null; } catch { return null; }
  }
  save(payload: string): void {
    try { globalThis.localStorage?.setItem(this.key, payload); } catch { /* Speicher voll oder gesperrt */ }
  }
  clear(): void {
    try { globalThis.localStorage?.removeItem(this.key); } catch { /* egal */ }
  }
}
