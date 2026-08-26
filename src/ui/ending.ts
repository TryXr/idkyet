/**
 * Die Schlussbilanz.
 *
 * Bewusst kein Abspann und keine Punktzahl: das Spiel rechnet vor, was gebaut
 * wurde, und hoert auf (CLAUDE.md). Die Pointe gehoert den Stimmen, die zur
 * selben Zeit ueber der Karte laufen - deshalb laesst sich die Bilanz auch
 * schliessen, statt den Bildschirm zu besetzen.
 */
import { ENDING } from '../content/texts.js';
import type { Ending } from './model.js';

export class EndingView {
  private shown = false;
  private dismissed = false;

  constructor(private host: HTMLElement) {}

  update(ending: Ending | null): void {
    if (!ending || this.shown || this.dismissed) return;
    this.shown = true;
    this.render(ending);
  }

  private render(ending: Ending): void {
    const box = document.createElement('div');
    box.className = 'ending-box';

    const title = document.createElement('h2');
    title.textContent = ending.title;
    const lead = document.createElement('p');
    lead.className = 'ending-lead';
    lead.textContent = ending.lead;

    const list = document.createElement('dl');
    list.className = 'ending-tally';
    for (const [key, value] of ending.tally) {
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      list.append(dt, dd);
    }

    const closing = document.createElement('p');
    closing.className = 'ending-closing';
    closing.textContent = ending.closing;

    const close = document.createElement('button');
    close.textContent = ENDING.close;
    close.addEventListener('click', () => {
      this.dismissed = true;
      this.host.replaceChildren();
      this.host.hidden = true;
    });

    box.append(title, lead, list, closing, close);
    this.host.replaceChildren(box);
    this.host.hidden = false;
  }
}
