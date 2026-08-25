/** Deterministischer RNG. Die Simulation muss reproduzierbar sein, sonst ist
 *  der Regressionslauf gegen BALANCING.md wertlos. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  /** Zustand sichern und wiederherstellen - sonst setzt Laden die
   *  Marktschwankungen zurueck und der Lauf ist nicht mehr reproduzierbar. */
  getState(): number { return this.s; }
  setState(state: number): void { this.s = state >>> 0 || 1; }
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  /** Gleichverteilt in [-1, 1). */
  signed(): number { return this.next() * 2 - 1; }
  /** Log-normal um 1.0 mit gegebener Streuung. */
  logNormal(sigma: number): number { return Math.exp(this.signed() * sigma * 0.5); }
}
