/**
 * Die Stimmen. Erzaehlschicht, Tutorial und Witzmotor in einem - genau wie die
 * Karte zugleich Markt und Territorium ist. Ein System, drei Funktionen.
 *
 * HARTE GRENZE: hoechstens 5 Zeilen je Zoomstufe (CLAUDE.md). Das ist der
 * einzige Inhalt im Spiel, der nicht generiert wird, also der einzige, der
 * nicht mitskaliert. Der Test in tools/test-ui.ts prueft den Deckel mit.
 *
 * Grundton ist Komoedie: die Stimmen sind FIGUREN, keine Bedrohung. Sie
 * widersprechen sich, und die Eskalation geht ins Absurde, nicht ins Duestere -
 * am Ende sorgen sie sich um Lieferfristen zum Asteroidenguertel, als waere das
 * eine voellig normale Sorge.
 */
import type { GameEvent } from '../core/events.js';

export type Speaker = 'Der Buchhalter' | 'Die Prophetin' | 'Kevin';

/** Wann eine Zeile faellt. */
export type Cue =
  | { on: 'enter' }                          // beim Betreten der Stufe
  | { on: 'event'; type: GameEvent['type'] } // beim ersten Auftreten
  | { on: 'tier'; tier: number };            // erster Ort dieser Art

export interface VoiceLine {
  id: string;
  /** Zoomstufe, zu der die Zeile gehoert. Zaehlt gegen den Deckel von 5. */
  level: number;
  speaker: Speaker;
  text: string;
  cue: Cue;
}

const enter = (
  id: string, level: number, speaker: Speaker, text: string,
): VoiceLine => ({ id, level, speaker, text, cue: { on: 'enter' } });

const on = (
  id: string, level: number, type: GameEvent['type'], speaker: Speaker, text: string,
): VoiceLine => ({ id, level, speaker, text, cue: { on: 'event', type } });

const tier = (
  id: string, level: number, t: number, speaker: Speaker, text: string,
): VoiceLine => ({ id, level, speaker, text, cue: { on: 'tier', tier: t } });

/**
 * Die Zeilen. Reihenfolge egal, der Regisseur sortiert nach Stufe.
 * Tutorialzeilen erklaeren die Mechanik NEBENBEI - kein Kasten, kein Pfeil.
 */
