/**
 * Beschriftungen und Erklaerungen der Bedienung.
 *
 * Warum hier und nicht im UI-Code: es ist handgeschriebener Text, genau wie die
 * Stimmen - und Text, der im Code verstreut liegt, laesst sich weder im Ton
 * pruefen noch spaeter uebersetzen. Derselbe trockene Ton wie die Stimmen, aber
 * ohne Pointen: eine Schaltflaeche, die einen Witz macht, erklaert nichts.
 */

export const HINTS = {
  cook: 'Arbeiter kochen Ware. Wie viel, entscheidet der Raum: Badezimmer wenig, Labor viel.',
  rooms: 'Räume bieten Plätze. Arbeiter ohne Platz stehen herum und kochen nichts.',
  sell: 'Verkäufer setzen die Ware im Zielgebiet ab. Jede höhere Stufe stellt die darunter ein.',
  storage: 'Volles Lager stoppt die Produktion. Nichts geht verloren, es steht nur still.',
  target: 'Ware geht immer ins gewählte Gebiet. Ist es voll, gehört es dir und zahlt dauerhaft.',
  map: 'Klick auf ein Gebiet macht es zum Ziel. Gefüllte Gebiete gehören dir. Mausrad zoomt, Ziehen verschiebt.',
} as const;

export const HANDS = {
  cook: 'Kochen',
  sell: 'Verkaufen',
  /** Solange keine Helfer da sind, ist das der ganze Betrieb. */
  hint: 'Am Anfang machst du beides selbst. Der erste Junkie kocht für dich, der erste Dealer verkauft.',
  cookBlocked: 'Lager voll',
  sellBlocked: 'nichts im Lager',
} as const;

/** Warnungen, die oben im Bedienfeld stehen, wenn sie zutreffen. */
export const WARNINGS = {
  storageFull: 'Lager voll – die Produktion steht still. Mehr Verkäufer oder ein größeres Lager.',
  idleWorkers: 'Arbeiter ohne Platz. Sie kochen nichts, bis ein Raum frei ist.',
  noSellers: 'Niemand verkauft. Die Ware bleibt liegen, bis du es selbst tust oder einen Dealer anstellst.',
  noWorkers: 'Niemand kocht. Ohne Ware gibt es nichts zu verkaufen.',
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
