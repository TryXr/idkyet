/**
 * Grosse Zahlen. Laut CLAUDE.md ab Tag 1 - nicht nachruesten.
 *
 * Aufteilung mit Absicht:
 *   Decimal  fuer die Wirtschaft (Bargeld, Kosten, Ausstoss, Umsatz) - waechst
 *            unbegrenzt und wuerde Number irgendwann sprengen.
 *   number   fuer Marktzustaende (Preisfaktor, Hitze, Auslastung) - alle in
 *            0..1 bzw. klein beschraenkt, Decimal waere dort nur langsamer.
 */
import Decimal from 'break_infinity.js';

export type Num = Decimal;
export const D = (v: number | string | Decimal): Num => new Decimal(v);
export const ZERO: Num = new Decimal(0);

/** Kompakte Ausgabe fuer Konsole und UI. */
export function fmt(v: Num | number, digits = 2): string {
  const d = typeof v === 'number' ? new Decimal(v) : v;
  // Kleine Betraege duerfen nicht zu "0.00" werden: eine Rente von 0.0006 je
  // Sekunde ist wenig, aber sie ist da, und der Spieler soll sie sehen.
  if (d.gt(0) && d.lt(0.01)) return d.toFixed(4);
  if (d.lt(1000)) return d.toFixed(d.lt(10) ? digits : 0);
  const e = Math.floor(d.log10());
  const suffixes = ['', 'k', 'M', 'Mrd', 'Bio', 'Brd', 'Trio'];
  const group = Math.floor(e / 3);
  if (group < suffixes.length) {
    const mant = d.div(Decimal.pow(10, group * 3));
    return `${mant.toFixed(digits)} ${suffixes[group]}`.trim();
  }
  return `${d.div(Decimal.pow(10, e)).toFixed(digits)}e${e}`;
}

/** Sekunden als lesbare Dauer. */
export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} s`;
  const h = Math.floor(seconds / 3600);
  return `${h} h ${Math.floor((seconds % 3600) / 60)} min`;
}
