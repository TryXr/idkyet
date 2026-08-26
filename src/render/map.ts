/**
 * Die Karte. PixiJS zeichnet ausschliesslich die ~15 Knoten der aktuellen
 * Zoomstufe - alles Feinere ist im Elternknoten zusammengeklappt und laeuft
 * automatisch (CLAUDE.md, Knoten-Aggregation).
 *
 * Beim Stufenwechsel schrumpft die bisherige Ebene zu einem Punkt, dann wird
 * der Ursprung NEU GESETZT und die naechste Ebene faechert sich darum auf.
 * Dadurch bleiben die Koordinaten immer im Bereich -1..1, egal ob Strassenecke
 * oder Sonnensystem. Ohne dieses Umsetzen waeren wir nach 14 Stufen bei rund
 * 1e14 und die Fliesskomma-Genauigkeit waere lange dahin.
 */
import { Application, Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';
import type { MarketNode } from '../core/market.js';
import { isSellable, nodePrice } from '../core/market.js';
import { layoutLevel, type NodeLayout } from './layout.js';

const COLORS = {
  background: 0x11131a,
  crashed: 0xc2452f,   // Preis am Boden
  fair: 0xd7a13b,      // mittel
  rich: 0x4c9f6a,      // frischer Markt
  heat: 0xe8623c,
  locked: 0x3a3f4d,
  disabled: 0x2a2e39,
  outline: 0xf0f2f5,
  parent: 0x232734,
};

/** Farbe zwischen zwei Werten mischen. */
function mix(a: number, b: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (
    ((ar + (br - ar) * clamped) << 16) |
    ((ag + (bg - ag) * clamped) << 8) |
    (ab + (bb - ab) * clamped)
  ) & 0xffffff;
}

const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface NodeVisual {
  layout: NodeLayout;
  body: Graphics;
  label: Text;
}

export interface MapCallbacks {
  /** Klick auf ein Gebiet. Was er bedeutet, entscheidet der Spielstand:
   *  im Handbetrieb ausliefern, mit Statthalter an- und abschalten. */
  onPickNode?: (nodeId: number) => void;
}

export class MapView {
  readonly app = new Application();
  /** Traegt die Knoten. Wird beim Stufenwechsel skaliert, nie die Buehne. */
  private world = new Container();
  private parentHalo = new Graphics();
  private visuals: NodeVisual[] = [];
  private seed = 1;
  private level = 0;

  /** Sichtfeld: 1 = ganze Ebene im Bild. */
  private zoom = 1;
  private targetZoom = 1;
  private panX = 0;
  private panY = 0;

  /** Laufende Lieferungen: Knoten-Id -> Restzeit des Signals in Sekunden. */
  private pulses = new Map<number, number>();

  /** Laufender Stufenwechsel. */
  private transition: { progress: number; onRebase: () => void } | null = null;

  constructor(private callbacks: MapCallbacks = {}) {}

  async mount(parent: HTMLElement, seed: number): Promise<void> {
    this.seed = seed;
    await this.app.init({
      background: COLORS.background,
      antialias: true,
      resizeTo: parent,
      // Auf HiDPI scharf, aber nicht ueber 2 - sonst kostet es unnoetig Fuellrate.
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    parent.appendChild(this.app.canvas);
    this.world.addChild(this.parentHalo);
    this.app.stage.addChild(this.world);
    this.installControls();
  }

  private installControls(): void {
    const canvas = this.app.canvas;
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0012);
      this.targetZoom = Math.max(0.55, Math.min(6, this.targetZoom * factor));
    }, { passive: false });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener('pointerdown', event => {
      dragging = true; lastX = event.clientX; lastY = event.clientY;
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointerleave', () => { dragging = false; });
    canvas.addEventListener('pointermove', event => {
      if (!dragging) return;
      this.panX += event.clientX - lastX;
      this.panY += event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
    });
  }

  /** Ebene aufbauen. Setzt den Ursprung zurueck - hier passiert das Umsetzen. */
  setLevel(level: number, nodes: readonly MarketNode[]): void {
    this.level = level;
    for (const visual of this.visuals) {
      visual.body.destroy();
      visual.label.destroy();
    }
    this.visuals = [];

    for (const layout of layoutLevel(level, this.seed, nodes)) {
      const body = new Graphics();
      body.eventMode = 'static';
      body.cursor = 'pointer';
      body.on('pointertap', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        this.callbacks.onPickNode?.(layout.id);
      });
      const label = new Text({
        text: '',
        style: { fill: 0xdfe3ea, fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      });
      label.anchor.set(0.5);
      this.world.addChild(body);
      this.world.addChild(label);
      this.visuals.push({ layout, body, label });
    }
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.targetZoom = 1;
  }

  /**
   * Eine Lieferung sichtbar machen. Ohne diese Rueckmeldung fuehlt sich der
   * Handverkauf an, als passiere nichts - der Preis faellt zwar, aber langsam,
   * und der Spieler klickt in der ersten Minute ins Leere.
   */
  pulse(nodeId: number): void {
    this.pulses.set(nodeId, 0.45);
  }

  /**
   * Stufenwechsel anzeigen. Die alte Ebene schrumpft zum Punkt, dann wird
   * umgesetzt und die neue faechert auf.
   */
  playLevelChange(onRebase: () => void): void {
    this.transition = { progress: 0, onRebase };
  }

  get isTransitioning(): boolean {
    return this.transition !== null;
  }

  /** Jeden Frame aufrufen. `dt` in Sekunden. */
  render(nodes: readonly MarketNode[], dt: number): void {
    this.advanceTransition(dt);
    for (const [id, left] of this.pulses) {
      if (left <= dt) this.pulses.delete(id); else this.pulses.set(id, left - dt);
    }

    const { width, height } = this.app.screen;
    const base = Math.min(width, height) * 0.44;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 8);

    let scale = base * this.zoom;
    let alpha = 1;

    if (this.transition) {
      const t = easeInOut(Math.min(1, this.transition.progress));
      if (this.transition.progress < 1) {
        // Erste Haelfte: alte Ebene schrumpft und verblasst.
        scale *= 1 - 0.92 * t;
        alpha = 1 - t;
      }
    }

    this.world.position.set(width / 2 + this.panX, height / 2 + this.panY);
    this.world.scale.set(1);
    this.world.alpha = alpha;

    this.drawParentHalo(scale);
    for (const visual of this.visuals) {
      const node = nodes[visual.layout.id];
      if (!node) continue;
      this.drawNode(visual, node, scale);
    }
  }

  private advanceTransition(dt: number): void {
    if (!this.transition) return;
    this.transition.progress += dt / 0.55;
    if (this.transition.progress >= 1) {
      const { onRebase } = this.transition;
      this.transition = null;
      onRebase();          // hier wird der Ursprung neu gesetzt
      this.targetZoom = 1;
      this.zoom = 1.35;    // die neue Ebene faechert von aussen ein
    }
  }

  /** Andeutung der Ebene darunter - macht das Herauszoomen lesbar. */
  private drawParentHalo(scale: number): void {
    this.parentHalo.clear();
    if (this.level === 0) return;
    this.parentHalo.circle(0, 0, scale * 1.02);
    this.parentHalo.stroke({ width: 1, color: COLORS.parent, alpha: 0.9 });
  }

  private drawNode(visual: NodeVisual, node: MarketNode, scale: number): void {
    const { layout, body, label } = visual;
    const x = layout.x * scale;
    const y = layout.y * scale;
    const radius = Math.max(3, layout.radius * scale);

    let fill: number;
    if (node.lockedFor > 0) fill = COLORS.locked;
    else if (!node.enabled) fill = COLORS.disabled;
    else fill = mix(COLORS.crashed, COLORS.rich, node.p);
    if (node.enabled && node.lockedFor <= 0 && node.p > 0.55) {
      fill = mix(COLORS.fair, COLORS.rich, (node.p - 0.55) / 0.45);
    }

    body.clear();
    body.circle(x, y, radius);
    body.fill({ color: fill, alpha: isSellable(node) ? 1 : 0.55 });

    // Hitze als Ring aussen herum.
    if (node.h > 0.02) {
      body.circle(x, y, radius + 3);
      body.stroke({ width: 1 + 3 * node.h, color: COLORS.heat, alpha: 0.25 + 0.6 * node.h });
    }
    if (node.lockedFor > 0) {
      body.circle(x, y, radius + 7);
      body.stroke({ width: 1, color: COLORS.heat, alpha: 0.8 });
    }
    if (!node.enabled) {
      body.circle(x, y, radius);
      body.stroke({ width: 2, color: COLORS.outline, alpha: 0.35 });
    }

    // Lieferung: ein Ring, der nach aussen laeuft und verblasst.
    const pulse = this.pulses.get(node.id);
    if (pulse !== undefined) {
      const grow = 1 - pulse / 0.45;
      body.circle(x, y, radius + 4 + 14 * grow);
      body.stroke({ width: 2, color: COLORS.outline, alpha: 0.7 * (1 - grow) });
    }

    // Beschriftung erst ab genug Platz, sonst wird es Matsch.
    const showLabel = radius > 22;
    label.visible = showLabel;
    if (showLabel) {
      label.text = node.lockedFor > 0
        ? `gesperrt ${Math.ceil(node.lockedFor)}s`
        : `${Math.round(node.p * 100)}%`;
      label.position.set(x, y);
      label.style.fontSize = Math.min(15, Math.max(10, radius * 0.34));
    }
    void nodePrice;
  }

  resize(): void {
    this.app.renderer.resize(this.app.canvas.clientWidth, this.app.canvas.clientHeight);
  }
}
