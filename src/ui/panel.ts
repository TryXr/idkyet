/**
 * Das Bedienfeld. Baut das Geruest EINMAL auf und schreibt danach nur noch
 * Texte und Zustaende hinein.
 *
 * Knoepfe bei jeder Aenderung neu zu erzeugen flackert und verschluckt Klicks,
 * weil der Knopf unter dem Finger verschwindet. Bei einem Spiel, in dem sich
 * viermal je Sekunde eine Zahl aendert, ist das der Unterschied zwischen
 * bedienbar und nicht.
 *
 * Alle Abschnitte haben dieselbe Form, deshalb reicht ein Renderer fuer
 * Kochen, Raeume, Verkaufen und Lager.
 */
import type { BuyOption, Meter, Row, Section, UiAction, ViewModel } from './model.js';

type Handler = (action: UiAction) => void;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

interface MeterEls { root: HTMLElement; label: HTMLElement; value: HTMLElement; bar: HTMLElement }

interface RowEls {
  root: HTMLElement;
  name: HTMLElement;
  count: HTMLElement;
  facts: HTMLElement;
  note: HTMLElement;
  wait: HTMLElement;
  buttons: HTMLButtonElement[];
}

interface SectionEls { root: HTMLElement; body: HTMLElement; rows: Map<string, RowEls> }

export class Panel {
  private actions = new Map<HTMLButtonElement, UiAction>();
  private meters: MeterEls[] = [];
  private sections = new Map<string, SectionEls>();

  private levelName = el('h1');
  private levelIndex = el('div', 'level');
  private cash = el('div', 'cash');
  private rate = el('div', 'rate');
  private handsBox = el('div', 'hands');
  private handsHint = el('p', 'hint');
  private cookButton = el('button', 'hand');
  private sellButton = el('button', 'hand');
  private warnings = el('div', 'warnings');
  private meterBox = el('div', 'meters');
  private seedBox = el('section', 'card seed');
  private seedLabel = el('div', 'seed-label');
  private seedInput = el('input', 'seed-range');
  private seedFacts = el('div', 'row-facts');
  private strainBox = el('section', 'card strains');
  private strainCount = el('div', 'row-note');
  private strainLines = el('div', 'strain-lines');
  private targetBox = el('section', 'card target');
  private targetName = el('div', 'target-name');
  private targetBar = el('div', 'bar-fill');
  private targetFacts = el('div', 'row-facts');
  private targetStrain = el('div', 'row-note');
  private targetEta = el('div', 'wait');
  private sectionBox = el('div', 'sections');
  private facts = el('dl', 'facts');

  constructor(private root: HTMLElement, private onAction: Handler) {
    this.build();
  }

  private button(target: HTMLButtonElement): HTMLButtonElement {
    target.addEventListener('click', () => {
      const action = this.actions.get(target);
      if (action) this.onAction(action);
    });
    return target;
  }

  private build(): void {
    const head = el('header');
    head.append(this.levelName, this.levelIndex);
    const money = el('div', 'money');
    money.append(this.cash, this.rate);
    head.appendChild(money);

    const handButtons = el('div', 'hand-buttons');
    handButtons.append(this.button(this.cookButton), this.button(this.sellButton));
    this.handsBox.append(handButtons, this.handsHint);

    // Der Regler. Kein Kaufknopf, also auch keine erzwungene Kaufzeile - er
    // bekommt seine eigene Form, damit er nicht wie eine Anschaffung aussieht.
    this.seedInput.type = 'range';
    this.seedInput.min = '0';
    this.seedInput.max = '100';
    this.seedInput.step = '5';
    this.seedInput.addEventListener('input', () => {
      this.onAction({ kind: 'seed', share: Number(this.seedInput.value) / 100 });
    });
    this.seedBox.append(this.seedLabel, this.seedInput, this.seedFacts);

    // Das Beet. Kein Kaufabschnitt - hier steht nur, was die Uebernahmen
    // hinterlassen haben. Es taucht erst auf, wenn es das erste gibt.
    this.strainBox.append(el('h2', '', 'Sorten'), this.strainCount, this.strainLines);

    this.targetBox.appendChild(el('h2', '', 'Ziel'));
    const bar = el('div', 'bar');
    bar.appendChild(this.targetBar);
    this.targetBox.append(
      this.targetName, bar, this.targetFacts, this.targetStrain, this.targetEta);

    this.root.append(head, this.handsBox, this.warnings, this.meterBox,
      this.seedBox, this.targetBox, this.strainBox, this.sectionBox, this.facts);

    for (let i = 0; i < 4; i++) {  // Ebene, Pflanzen, Lager, Durchsatz
      const root = el('div', 'meter');
      const line = el('div', 'meter-head');
      const label = el('span', 'meter-label');
      const value = el('span', 'meter-value');
      line.append(label, value);
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      track.appendChild(fill);
      root.append(line, track);
      this.meterBox.appendChild(root);
      this.meters.push({ root, label, value, bar: fill });
    }
  }

