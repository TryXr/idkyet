/**
 * Benannte Spielereignisse.
 *
 * Die Simulation feuert sie, eine duenne Schicht hoert zu. Im Web werden sie
 * ignoriert, im spaeteren Steam-Build meldet ein Adapter sie an Steamworks.
 * Erfolge duerfen NIE im UI-Code entstehen (siehe CLAUDE.md, Architektur-Regel 4)
 * - sonst ist der Port Handarbeit.
 */
import type { ChainKey } from './chains.js';

export type GameEvent =
  | { type: 'levelUp'; level: number; at: number }
  /** Ein Gebiet ist zu 100 % versorgt und gehoert ab jetzt dir. */
  | { type: 'territoryTaken'; level: number; id: number; name: string; rent: number; at: number }
  | { type: 'roomBought'; tier: number; count: number; at: number }
  | { type: 'unitBought'; chain: ChainKey; tier: number; count: number; at: number }
  | { type: 'milestoneReached'; chain: ChainKey; tier: number; threshold: number; at: number }
  | { type: 'storageFull'; at: number }
  | { type: 'offlineProgress'; seconds: number; capped: boolean; at: number }
  | { type: 'finished'; at: number };

export type EventListener = (event: GameEvent) => void;

export class EventBus {
  private listeners: EventListener[] = [];

  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
