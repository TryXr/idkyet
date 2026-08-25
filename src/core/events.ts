/**
 * Benannte Spielereignisse.
 *
 * Die Simulation feuert sie, eine duenne Schicht hoert zu. Im Web werden sie
 * ignoriert, im spaeteren Steam-Build meldet ein Adapter sie an Steamworks.
 * Erfolge duerfen NIE im UI-Code entstehen (siehe CLAUDE.md, Architektur-Regel 4)
 * - sonst ist der Port Handarbeit.
 */
export type GameEvent =
  | { type: 'levelUp'; level: number; at: number }
  | { type: 'marketLocked'; nodeId: number; at: number }
  | { type: 'siteBought'; tier: number; count: number; at: number }
  | { type: 'milestoneReached'; tier: number; threshold: number; at: number }
  | { type: 'pilotUpgraded'; pilotLevel: number; at: number }
  | { type: 'landFull'; at: number }
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
