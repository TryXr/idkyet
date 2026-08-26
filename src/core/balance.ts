/**
 * ALLE Balancing-Konstanten an genau einer Stelle.
 * Begruendung und Herleitung jeder Zahl steht in BALANCING.md.
 *
 * Die zwei kritischen Verhaeltnisse (siehe PLAN.md, Risiken):
 *   outputTierMult / costTierMult  = 13.0 / 12   -> haelt die Kurve flach
 *   capMult        / outputTierMult = 12 / 13.0  -> verhindert Waende
 *   land.poolMult                  = 1.8        -> Land bindet wirklich
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
    poolMult: 1.8,        // gemessen: darunter wuergt es das Spiel ab, darueber
                          // ist Land bedeutungslos (siehe BALANCING.md)
  },

  /** Zoomstufen. */
  levels: {
    cap0: 0.6,             // profitabel verkaufbare Ware/s auf Stufe 0
    capMult: 12,
    /**
     * Aufstiegskosten, gemessen in Sekunden Umsatz der aktuellen Stufe. Das ist
     * zugleich die Dauer einer Stufe, denn ausgereizt ist sie lange vorher.
     *
     * Die ersten Stufen sind KURZ und wachsen dann bis zum Deckel. Vorher war
     * jede Stufe gleich lang (27 min) - auch die allererste, in der man drei
     * Knoepfe kennt und nichts zu entscheiden hat. Die Summe ueber alle Stufen
     * bleibt fast gleich, das Spiel ist also nicht kuerzer, nur vorne schneller.
     */
    upgradeSeconds: 1800,  // Deckel: ~30 min Umsatz
    upgradeSeconds0: 420,  // Straßenecke: ~7 min
    upgradeRamp: 1.45,
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

/**
 * Die 15 Herstellorte.
 *
 * `area` = Flaechenbedarf in m2. 0 heisst: braucht kein Land (Frachtschiff,
 * Orbitalstation) - das Ventil, wenn die Erde voll ist.
 *
 * `costMult` = Aufschlag auf die Stufenkosten. Orte, die dem Flaechenzwang
 * ausweichen, muessen SPUERBAR teurer sein. Ohne diesen Aufschlag ist
 * Landknappheit folgenlos: gemessen aenderte sich die Spieldauer nicht einmal
 * um eine Minute, wenn dem Spieler die halbe Welt fehlte - er wich einfach auf
 * Schiffe aus. Erst der Aufschlag macht "Land kaufen oder ausweichen?" zu einer
 * echten Entscheidung.
 */
export const SITES: ReadonlyArray<{ name: string; area: number; costMult: number }> = [
  { name: 'Badezimmer',          area: 2,           costMult: 1 },
  { name: 'Garage',              area: 8,           costMult: 1 },
  { name: 'Wohnwagen',           area: 15,          costMult: 1 },
  { name: 'Kellergeschoss',      area: 40,          costMult: 1.4 },  // dicht gebaut
  { name: 'Lagerhalle',          area: 250,         costMult: 1 },
  { name: 'Gewerbepark',         area: 900,         costMult: 1 },
  { name: 'Stillgelegte Fabrik', area: 4_500,       costMult: 0.8 },  // billig pro Flaeche
  { name: 'Farm / Gewächshaus',  area: 30_000,      costMult: 0.6 },  // Flaechenfresser
  { name: 'Frachtschiff',        area: 0,           costMult: 9 },    // kein Land noetig
  { name: 'Bergwerk',            area: 2_000,       costMult: 3 },    // kaum Oberflaeche
  { name: 'Pharmawerk',          area: 60_000,      costMult: 1 },
  { name: 'Raffinerie',          area: 400_000,     costMult: 0.8 },
  { name: 'Orbitalstation',      area: 0,           costMult: 9 },    // kein Land noetig
  { name: 'Mondbasis',           area: 1_000_000,   costMult: 1 },    // eigener Flaechenpool
  { name: 'Asteroiden-Cluster',  area: 100_000_000, costMult: 0.7 },
];

export const LEVELS: ReadonlyArray<string> = [
  'Straßenecke', 'Block', 'Stadt', 'Ballungsraum', 'Region', 'Land',
  'Nachbarländer', 'Kontinent', 'Hemisphäre', 'Welt', 'Orbit', 'Mond & Mars',
  'Äußeres System', 'Interstellar',
];
