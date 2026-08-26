/**
 * Beschriftungen und Erklaerungen der Bedienung.
 *
 * Warum hier und nicht im UI-Code: es ist handgeschriebener Text, genau wie die
 * Stimmen - und Text, der im Code verstreut liegt, laesst sich weder im Ton
 * pruefen noch spaeter uebersetzen. Derselbe trockene Ton wie die Stimmen, aber
 * ohne Pointen: eine Schaltflaeche, die einen Witz macht, erklaert nichts.
 */

/** Was der jeweilige Statthalter besser macht. Reihenfolge wie BALANCE.pilots. */
export const PILOT_DESCRIPTIONS: readonly string[] = [
  'Kippt die Ware gleichmäßig überall ab. Schlechter als du – aber er arbeitet auch, wenn du weg bist.',
  'Merkt jetzt, wenn ein Gebiet heiß wird, und lässt es in Ruhe.',
  'Hält Maß und beliefert die lohnendsten Gebiete zuerst.',
  'Schaut alle anderthalb Minuten nach dem Rechten statt alle fünf.',
];

/** Was jede Statthalter-Stufe im Kopf des Spielers ersetzt. */
export const PILOT_MANUAL = 'Handbetrieb – du verteilst selbst. Niemand verkauft, während du weg bist.';

export const HINTS = {
  sites: 'Herstellorte liefern Ware pro Sekunde. Jede weitere Einheit derselben Art kostet mehr.',
  land: 'Land ist endlich. Herstellorte brauchen Fläche – der Preis steigt, je weniger übrig ist.',
  storage: 'Volles Lager stoppt die Produktion. Nichts geht verloren, es steht nur still.',
  pilot: 'Der Statthalter verkauft für dich. Er ist nie so gut wie du, aber er schläft nicht.',
  levelUp: 'Größere Reichweite heißt frische Märkte. Erst dort lohnt sich mehr Produktion.',
  map: 'Gebiete anklicken schaltet sie ab. Abgeschaltete Gebiete kühlen ab und erholen sich im Preis. Mausrad zoomt, Ziehen verschiebt.',
  /** Solange kein Statthalter angestellt ist, bedeutet derselbe Klick etwas anderes. */
  mapManual: 'Klick auf ein Gebiet liefert eine Ladung dorthin. Niemand verkauft für dich, also musst du selbst fahren. Mausrad zoomt, Ziehen verschiebt.',
} as const;

/**
 * Das Ende. Pointe statt Pathos (CLAUDE.md): das Spiel rechnet vor, was gebaut
 * wurde, die Stimmen sind zum ersten Mal zufrieden - und wissen dann nichts
 * mehr mit sich anzufangen. Der Witz gehoert den Stimmen, hier steht die Bilanz.
 */
export const ENDING = {
  title: 'Jeder ist beliefert.',
  lead: 'Kein Markt mehr offen. Nirgends. Die Stimmen sind still.',
  closing: 'Das war alles. Es gibt niemanden mehr.',
  /** Der Demo-Build endet frueher und sagt das auch so. */
  demoTitle: 'Ende der Demo',
  demoLead: 'Bis hierher reicht diese Fassung. Die Karte zoomt noch elf Stufen weiter.',
  demoClosing: 'Die Stimmen haben noch einiges vor.',
  close: 'Bilanz schließen',
} as const;

/** Kurze Begruendungen, warum ein Kauf gerade nicht geht. */
export const BLOCKED = {
  cash: 'Bargeld reicht nicht',
  area: 'zu wenig Fläche',
  landGone: 'kein Land mehr frei',
  saturated: 'Märkte sind noch nicht ausgereizt',
} as const;

/** Warnungen, die oben im Bedienfeld stehen, wenn sie zutreffen. */
export const WARNINGS = {
  storageFull: 'Lager voll – die Produktion steht still.',
  allLocked: 'Alle Gebiete gesperrt oder abgeschaltet. Es wird gerade nichts verkauft.',
  noPilot: 'Ohne Statthalter verdienst du nichts, während das Spiel geschlossen ist.',
  saturated: 'Die Märkte sind ausgereizt. Mehr Produktion bringt hier kaum noch etwas.',
  /** Der wichtigste Satz der ersten Minute: hier steht, was zu tun ist. */
  deliver: 'Ware im Lager. Klick ein Gebiet auf der Karte an, um sie auszuliefern.',
} as const;
