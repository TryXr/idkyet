/**
 * ALLE Balancing-Konstanten an genau einer Stelle.
 * Begruendung und Herleitung jeder Zahl steht in BALANCING.md.
 *
 * Die zwei kritischen Verhaeltnisse (siehe PLAN.md, Risiken):
 *   outputTierMult / costTierMult  = 13.5 / 12   -> haelt die Kurve flach
 *   capMult        / outputTierMult = 12 / 13.5  -> verhindert Waende
 * Wer hier dreht, muss den Regressionslauf (npm run sim) mitlaufen lassen.
 */
export const BALANCE = {
  /** Marktdynamik. gamma > 1 ist der Kern des ganzen Spiels. */
  market: {
    kP: 0.030,       // Preisverfall pro Auslastung
    rP: 0.0080,      // Preiserholung (~2 min)
    gamma: 1.7,      // UEBERLINEAR: Fluten schadet, statt nur zu saettigen
    kH: 0.0056,      // Hitzeaufbau
    rH: 0.0125,      // Abkuehlung (~80 s Zeitkonstante)
    lockSeconds: 120,
    /** Physische Aufnahmegrenze eines Marktes, als Vielfaches der Nachfrage.
     *  Ohne diese Grenze koennte man beliebig viel Ware in einer Sekunde
     *  absetzen und Fluten waere folgenlos. */
    maxIntakeMultiple: 3,
  },

  /** Streuung der Knoten. Ohne starke Streuung ist Gleichverteilung optimal
   *  und aktives Spiel wertlos. */
  spread: {
    demandSigma: 1.5,
    priceSigma: 1.0,
    nodesPerLevel: 15,
  },

  /** Langsame Schwankung der Basispreise (mean-reverting um 1.0). */
  volatility: { pull: 0.0100, sigma: 0.090, min: 0.25, max: 3.0 },

  /** Herstellorte. */
  production: {
    costBase: 10,
    costTierMult: 12,
    costGrowth: 1.115,     // je bereits besessener Einheit derselben Art
    outputBase: 0.10,
    outputTierMult: 13.0,
    milestones: [25, 50, 100, 200],
    milestoneMult: 2,
  },

  /** Land: endlich, Preis steigt mit der Knappheit. */
  land: {
    priceBase: 5,
    parcelArea: 100,       // m2 je Parzelle
    scarcityExp: 1.5,
    pool0: 12,             // Parzellen auf Stufe 0
    poolMult: 14,
  },

  /** Zoomstufen. */
  levels: {
    cap0: 0.6,             // profitabel verkaufbare Ware/s auf Stufe 0
    capMult: 12,
    upgradeSeconds: 1100,  // Aufstiegskosten = ~18 min Umsatz der Stufe
  },

  /** Effektiver Erloes je Ware bei optimaler Auslastung u*.
   *  Die Basispreise der Knoten werden so skaliert, dass das aufgeht. */
  effectivePricePerWare: 12,

  /** Lager: laeuft es ueber, stockt die Produktion (kein Verlust). */
  /** Lager als Sekunden Produktionspuffer - dadurch skalenfrei. Laeuft es
   *  ueber, stockt die Produktion (kein Verlust, nur Stillstand). */
  storage: { bufferSeconds: 60, bufferPerLevel: 1.5, costBase: 200, costGrowth: 1.6 },

  /** Statthalter-Stufen. Stufe 0 ist Handverkauf: am besten, aber man muss
   *  dabei sein. S0 ist SCHLECHTER als Handverkauf - und trotzdem der
   *  wichtigste Kauf im Spiel, weil er das Klicken beendet. */
  pilots: [
    { key: "s0", name: "Statthalter anstellen", cost: 400 },
    { key: "s1", name: "Sperren meiden", cost: 15_000 },
    { key: "s2", name: "Disziplin: Obergrenze & Preis-Vorrang", cost: 900_000 },
    { key: "s3", name: "Marktbeobachtung", cost: 60_000_000 },
  ],

  offlineCapSeconds: 8 * 3600,
  tickSeconds: 1,
};

/** Namen und Flaechenbedarf der 15 Herstellorte. Flaeche 0 = braucht kein Land
 *  (Frachtschiff, Orbitalstation) - das Ventil, wenn die Erde voll ist. */
export const SITES: ReadonlyArray<{ name: string; area: number }> = [
  { name: 'Badezimmer',        area: 2 },
  { name: 'Garage',            area: 8 },
  { name: 'Wohnwagen',         area: 15 },
  { name: 'Kellergeschoss',    area: 40 },
  { name: 'Lagerhalle',        area: 250 },
  { name: 'Gewerbepark',       area: 900 },
  { name: 'Stillgelegte Fabrik', area: 4_500 },
  { name: 'Farm / Gewächshaus', area: 30_000 },
  { name: 'Frachtschiff',      area: 0 },
  { name: 'Bergwerk',          area: 2_000 },
  { name: 'Pharmawerk',        area: 60_000 },
  { name: 'Raffinerie',        area: 400_000 },
  { name: 'Orbitalstation',    area: 0 },
  { name: 'Mondbasis',         area: 1_000_000 },
  { name: 'Asteroiden-Cluster', area: 100_000_000 },
];

export const LEVELS: ReadonlyArray<string> = [
  'Straßenecke', 'Block', 'Stadt', 'Ballungsraum', 'Region', 'Land',
  'Nachbarländer', 'Kontinent', 'Hemisphäre', 'Welt', 'Orbit', 'Mond & Mars',
  'Äußeres System', 'Interstellar',
];