  update(vm: ViewModel): void {
    this.levelName.textContent = vm.levelName;
    this.levelIndex.textContent = vm.levelIndexText;
    this.cash.textContent = vm.cashText;
    this.rate.textContent = vm.rateText;

    this.setHands(vm);
    this.setWarnings(vm.warnings);
    vm.meters.forEach((meter, i) => this.setMeter(this.meters[i], meter));
    this.setSeed(vm);
    this.setTarget(vm);
    this.setStrains(vm);
    for (const section of vm.sections) this.setSection(section);
    this.setFacts(vm);
  }

  private setHands(vm: ViewModel): void {
    this.handsBox.hidden = !vm.hands.visible;
    if (!vm.hands.visible) return;
    this.handsHint.textContent = vm.hands.hint;
    this.setButtons([this.cookButton], [vm.hands.cook]);
    this.setButtons([this.sellButton], [vm.hands.sell]);
  }

  private setWarnings(warnings: string[]): void {
    const text = warnings.join('\n');
    if (this.warnings.dataset.text === text) return;
    this.warnings.dataset.text = text;
    this.warnings.replaceChildren(...warnings.map(w => el('div', 'warn', w)));
  }

  private setMeter(els: MeterEls | undefined, meter: Meter): void {
    if (!els) return;
    els.root.title = meter.hint;
    els.label.textContent = meter.label;
    els.value.textContent = meter.value;
    els.bar.style.width = `${Math.round(Math.min(1, meter.fill) * 100)}%`;
    els.root.classList.toggle('warn', meter.warn);
  }

  private setSeed(vm: ViewModel): void {
    const percent = Math.round(vm.seed.share * 100);
    this.seedBox.title = vm.seed.hint;
    this.seedLabel.textContent =
      `${vm.seed.title}: ${percent} % ${vm.seed.backLabel}, ${100 - percent} % ${vm.seed.sellLabel}`;
    // Nur schreiben, wenn der Wert wirklich abweicht - sonst springt der
    // Schieber unter dem Finger zurueck, waehrend man ihn noch zieht.
    if (Number(this.seedInput.value) !== percent) this.seedInput.value = String(percent);
    this.seedFacts.textContent = vm.seed.facts;
  }

  private setTarget(vm: ViewModel): void {
    if (!vm.target) { this.targetBox.hidden = true; return; }
    this.targetBox.hidden = false;
    this.targetName.textContent = `${vm.target.name} · ${vm.target.fractionText}`;
    this.targetBar.style.width = `${Math.round(vm.target.fraction * 100)}%`;
    this.targetFacts.textContent =
      `${vm.target.missingText} · ${vm.target.priceText} · ${vm.target.rentText}`;
    this.targetStrain.textContent = vm.target.strainText;
    this.targetEta.textContent = vm.target.etaText;
  }

