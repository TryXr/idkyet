/**
 * Das Bedienfeld. Baut das Geruest EINMAL auf und schreibt danach nur noch
 * Texte und Zustaende hinein.
 *
 * Der Vorgaenger hat die Knoepfe bei jeder Aenderung neu erzeugt - das flackert
 * und verschluckt Klicks, weil der Knopf unter dem Finger verschwindet. Bei
 * einem Spiel, in dem sich viermal je Sekunde eine Zahl aendert, ist das keine
 * Kleinigkeit, sondern der Unterschied zwischen bedienbar und nicht.
 */
import type { BuyOption, Meter, SiteRow, UiAction, ViewModel } from './model.js';
import { BLOCKED, HINTS } from '../content/texts.js';

type Handler = (action: UiAction) => void;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function section(title: string, hint: string): { root: HTMLElement; body: HTMLElement } {
  const root = el('section', 'card');
  root.appendChild(el('h2', '', title));
  if (hint) root.appendChild(el('p', 'hint', hint));
  const body = el('div', 'body');
  root.appendChild(body);
  return { root, body };
}

interface MeterEls { root: HTMLElement; value: HTMLElement; bar: HTMLElement }

interface SiteEls {
  root: HTMLElement;
  head: HTMLElement;
  owned: HTMLElement;
  facts: HTMLElement;
  wait: HTMLElement;
  buttons: HTMLButtonElement[];
}

export class Panel {
  private actions = new Map<HTMLButtonElement, UiAction>();
  private meters: MeterEls[] = [];
  private siteRows = new Map<number, SiteEls>();
  private showAllSites = false;

  private levelName = el('h1');
  private levelIndex = el('div', 'level');
  private cash = el('div', 'cash');
  private rate = el('div', 'rate');
  private warnings = el('div', 'warnings');
  private meterBox = el('div', 'meters');
  private siteList = el('div', 'rows');
  private siteToggle = el('button', 'link');
  private landInfo = el('div', 'line');
  private landBar = el('div', 'bar-fill');
  private landWait = el('div', 'wait');
  private landButtons = el('div', 'buttons');
  private storageInfo = el('div', 'line');
  private storageWait = el('div', 'wait');
  private storageButton = el('button', 'buy');
  private pilotCurrent = el('div', 'line');
  private pilotSteps = el('div', 'steps');
  private pilotWait = el('div', 'wait');
  private pilotButton = el('button', 'buy');
  private levelInfo = el('div', 'line');
  private levelBar = el('div', 'bar-fill');
  private levelWait = el('div', 'wait');
  private levelButton = el('button', 'buy');
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
    this.root.append(head, this.warnings, this.meterBox);

    for (let i = 0; i < 3; i++) {
      const root = el('div', 'meter');
      const label = el('div', 'meter-head');
      const value = el('span', 'meter-value');
      label.append(el('span', 'meter-label'), value);
      const bar = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      bar.appendChild(fill);
      root.append(label, bar);
      this.meterBox.appendChild(root);
      this.meters.push({ root, value, bar: fill });
    }

    const sites = section('Herstellorte', HINTS.sites);
    this.siteToggle.addEventListener('click', () => {
      this.showAllSites = !this.showAllSites;
    });
    sites.body.append(this.siteList, this.siteToggle);

    const land = section('Land', HINTS.land);
    const landBarBox = el('div', 'bar');
    landBarBox.appendChild(this.landBar);
    land.body.append(this.landInfo, landBarBox, this.landWait, this.landButtons);

    const storage = section('Lager', HINTS.storage);
    storage.body.append(this.storageInfo, this.storageWait, this.button(this.storageButton));

    const pilot = section('Statthalter', HINTS.pilot);
    pilot.body.append(
      this.pilotCurrent, this.pilotSteps, this.pilotWait, this.button(this.pilotButton),
    );

    const reach = section('Reichweite', HINTS.levelUp);
    const levelBarBox = el('div', 'bar');
    levelBarBox.appendChild(this.levelBar);
    reach.body.append(this.levelInfo, levelBarBox, this.levelWait, this.button(this.levelButton));

