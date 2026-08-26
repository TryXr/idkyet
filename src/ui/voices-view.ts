/**
 * Einblendung der Stimmen ueber der Karte.
 *
 * Zwei Regeln, mehr braucht es nicht: hoechstens zwei Zeilen gleichzeitig, und
 * zwischen zwei Einblendungen liegt eine kurze Pause. Drei Stimmen, die
 * gleichzeitig anfangen, sind kein Streit mehr, sondern eine Wand aus Text - und
 * auf einem kurzen Kartenausschnitt haengt der Stapel sonst im Kartenhinweis.
 *
 * Die Zeit hier ist ECHTE Zeit, nicht Spielzeit: der Tempo-Regler (und der
 * Offline-Nachlauf) darf die Stimmen nicht im Zeitraffer durchhetzen.
 */
import type { VoiceDirector, VoiceLine } from '../content/voices.js';

const MAX_VISIBLE = 2;
const GAP_SECONDS = 1.2;
const READ_SECONDS = 3.5;
const PER_CHARACTER = 0.045;

interface Shown { node: HTMLElement; left: number }

export class VoicesView {
  private shown: Shown[] = [];
  private cooldown = 0;

  constructor(private host: HTMLElement) {}

  /** Jeden Frame aufrufen. `realDt` in echten Sekunden. */
  update(director: VoiceDirector, realDt: number): void {
    this.cooldown = Math.max(0, this.cooldown - realDt);

    for (const item of this.shown) item.left -= realDt;
    for (const item of this.shown) {
      if (item.left <= 0.4) item.node.classList.add('leaving');
    }
    const expired = this.shown.filter(item => item.left <= 0);
    for (const item of expired) item.node.remove();
    this.shown = this.shown.filter(item => item.left > 0);

    if (this.cooldown > 0 || this.shown.length >= MAX_VISIBLE) return;
    const line = director.take();
    if (line) this.show(line);
  }

  private show(line: VoiceLine): void {
    const node = document.createElement('div');
    node.className = 'voice';
    const who = document.createElement('span');
    who.className = 'voice-who';
    who.textContent = line.speaker;
    const what = document.createElement('span');
    what.className = 'voice-text';
    what.textContent = line.text;
    node.append(who, what);
    this.host.appendChild(node);
    // Ein Frame Verzoegerung, sonst gibt es keinen Uebergang zum Einblenden.
    requestAnimationFrame(() => node.classList.add('in'));

    this.shown.push({ node, left: READ_SECONDS + line.text.length * PER_CHARACTER });
    this.cooldown = GAP_SECONDS;
  }
}