export const VOICE_LINES: readonly VoiceLine[] = [
  // --- 0 Straßenecke -----------------------------------------------------
  enter('start-1', 0, 'Die Prophetin', 'Beliefere jeden. Jeden Einzelnen. Dann sind wir still.'),
  enter('start-2', 0, 'Der Buchhalter', 'Wir beginnen im Badezimmer. Ich möchte protokolliert haben, dass ich dagegen war.'),
  enter('start-3', 0, 'Kevin', 'Die Straßenecke zählt auch schon als Menschheit. Ich hab nachgesehen.'),
  on('lock-1', 0, 'marketLocked', 'Der Buchhalter', 'Die Ecke macht dicht. Du warst zu oft da, das fällt auf. Lass sie abkühlen, dann kauft sie wieder.'),
  on('store-1', 0, 'storageFull', 'Kevin', 'Das Lager ist voll und die Leute produzieren einfach weiter. Also nein. Tun sie nicht. Sie stehen jetzt rum.'),

  // --- 1 Block -----------------------------------------------------------
  enter('block-1', 1, 'Die Prophetin', 'Ein ganzer Block. Zwei von uns dreien applaudieren.'),
  tier('block-2', 1, 2, 'Kevin', 'Ein Wohnwagen kann wegfahren. Der Ärger bleibt trotzdem stehen. Finde ich unfair.'),
  on('pilot-1', 1, 'pilotUpgraded', 'Der Buchhalter', 'Du hast jemanden eingestellt. Er ist schlechter als du. Aber er ist nachts da, und du nicht.'),
  on('mile-1', 1, 'milestoneReached', 'Kevin', 'Ab fünfundzwanzig Stück läuft alles doppelt. Warum, weiß ich nicht. Frag den Buchhalter.'),

  // --- 2 Stadt -----------------------------------------------------------
  enter('city-1', 2, 'Der Buchhalter', 'Eine Stadt. Rechnerisch dreihunderttausend Kunden und ein Ordnungsamt.'),
  enter('city-2', 2, 'Die Prophetin', 'Sie schlafen. Sie ahnen nichts. Wecke sie behutsam. Mit Angebot.'),
  tier('city-3', 2, 3, 'Kevin', 'Keller sind super. Da ist immer Platz. Außer da stehen Fahrräder.'),
  on('land-1', 2, 'landFull', 'Der Buchhalter', 'Das Land ist aus. Alles gekauft. Ab jetzt wird höher gebaut, tiefer, oder gleich auf dem Wasser.'),

  // --- 3 Ballungsraum ----------------------------------------------------
  enter('metro-1', 3, 'Kevin', 'Ballungsraum. Das heißt, die Leute ballen sich. Für uns ist das eigentlich praktisch.'),
  enter('metro-2', 3, 'Der Buchhalter', 'Deine Fläche wächst schneller als meine Buchhaltung. Das ist kein Kompliment.'),
  tier('metro-3', 3, 4, 'Die Prophetin', 'Eine Lagerhalle. Endlich etwas, das aussieht, als gehörte es dir.'),

  // --- 4 Region ----------------------------------------------------------
  enter('region-1', 4, 'Die Prophetin', 'Die Region ist ein Organismus. Du bist der Kreislauf. Sei ein gründlicher Kreislauf.'),
  enter('region-2', 4, 'Der Buchhalter', 'Drei Gebiete hast du seit einer Stunde in Ruhe gelassen. Die haben sich prächtig erholt. Nur so als Hinweis.'),
  tier('region-3', 4, 6, 'Kevin', 'Eine stillgelegte Fabrik. Riesig, billig, und niemand fragt nach. Mein Lieblingsort bisher.'),

  // --- 5 Land ------------------------------------------------------------
  enter('country-1', 5, 'Der Buchhalter', 'Ein ganzes Land. Formal bist du jetzt ein mittelständisches Unternehmen mit Problemen.'),
  enter('country-2', 5, 'Kevin', 'Wenn wir ein Land beliefern, kriegen wir dann so eine Flagge?'),
  tier('country-3', 5, 7, 'Die Prophetin', 'Ein Gewächshaus. Weit, satt, grün. Frag nicht, was darin wächst. Es wächst.'),

  // --- 6 Nachbarländer ---------------------------------------------------
  enter('neighbours-1', 6, 'Der Buchhalter', 'Grenzen sind Striche auf Karten. Der Zoll ist trotzdem echt. Ich habe Formulare besorgt.'),
  enter('neighbours-2', 6, 'Kevin', 'Die Nachbarn kennen uns noch nicht. Das ist der beste Zustand, in dem ein Nachbar sein kann.'),
  tier('neighbours-3', 6, 8, 'Die Prophetin', 'Ein Frachtschiff. Das Meer gehört niemandem. Das Meer gehört jetzt uns.'),

  // --- 7 Kontinent -------------------------------------------------------
  enter('continent-1', 7, 'Die Prophetin', 'Ein Kontinent. Von hier sehen die Märkte aus wie Zellen. Sie atmen. Sie brennen aus. Sie atmen wieder.'),
  enter('continent-2', 7, 'Der Buchhalter', 'Zur Erinnerung: angefangen haben wir im Badezimmer. Ich führe darüber Buch.'),
  tier('continent-3', 7, 9, 'Kevin', 'Ein Bergwerk. Unter der Erde zählt keine Fläche. Ich glaube, wir schummeln gerade.'),

  // --- 8 Hemisphäre ------------------------------------------------------
  enter('hemi-1', 8, 'Kevin', 'Die halbe Welt. Die ANDERE Hälfte weiß noch nichts davon. Das macht mich fertig.'),
  enter('hemi-2', 8, 'Der Buchhalter', 'Die Hälfte deiner Märkte ist heiß. Schalte Gebiete ab, sonst schalten sie sich selbst ab.'),
  tier('hemi-3', 8, 10, 'Der Buchhalter', 'Ein Pharmawerk. Vollkommen legal, sagt das Schild. Ich habe das Schild selbst aufgehängt.'),

  // --- 9 Welt ------------------------------------------------------------
  enter('world-1', 9, 'Die Prophetin', 'Die Welt. Jeder Mensch. Endlich. Fast.'),
  enter('world-2', 9, 'Der Buchhalter', 'Fast. Die Erde ist begrenzt, das war absehbar. Der Rest liegt oben.'),
  enter('world-3', 9, 'Kevin', 'Oben ist doch nichts. Oben sind nur Satelliten, und die kaufen nichts. Oder?'),
  tier('world-4', 9, 11, 'Die Prophetin', 'Eine Raffinerie, so groß wie eine Kleinstadt. Auf der Erde geht nicht mehr.'),

  // --- 10 Orbit ----------------------------------------------------------
  enter('orbit-1', 10, 'Kevin', 'Wir sind im Weltraum. WIR SIND IM WELTRAUM. Entschuldigung. Ich bin wieder ruhig.'),
  enter('orbit-2', 10, 'Der Buchhalter', 'Eine Orbitalstation braucht keinen Quadratmeter Erde. Sie kostet dafür wie ein kleines Land.'),
  enter('orbit-3', 10, 'Die Prophetin', 'Von hier oben ist die Erde ein einziger Markt. Ein müder, gut belieferter Markt.'),

  // --- 11 Mond & Mars ----------------------------------------------------
  enter('moon-1', 11, 'Der Buchhalter', 'Der Mond hat Fläche. Sehr viel Fläche. Und keine Behörde. Ich bin fast gerührt.'),
  enter('moon-2', 11, 'Kevin', 'Auf dem Mars wohnen zwölf Leute. Zwölf! Die müssen wir ALLE erwischen.'),
  enter('moon-3', 11, 'Die Prophetin', 'Zwölf sind zwölf. Wir haben mit dreien angefangen, und zwei davon waren wir.'),

  // --- 12 Äußeres System -------------------------------------------------
  enter('outer-1', 12, 'Der Buchhalter', 'Die Lieferfrist zum Asteroidengürtel liegt bei elf Monaten. Ein ganz normales Problem. Ich habe es im Griff.'),
  enter('outer-2', 12, 'Kevin', 'Ich hab den Asteroiden Namen gegeben. Der große da heißt Kevin. Nach mir.'),
  enter('outer-3', 12, 'Die Prophetin', 'Noch ein Ring. Noch ein Mond. Noch einer. Wir sind so nah.'),

  // --- 13 Interstellar (Ende) --------------------------------------------
  enter('inter-1', 13, 'Die Prophetin', 'Das war der letzte. Es gibt keinen mehr. Wir sind... zufrieden.'),
  enter('inter-2', 13, 'Der Buchhalter', 'Zum ersten Mal stimmen die Bücher. Auf den Cent. Es fühlt sich seltsam an.'),
  on('inter-3', 13, 'finished', 'Kevin', 'Und was machen wir jetzt?'),
  on('inter-4', 13, 'finished', 'Die Prophetin', 'Wir könnten wieder von vorn anfangen. Ganz klein. Im Badezimmer.'),
  on('inter-5', 13, 'finished', 'Der Buchhalter', 'Nein.'),
];

