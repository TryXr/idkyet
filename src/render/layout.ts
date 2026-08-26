/**
 * Wo liegen die Knoten auf der Karte?
 *
 * Bewusst NICHT im Kern: die Simulation braucht keine Koordinaten, und der Kern
 * bleibt dadurch frei von Darstellungskram. Die Lage ist trotzdem
 * deterministisch aus Seed und Stufe ableitbar, also ueberall identisch.
 *
 * Koordinaten sind IMMER lokal (etwa -1..1) und werden bei jedem Stufenwechsel
 * neu auf den Ursprung bezogen. Absolute Weltkoordinaten ueber 14 Stufen waeren
 * rund 1e14 - da bricht die Fliesskomma-Genauigkeit in der Renderpipeline lange
 * vorher. Siehe PLAN.md, Abschnitt Risiken.
 */
import { Rng } from '../core/rng.js';
import type { MarketNode } from '../core/market.js';

export interface NodeLayout {
  id: number;
  x: number;
  y: number;
  radius: number;
}

/**
 * Knoten in einer Scheibe verteilen, mit Mindestabstand. Kein echtes
 * Packing-Verfahren - ein paar Versuche pro Knoten reichen voellig und bleiben
 * deterministisch.
 */
export function layoutLevel(level: number, seed: number, nodes: readonly MarketNode[]): NodeLayout[] {
  const rng = new Rng(seed * 31337 + level * 6151 + 17);
  const maxDemand = Math.max(...nodes.map(n => n.demand), 1);
  const placed: NodeLayout[] = [];

  for (const node of nodes) {
    // Flaeche proportional zur Nachfrage - grosse Maerkte sehen gross aus.
    const radius = 0.05 + 0.11 * Math.sqrt(node.demand / maxDemand);
    let best = { x: 0, y: 0, score: -Infinity };

    for (let attempt = 0; attempt < 40; attempt++) {
      // Gleichverteilt in der Scheibe (Wurzel, sonst klumpt es in der Mitte).
      const angle = rng.next() * Math.PI * 2;
      const distance = Math.sqrt(rng.next()) * (1 - radius);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      let nearest = Infinity;
      for (const other of placed) {
        const gap = Math.hypot(x - other.x, y - other.y) - other.radius - radius;
        nearest = Math.min(nearest, gap);
      }
      if (nearest > best.score) best = { x, y, score: nearest };
      if (nearest > 0.04) break; // gut genug
    }
    placed.push({ id: node.id, x: best.x, y: best.y, radius });
  }
  return placed;
}
