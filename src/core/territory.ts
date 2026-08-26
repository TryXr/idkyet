/**
 * Gebiete: Bedarf, Preis, Rente.
 *
 * Das Herzstueck des Spiels und der Ersatz fuer das alte Marktmodell. Kein
 * Preisverfall, keine Hitze, keine Sperren - stattdessen ein Balken, der sich
 * fuellt. Ist er voll, gehoert das Gebiet dir FUER IMMER und zahlt ab da seine
 * Rente. Kein Rueckfall, keine Vernachlaessigung (CLAUDE.md).
 *
 * Genau daraus entsteht die Zielwahl von selbst: ein grosses Gebiet zahlt mehr,
 * braucht aber lange; ein kleines ist schnell deins.
 */

export interface Territory {
  readonly id: number;
  readonly name: string;
  /** Ware, die bis 100 % noetig ist. */
  readonly demand: number;
  /** Bargeld je Ware. */
  readonly price: number;
  /** Bargeld je Sekunde, sobald uebernommen. */
  readonly rent: number;
  /** Bereits geliefert. */
  supplied: number;
  owned: boolean;
}

export function createTerritory(
  id: number, name: string, demand: number, price: number, rent: number,
): Territory {
  return { id, name, demand, price, rent, supplied: 0, owned: false };
}

/** Versorgungsgrad 0..1. */
export const fraction = (t: Territory): number =>
  t.demand > 0 ? Math.min(1, t.supplied / t.demand) : 1;

/** Was bis zur Uebernahme noch fehlt. */
export const missing = (t: Territory): number => Math.max(0, t.demand - t.supplied);

/**
 * Ware abliefern. Gibt zurueck, wie viel wirklich abgenommen wurde, was es
 * einbrachte, und ob das Gebiet damit uebernommen ist.
 *
 * Mehr als der Bedarf wird NICHT abgenommen: der Rest bleibt im Lager und geht
 * ins naechste Gebiet. Sonst waere die letzte Lieferung an ein grosses Gebiet
 * teilweise verschenkt, und der Spieler wuerde dafuer bestraft, dass er gut
 * produziert hat.
 */
export function deliver(t: Territory, amount: number): {
  sold: number; revenue: number; taken: boolean;
} {
  if (t.owned || amount <= 0) return { sold: 0, revenue: 0, taken: false };
  const sold = Math.min(amount, missing(t));
  t.supplied += sold;
  const taken = t.supplied >= t.demand - 1e-9;
  if (taken) {
    t.supplied = t.demand;
    t.owned = true;
  }
  return { sold, revenue: sold * t.price, taken };
}

/** Summe der Renten aller uebernommenen Gebiete einer Ebene. */
export function rentOf(territories: readonly Territory[]): number {
  let sum = 0;
  for (const t of territories) if (t.owned) sum += t.rent;
  return sum;
}

/** Alle uebernommen? Dann zoomt die Karte heraus. */
export const allOwned = (territories: readonly Territory[]): boolean =>
  territories.every(t => t.owned);

/**
 * Das lohnendste offene Gebiet: viel Rente je Ware, die man hineinstecken muss.
 * Das ist die Wahl, die ein aufmerksamer Spieler trifft - und die Messlatte,
 * gegen die der stumpfe Autopilot (einfach das erste offene) antritt.
 */
export function bestTarget(territories: readonly Territory[]): Territory | null {
  let best: Territory | null = null;
  let bestValue = -Infinity;
  for (const t of territories) {
    if (t.owned) continue;
    const rest = missing(t);
    if (rest <= 0) continue;
    const value = (t.rent + t.price * rest / 60) / rest;
    if (value > bestValue) { bestValue = value; best = t; }
  }
  return best;
}

/** Das erste offene Gebiet - stur der Reihe nach. */
export function firstOpen(territories: readonly Territory[]): Territory | null {
  return territories.find(t => !t.owned) ?? null;
}
