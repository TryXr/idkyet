/**
 * ALLE Balancing-Konstanten an genau einer Stelle.
 * Begruendung und Herleitung jeder Zahl steht in BALANCING.md.
 *
 * Das Spiel hat zwei Ketten und eine Landkarte:
 *   KOCHEN       Arbeiter in Raeumen machen Ware.
 *   VERKAUFEN    Verkaeufer setzen sie in einem Gebiet ab.
 *   UEBERNEHMEN  Ein volles Gebiet gehoert dir und zahlt Rente.
 *
 * Raeume und Ketten sind mit FORMELN beschrieben, nicht als Tabelle von Hand.
 * Vorher stand hier eine handgetippte Liste, in der jede Zeile einzeln falsch
 * sein konnte - so laesst sich stattdessen die ganze Leiter mit einer Zahl
 * verschieben und durchmessen (npm run sweep).
 */
export const BALANCE = {
  /**
   * Die beiden Helfer-Ketten. Stufe 0 arbeitet, jede hoehere stellt die
   * darunter ein - dadurch waechst die Produktion polynomial, waehrend die
   * Kosten exponentiell steigen (der Genre-Motor, siehe CLAUDE.md).
   */
  chain: {
    /** Einheiten je Sekunde, die eine Einheit der Stufe darueber einstellt. */
    hireRate: 0.0004,
    /** Jede weitere Einheit derselben Art kostet so viel mehr. */
    costGrowth: 1.12,
    /** Aufschlag je Kettenstufe. */
    costTierMult: 55,
    /** Meilensteine: x2 bei dieser Stueckzahl derselben Art. */
    milestones: [25, 50, 100, 200, 400, 800, 1600, 3200],
    milestoneMult: 2,
  },

  /** Was Stufe 0 der jeweiligen Kette leistet. */
  cook: {
    /** Ein Junkie schafft die Qualitaet seines Raumes mal diesen Faktor. */
    workRate: 1,
    costBase: 8,
  },
  sell: {
    /** Ware je Sekunde, die ein Dealer absetzt. */
    sellRate: 0.4,
    costBase: 14,
  },

  /**
   * Raeume: Plaetze und Qualitaet als Leiter.
   * Ertrag eines Raumes = seats * quality, waechst also rund dreifach je Stufe.
   */
  rooms: {
    seats0: 2,
    seatsMult: 1.6,
    quality0: 0.05,
    qualityMult: 1.55,
    cost0: 25,
    costMult: 5.5,
    /** Jedes weitere Exemplar derselben Art. */
    costGrowth: 1.15,
  },

  /** Ein Klick von Hand - nur die erste Minute, danach uebernehmen Helfer. */
  manual: {
    /** Ware je Klick auf "kochen", als Vielfaches der besten Raumqualitaet. */
    cookPortion: 8,
    /** Ware je Klick auf "verkaufen", als Vielfaches der Dealer-Leistung. */
    sellPortion: 12,
  },

  /** Zoomstufen: wie Bedarf, Preis und Rente mit der Stufe wachsen. */
  levels: {
    /** Gesamtbedarf aller Gebiete der Stufe 0, in Ware. */
    demand0: 45,
    demandMult: 15,
    /**
     * Der Zuwachs je Stufe KLINGT AB. Frueh soll der Bedarf schneller wachsen
     * als der Durchsatz (dadurch werden die Stufen laenger und gewichtiger),
     * spaet langsamer - denn oben endet die Raumleiter und der Durchsatz
     * waechst nicht mehr mit. Ohne dieses Abklingen dauerte die letzte Stufe
     * gemessen bis zu 172 min, waehrend die erste 8 min brauchte.
     */
    demandDecay: 0.87,
    /** Erloes je Ware auf Stufe 0. */
    price0: 1.6,
    priceMult: 3.2,
    /**
     * Rente: ein uebernommenes Gebiet zahlt seinen eigenen Wert in dieser Zeit
     * noch einmal ab. Klein genug, dass Renten das Kochen nie ersetzen, gross
     * genug, dass eine Uebernahme sich nach Besitz anfuehlt.
     */
    rentSeconds: 9000,
    /** Gebiete je Stufe. */
    perLevel: 15,
  },

  /** Streuung der Gebiete. Ohne sie waere die Zielwahl gleichgueltig. */
  spread: {
    demandSigma: 1.1,
    priceSigma: 0.55,
    rentSigma: 0.8,
  },

  /** Lager: laeuft es ueber, stockt die Produktion (kein Verlust). */
  storage: { bufferSeconds: 45, bufferPerLevel: 1.7, costBase: 120, costGrowth: 1.7 },

  offlineCapSeconds: 8 * 3600,
  tickSeconds: 1,
};

/**
 * Die beiden Ketten. Stufe 0 arbeitet, alle darueber stellen ein.
 *
 * Vier Stufen je Kette sind genug: die vierte laeuft erst im letzten Drittel
 * an, und jede weitere waere nur eine Zahl mehr ohne neue Entscheidung.
 */
export const COOK_CHAIN: ReadonlyArray<string> = [
  'Junkie', 'Koch', 'Chemiker', 'Professor',
];

export const SELL_CHAIN: ReadonlyArray<string> = [
  'Dealer', 'Straßenboss', 'Kartellchef', 'Pate',
];

/**
 * Die Raeume. Nur die Namen stehen hier - Plaetze, Qualitaet und Preis kommen
 * aus den Formeln oben. Die Reihe ist zugleich die Gag-Kurve des Spiels:
 * Badezimmer bis Asteroiden-Cluster, und niemand kommentiert es.
 */
export const ROOM_NAMES: ReadonlyArray<string> = [
  'Badezimmer', 'Garage', 'Wohnwagen', 'Kellergeschoss', 'Lagerhalle',
  'Gewerbepark', 'Stillgelegte Fabrik', 'Farm / Gewächshaus', 'Frachtschiff',
  'Bergwerk', 'Pharmawerk', 'Raffinerie', 'Orbitalstation', 'Mondbasis',
  'Asteroiden-Cluster',
];

/** Die Zoomstufen. Namen der Gebiete stehen in content/places.ts. */
export const LEVELS: ReadonlyArray<string> = [
  'Ruhrgebiet', 'Deutschland', 'Europa', 'Welt',
  'Erdorbit', 'Mond & Mars', 'Äußeres System', 'Interstellar',
];
