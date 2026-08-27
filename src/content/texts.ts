/**
 * Beschriftungen und Erklaerungen der Bedienung.
 *
 * Warum hier und nicht im UI-Code: es ist handgeschriebener Text, genau wie die
 * Stimmen - und Text, der im Code verstreut liegt, laesst sich weder im Ton
 * pruefen noch spaeter uebersetzen. Derselbe trockene Ton wie die Stimmen, aber
 * ohne Pointen: eine Schaltflaeche, die einen Witz macht, erklaert nichts.
 */

export const HINTS = {
  cook: 'Gärtner pflegen die Pflanzen. Ohne Pflege bringt auch der beste Raum wenig.',
  rooms: 'Räume bieten Plätze und bestimmen die Güte. Strom läuft für jeden Platz, auch für leere.',
  sell: 'Verkäufer setzen die Ernte im Zielgebiet ab. Jede höhere Stufe stellt die darunter ein.',
  storage: 'Volles Lager stoppt die Ernte. Nichts geht verloren, es steht nur still.',
  target: 'Die Ernte geht immer ins gewählte Gebiet. Ist es voll, gehört es dir und zahlt dauerhaft.',
  map: 'Klick auf ein Gebiet macht es zum Ziel. Gefüllte Gebiete gehören dir. Mausrad zoomt, Ziehen verschiebt.',
  seed: 'Was du zurücklegst, wird zu neuen Pflanzen. Was du verkaufst, wird zu Geld. Beides geht nicht.',
} as const;

export const HANDS = {
  cook: 'Ernten',
  sell: 'Verkaufen',
  /** Solange keine Helfer da sind, ist das der ganze Betrieb. */
  hint: 'Am Anfang machst du beides selbst. Jede Pflanze mehr macht das Ernten ergiebiger.',
  cookBlocked: 'Lager voll',
  sellBlocked: 'nichts im Lager',
} as const;

/** Der Regler. Die wichtigste Entscheidung des Spiels, in zwei Worten. */
export const SEED = {
  title: 'Ernte',
  back: 'zurücklegen',
  sell: 'verkaufen',
} as const;

/** Warnungen, die oben im Bedienfeld stehen, wenn sie zutreffen. */
export const WARNINGS = {
  storageFull: 'Lager voll – die Ernte steht still. Mehr Verkäufer oder ein größeres Lager.',
  idleWorkers: 'Pflanzen ohne Platz. Sie warten, bis ein Raum frei ist.',
  noSellers: 'Niemand verkauft. Die Ernte bleibt liegen, bis du es selbst tust oder einen Dealer anstellst.',
  noWorkers: 'Niemand pflegt die Pflanzen. Ohne Gärtner wächst nichts von allein.',
  unpaid: 'Die Stromrechnung ist offen – die Pflege leidet. Verkauf etwas.',
  /** Bekommt den Ortsnamen angehängt - eine Warnung ohne Ziel ist keine. */
  rivalClose: 'Die Konkurrenz ist kurz davor, dir etwas wegzuschnappen:',
  emptySeats: 'Plätze stehen leer und kosten trotzdem Strom. Leg mehr Ernte zurück.',
} as const;

/**
 * Das Ende. Pointe statt Pathos (CLAUDE.md): das Spiel rechnet vor, was
 * uebernommen wurde, die Stimmen sind zum ersten Mal zufrieden - und wissen
 * dann nichts mehr mit sich anzufangen.
 */
export const ENDING = {
  title: 'Alles beliefert.',
  lead: 'Kein Gebiet mehr offen. Nirgends. Die Stimmen sind still.',
  closing: 'Das war alles. Es gibt niemanden mehr.',
  demoTitle: 'Ende der Demo',
  demoLead: 'Bis hierher reicht diese Fassung. Die Karte zoomt noch vier Stufen weiter.',
  demoClosing: 'Die Stimmen haben noch einiges vor.',
  close: 'Bilanz schließen',
} as const;