/**
 * Der Regisseur. Haelt fest, was schon gefallen ist, und gibt Zeilen einzeln
 * heraus - drei Stimmen, die sich gegenseitig uebersprechen, sind kein Witz mehr.
 *
 * Zeilen einer hoeheren Stufe warten, bis der Spieler dort ist. Verpasste
 * Zeilen tieferer Stufen fallen nicht nach: sie waeren dort albern und hier
 * unverstaendlich.
 */
export class VoiceDirector {
  private fired = new Set<string>();
  private queue: VoiceLine[] = [];
  private seenTiers = new Set<number>();
  private lines: readonly VoiceLine[];

  constructor(private level = 0, lines: readonly VoiceLine[] = VOICE_LINES) {
    this.lines = lines;
    // Beim Laden eines Standes gilt alles Fruehere als gesagt.
    for (const line of lines) if (line.level < level) this.fired.add(line.id);
    this.enterLevel(level);
  }

  /** Ereignisse der Simulation entgegennehmen. */
  handle(event: GameEvent): void {
    if (event.type === 'levelUp') {
      this.level = event.level;
      this.enterLevel(event.level);
      return;
    }
    if (event.type === 'siteBought') {
      if (this.seenTiers.has(event.tier)) return;
      this.seenTiers.add(event.tier);
      this.fire(l => l.cue.on === 'tier' && l.cue.tier === event.tier);
      return;
    }
    this.fire(l => l.cue.on === 'event' && l.cue.type === event.type);
  }

  private enterLevel(level: number): void {
    this.fire(l => l.cue.on === 'enter' && l.level === level);
  }

  private fire(match: (line: VoiceLine) => boolean): void {
    for (const line of this.lines) {
      if (this.fired.has(line.id)) continue;
      if (line.level > this.level) continue;   // die Stufe kommt erst noch
      if (!match(line)) continue;
      this.fired.add(line.id);
      this.queue.push(line);
    }
  }

  /** Naechste Zeile, oder null. */
  take(): VoiceLine | null {
    return this.queue.shift() ?? null;
  }

  get pending(): number {
    return this.queue.length;
  }

  hasFired(id: string): boolean {
    return this.fired.has(id);
  }
}