  private setStrains(vm: ViewModel): void {
    const view = vm.strains;
    this.strainBox.hidden = view === null;
    if (!view) return;
    this.strainBox.title = view.hint;
    this.strainCount.textContent = view.countText;
    // Nur neu bauen, wenn sich wirklich etwas geaendert hat - fuenf Zeilen
    // viermal je Sekunde neu zu erzeugen kostet mehr als der Vergleich.
    const text = view.lines.join(' · ');
    if (this.strainLines.dataset.text === text) return;
    this.strainLines.dataset.text = text;
    this.strainLines.replaceChildren(
      ...view.lines.map(line => el('span', 'strain', line)));
  }

  // --- Abschnitte ---------------------------------------------------------

  private setSection(section: Section): void {
    let els = this.sections.get(section.key);
    if (!els) {
      const root = el('section', 'card');
      root.appendChild(el('h2', '', section.title));
      root.appendChild(el('p', 'hint', section.hint));
      const body = el('div', 'rows');
      root.appendChild(body);
      this.sectionBox.appendChild(root);
      els = { root, body, rows: new Map() };
      this.sections.set(section.key, els);
    }

    const wanted = section.rows.map(r => r.key);
    for (const [key, rowEls] of els.rows) {
      if (!wanted.includes(key)) { rowEls.root.remove(); els.rows.delete(key); }
    }
    section.rows.forEach((row, index) => {
      const rowEls = els!.rows.get(row.key) ?? this.createRow(els!, row.key);
      this.fillRow(rowEls, row);
      // Reihenfolge nur anfassen, wenn sie nicht stimmt - jedes Verschieben
      // bricht einen laufenden Klick ab.
      if (els!.body.children[index] !== rowEls.root) {
        els!.body.insertBefore(rowEls.root, els!.body.children[index] ?? null);
      }
    });
  }

  private createRow(section: SectionEls, key: string): RowEls {
    const root = el('div', 'row');
    const head = el('div', 'row-head');
    const name = el('span', 'name');
    const count = el('span', 'owned');
    head.append(name, count);
    const facts = el('div', 'row-facts');
    const note = el('div', 'row-note');
    const wait = el('div', 'wait');
    const buttons = el('div', 'buttons');
    const list: HTMLButtonElement[] = [];
    for (let i = 0; i < 3; i++) {
      const button = this.button(el('button', 'buy small'));
      buttons.appendChild(button);
      list.push(button);
    }
    root.append(head, facts, note, wait, buttons);
    section.body.appendChild(root);
    const els: RowEls = { root, name, count, facts, note, wait, buttons: list };
    section.rows.set(key, els);
    return els;
  }

  private fillRow(els: RowEls, row: Row): void {
    els.name.textContent = row.name;
    els.count.textContent = row.count;
    els.facts.textContent = row.facts;
    els.note.textContent = row.note ?? '';
    els.note.hidden = !row.note;
    els.wait.textContent = row.waitText;
    els.root.classList.toggle('best', row.highlight);
    this.setButtons(els.buttons, row.buys);
  }

  private setButtons(buttons: HTMLButtonElement[], options: BuyOption[]): void {
    buttons.forEach((button, i) => {
      const option = options[i];
      if (!option) {
        // Text mitloeschen: sonst traegt ein ausgeblendeter Knopf noch die alte
        // Beschriftung, und Vorlesehilfen finden Preise, die es nicht gibt.
        button.hidden = true;
        button.textContent = '';
        this.actions.delete(button);
        return;
      }
      button.hidden = false;
      button.disabled = !option.enabled;
      button.textContent = `${option.label} ${option.costText}`;
      this.actions.set(button, option.action);
    });
  }

  private setFacts(vm: ViewModel): void {
    const signature = vm.facts.map(([k, v]) => `${k}${v}`).join('|');
    if (this.facts.dataset.signature === signature) return;
    this.facts.dataset.signature = signature;
    this.facts.replaceChildren(...vm.facts.flatMap(([key, value]) => [
      el('dt', '', key), el('dd', '', value),
    ]));
  }
}