    this.root.append(sites.root, land.root, storage.root, pilot.root, reach.root, this.facts);
  }

  update(vm: ViewModel): void {
    this.levelName.textContent = vm.levelName;
    this.levelIndex.textContent = vm.levelIndexText;
    this.cash.textContent = vm.cashText;
    this.rate.textContent = vm.rateText;

    this.setWarnings(vm.warnings);
    vm.meters.forEach((meter, i) => this.setMeter(this.meters[i], meter));

    this.setSites(vm);
    this.setLand(vm);
    this.setStorage(vm);
    this.setPilot(vm);
    this.setReach(vm);
    this.setFacts(vm);
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
    const label = els.root.querySelector('.meter-label');
    if (label) label.textContent = meter.label;
    els.value.textContent = meter.value;
    els.bar.style.width = `${Math.round(meter.fill * 100)}%`;
    els.root.classList.toggle('warn', meter.warn);
  }

  // --- Herstellorte -------------------------------------------------------

  private setSites(vm: ViewModel): void {
    const rows = vm.sites.filter(row => this.showAllSites || row.visible);
    const wanted = rows.map(row => row.tier);

    for (const [tier, els] of this.siteRows) {
      if (!wanted.includes(tier)) { els.root.remove(); this.siteRows.delete(tier); }
    }
    rows.forEach((row, index) => {
      const els = this.siteRows.get(row.tier) ?? this.createSiteRow(row.tier);
      this.fillSiteRow(els, row);
      // Reihenfolge nur anfassen, wenn sie nicht stimmt - jedes Verschieben
      // bricht einen laufenden Klick ab.
      if (this.siteList.children[index] !== els.root) {
        this.siteList.insertBefore(els.root, this.siteList.children[index] ?? null);
      }
    });

    this.siteToggle.textContent = this.showAllSites
      ? 'weniger zeigen'
      : vm.hiddenSites > 0 ? `${vm.hiddenSites} weitere zeigen` : '';
    this.siteToggle.hidden = !this.showAllSites && vm.hiddenSites === 0;
  }

  private createSiteRow(tier: number): SiteEls {
    const root = el('div', 'row');
    const head = el('div', 'row-head');
    const name = el('span', 'name');
    const owned = el('span', 'owned');
    head.append(name, owned);
    const facts = el('div', 'row-facts');
    const wait = el('div', 'wait');
    const buttons = el('div', 'buttons');
    const list: HTMLButtonElement[] = [];
    for (let i = 0; i < 3; i++) {
      const button = this.button(el('button', 'buy small'));
      buttons.appendChild(button);
      list.push(button);
    }
    root.append(head, facts, wait, buttons);
    this.siteList.appendChild(root);
    const els: SiteEls = { root, head: name, owned, facts, wait, buttons: list };
    this.siteRows.set(tier, els);
    return els;
  }

  private fillSiteRow(els: SiteEls, row: SiteRow): void {
    els.head.textContent = row.name;
    els.owned.textContent = row.owned > 0 ? `${row.owned}×` : '';
    els.root.classList.toggle('best', row.best);
    const parts = [row.gainText, row.areaText];
    if (row.milestoneText) parts.push(row.milestoneText);
    if (row.owned > 0) parts.push(row.shareText);
    els.facts.textContent = parts.join(' · ');
    // Fehlendes Geld braucht keine Meldung - dafuer steht die Wartezeit da.
    els.wait.textContent = row.blocked && row.blocked !== BLOCKED.cash ? row.blocked : row.waitText;
    this.setButtons(els.buttons, row.buys);
  }

  private setButtons(buttons: HTMLButtonElement[], options: BuyOption[]): void {
    buttons.forEach((button, i) => {
      const option = options[i];
      if (!option) {
        // Text mitloeschen: sonst traegt ein ausgeblendeter Knopf noch die alte
        // Beschriftung, und Vorlesehilfen wie Testwerkzeuge finden Preise, die
        // es nicht mehr gibt.
        button.hidden = true;
        button.textContent = '';
        this.actions.delete(button);
        return;
      }
      button.hidden = false;
      button.disabled = !option.enabled;
      button.textContent = `${option.label} ${option.costText}`;
      button.title = option.parcels > 0
        ? `inklusive ${option.parcels} ${option.parcels === 1 ? 'Parzelle' : 'Parzellen'} Land`
        : '';
      this.actions.set(button, option.action);
    });
  }

  // --- Land, Lager, Statthalter, Reichweite -------------------------------

  private setLand(vm: ViewModel): void {
    this.landInfo.textContent = `${vm.land.ownedText} · ${vm.land.freeAreaText} frei`;
    this.landBar.style.width = `${Math.round(vm.land.fraction * 100)}%`;
    this.landWait.textContent = vm.land.soldOut ? 'alles gekauft' : vm.land.waitText;
    const need = vm.land.buys.length;
    while (this.landButtons.children.length < need) {
      this.landButtons.appendChild(this.button(el('button', 'buy small')));
    }
    this.setButtons([...this.landButtons.children] as HTMLButtonElement[], vm.land.buys);
  }

  private setStorage(vm: ViewModel): void {
    this.storageInfo.textContent = `${vm.storage.fillText} · ${vm.storage.bufferText}`;
    this.storageInfo.classList.toggle('warn-text', vm.storage.stalled);
    this.storageWait.textContent = vm.storage.waitText;
    this.setButtons([this.storageButton], [vm.storage.buy]);
  }

  private setPilot(vm: ViewModel): void {
    this.pilotCurrent.textContent = vm.pilot.currentText;
    this.pilotCurrent.classList.toggle('warn-text', vm.pilot.manualWarning);
    const signature = vm.pilot.steps.map(s => `${s.name}${s.owned}`).join('|');
    if (this.pilotSteps.dataset.signature !== signature) {
      this.pilotSteps.dataset.signature = signature;
      this.pilotSteps.replaceChildren(...vm.pilot.steps.map(step => {
        const row = el('div', step.owned ? 'step done' : 'step');
        row.append(
          el('span', 'step-mark', step.owned ? '✓' : '·'),
          el('span', 'step-name', step.name),
          el('span', 'step-desc', step.description),
        );
        return row;
      }));
    }
    this.pilotWait.textContent = vm.pilot.waitText;
    if (vm.pilot.next) {
      this.pilotButton.hidden = false;
      this.setButtons([this.pilotButton], [vm.pilot.next]);
    } else {
      this.pilotButton.hidden = true;
    }
  }

  private setReach(vm: ViewModel): void {
    this.levelInfo.textContent = vm.levelUp.saturationText;
    this.levelBar.style.width = `${Math.round(vm.levelUp.saturation * 100)}%`;
    this.levelWait.textContent = vm.levelUp.waitText;
    if (vm.levelUp.buy) {
      this.levelButton.hidden = false;
      this.setButtons([this.levelButton], [vm.levelUp.buy]);
      this.levelButton.textContent = `${vm.levelUp.label} ${vm.levelUp.buy.costText}`;
    } else {
      this.levelButton.hidden = true;
      this.levelInfo.textContent = vm.levelUp.label;
    }
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
