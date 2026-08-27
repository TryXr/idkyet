/**
 * ALLE Balancing-Konstanten an genau einer Stelle.
 * Begruendung und Herleitung jeder Zahl steht in BALANCING.md.
 *
 * Das Spiel hat zwei Ketten und eine Landkarte:
 *   ZIEHEN       Pflanzen in Raeumen bringen Ernte, Gaertner pflegen sie.
 *   VERKAUFEN    Verkaeufer setzen die Ernte in einem Gebiet ab.
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
    hireRate: 0.02,
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
    /** Grundfaktor auf den Ertrag. Bleibt bei 1, ist nur ein Stellschraubchen. */
    workRate: 1,
    costBase: 8,
  },
  sell: {
    /** Ernte je Sekunde, die ein Dealer absetzt. */
    sellRate: 0.4,
    costBase: 14,
  },

  /**
   * PFLANZEN. Der Kreislauf des Spiels: die Ernte hat zwei Verwendungen, und
   * die zweite (zuruecklegen) ist der einzige Weg zu mehr Pflanzen. Bargeld
   * kauft PLATZ und PFLEGE, aber niemals Pflanzen.
   */
  plant: {
    /** Ernte je neuem Steckling im Badezimmer. */
    seedCost0: 6,
    /**
     * ...und je Raumstufe teurer. Bewusst gleich `rooms.qualityMult`: dadurch
     * dauert das Fuellen eines neuen Raumes ueberall gleich lange, und der
     * Rhythmus "Raum kaufen -> fuellen -> abkassieren" bleibt ueber alle acht
     * Ebenen derselbe.
     */
    seedCostMult: 1.55,
    /** Wie lange ein Steckling bis zur ersten Ernte braucht. */
    growSeconds: 90,
    /** Startstellung des Reglers: erst einmal halbe-halbe. */
    seedShare0: 0.5,
  },

  /**
   * PFLEGE. Ein Gaertner versorgt so viele Pflanzen - aber die Kurve ist weich
   * (1 - e^-x), nicht hart abgeschnitten. Ein hartes Minimum waere wieder nur
   * ein Thermostat ("kauf die kleinere Seite"); weich heisst, dass mehr Pflege
   * IMMER etwas bringt und man wirklich abwaegen muss (TIEFE.md, Befund 1.2).
   */
  care: {
    /**
     * Ernte je Sekunde, die ein Gaertner betreuen kann.
     *
     * Bezugsgroesse ist ausdruecklich der ERTRAG, nicht die Stueckzahl: eine
     * Pflanze im Orbitalgewaechshaus macht mehr Arbeit als eine im Badezimmer.
     * Anders herum saettigte die Pflege nach kurzer Zeit dauerhaft bei 100 %,
     * und die ganze Anbaukette war ab der dritten Ebene Dekoration - gemessen
     * 1.09e8 Gaertner fuer 30 k Pflanzen.
     *
     * 0.075 = 1.5 Pflanzen im Badezimmer. Der Anfang bleibt damit unveraendert.
     */
    perGardener: 0.075,
    /** Unbezahlte Rechnungen druecken die Pflege bis hierhin, nie tiefer. */
    floor: 0.2,
  },

  /**
   * BETRIEBSKOSTEN. Strom und Duenger laufen fuer jeden PLATZ, ob eine Pflanze
   * darin steht oder nicht. Deshalb blutet ein leerer Raum - und deshalb ist
   * ein Raumkauf eine Entscheidung mit Nachspiel statt eines Listeneintrags.
   * Anteil an dem, was ein voll besetzter Raum einbringen wuerde.
   */
  upkeep: {
    share: 0.15,
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
    /**
     * Ernte je Klick, als Vielfaches aus Raumqualitaet UND Pflanzenzahl.
     * Dass es mit den Pflanzen mitwaechst, ist wichtig: sonst waere in der
     * ersten Minute, in der noch kein Gaertner da ist, das Zuruecklegen reiner
     * Verlust - und der Spieler lernte die Kernentscheidung falsch.
     */
    cookPortion: 8,
    /** Ernte je Klick auf "verkaufen", als Vielfaches der Dealer-Leistung. */
    sellPortion: 12,
  },

  /** Zoomstufen: wie Bedarf, Preis und Rente mit der Stufe wachsen. */
  levels: {
    /** Gesamtbedarf aller Gebiete der Stufe 0, in Ware. */
    demand0: 45,
    demandMult: 13,
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

  /**
   * DIE KONKURRENZ. Sie nimmt sich offene Gebiete, wenn du zu lange brauchst.
   *
   * Der einzige Gegendruck im Spiel (TIEFE.md, Befund 1.3): ohne sie ist die
   * Karte eine Checkliste, die man in beliebiger Reihenfolge abarbeitet, und
   * aufmerksames Spiel bringt fast nichts.
   *
   * Sie arbeitet mit einem Anteil DEINES Durchsatzes. Das ist Absicht: so
   * bleibt sie ueber acht Groessenordnungen hinweg relevant, ohne dass fuer
   * jede Ebene eine eigene Zahl gepflegt werden muss.
   */
  rival: {
    /** Ab dieser Zoomstufe taucht sie auf (siehe Entfaltungsplan, TIEFE.md). */
    startLevel: 3,
    /** Anteil deines Durchsatzes, mit dem sie liefert. */
    share: 0.35,
    /** Auf so viele Gebiete gleichzeitig verteilt sie ihre Arbeit. */
    spread: 3,
    /** Aufschlag auf den Bedarf, wenn ein Gebiet zurueckerobert werden muss. */
    penalty: 1.5,
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
  'Gärtner', 'Grower', 'Botaniker', 'Professor',
];

/** Nach oben hin wird die Kette immer legaler. Niemand kommentiert es. */
export const SELL_CHAIN: ReadonlyArray<string> = [
  'Dealer', 'Straßenboss', 'Großhändler', 'Konzernchef',
];

/**
 * Die Raeume. Nur die Namen stehen hier - Plaetze, Qualitaet und Preis kommen
 * aus den Formeln oben. Die Reihe ist zugleich die Fortschrittsanzeige des
 * Spiels und seine Gag-Kurve: vom eigenen Badezimmer bis zum
 * Asteroiden-Gewaechshaus, und niemand kommentiert es.
 *
 * ZWOELF STUFEN, nicht fuenfzehn. Gemessen wurde im Durchlauf nie mehr als die
 * zwoelfte gekauft - die letzten drei waren totes Inventar. Eine Option, die
 * nie richtig ist, war nie eine Option (TIEFE.md, Befund 1.6).
 */
export const ROOM_NAMES: ReadonlyArray<string> = [
  'Badezimmer', 'Kleiderschrank', 'Dachboden', 'Kellergeschoss', 'Garage',
  'Gartenlaube', 'Gewächshaus', 'Scheune', 'Lagerhalle', 'Plantage',
  'Orbitalgewächshaus', 'Asteroiden-Gewächshaus',
];

/** Die Zoomstufen. Namen der Gebiete stehen in content/places.ts. */
export const LEVELS: ReadonlyArray<string> = [
  'Ruhrgebiet', 'Deutschland', 'Europa', 'Welt',
  'Erdorbit', 'Mond & Mars', 'Äußeres System', 'Interstellar',
];
