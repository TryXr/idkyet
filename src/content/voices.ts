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
import type { ChainKey } from '../core/chains.js';

export type Speaker = 'Der Buchhalter' | 'Die Prophetin' | 'Kevin';

/** Wann eine Zeile faellt. */
export type Cue =
  | { on: 'enter' }                            // beim Betreten der Stufe
  | { on: 'event'; type: GameEvent['type'] }   // beim ersten Auftreten
  | { on: 'room'; tier: number }               // erster Raum dieser Art
  | { on: 'unit'; chain: ChainKey; tier: number }; // erster Helfer dieser Art

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

const room = (
  id: string, level: number, tier: number, speaker: Speaker, text: string,
): VoiceLine => ({ id, level, speaker, text, cue: { on: 'room', tier } });

const unit = (
  id: string, level: number, chain: ChainKey, tier: number, speaker: Speaker, text: string,
): VoiceLine => ({ id, level, speaker, text, cue: { on: 'unit', chain, tier } });

/**
 * Die Zeilen. Reihenfolge egal, der Regisseur sortiert nach Stufe.
 * Tutorialzeilen erklaeren die Mechanik NEBENBEI - kein Kasten, kein Pfeil.
 */
export const VOICE_LINES: readonly VoiceLine[] = [
  // --- 0 Ruhrgebiet ------------------------------------------------------
  enter('start-1', 0, 'Die Prophetin', 'Beliefere jeden. Jeden Einzelnen. Dann sind wir still.'),
  enter('start-2', 0, 'Der Buchhalter', 'Wir beginnen im Badezimmer in Duisburg. Ich möchte protokolliert haben, dass ich dagegen war.'),
  unit('start-3', 0, 'cook', 0, 'Kevin', 'Der Junkie kocht jetzt für dich. Du musst nicht mehr selbst rühren. Ich fand Rühren schön.'),
  unit('start-4', 0, 'sell', 0, 'Der Buchhalter', 'Ein Dealer. Ab jetzt verkauft sich das von allein, auch wenn du nicht hinsiehst.'),
  on('start-5', 0, 'territoryTaken', 'Die Prophetin', 'Duisburg ist versorgt. Es gehört uns. Es zahlt jetzt. Für immer.'),

  // --- 1 Deutschland -----------------------------------------------------
  enter('de-1', 1, 'Kevin', 'Ganz Deutschland! Also erstmal Düsseldorf. Aber das zählt auch.'),
  enter('de-2', 1, 'Der Buchhalter', 'Rechnerisch dreihunderttausend Kunden je Stadt und ein Ordnungsamt.'),
  unit('de-3', 1, 'cook', 1, 'Der Buchhalter', 'Ein Koch. Er kocht nichts. Er stellt Junkies ein. Dafür wird er bezahlt, ja.'),
  room('de-4', 1, 2, 'Kevin', 'Ein Wohnwagen kann wegfahren. Der Ärger bleibt trotzdem stehen. Finde ich unfair.'),
  on('de-5', 1, 'storageFull', 'Kevin', 'Das Lager ist voll und die Leute kochen einfach weiter. Also nein. Tun sie nicht. Sie stehen jetzt rum.'),

  // --- 2 Europa ----------------------------------------------------------
  enter('eu-1', 2, 'Der Buchhalter', 'Grenzen sind Striche auf Karten. Der Zoll ist trotzdem echt. Ich habe Formulare besorgt.'),
  enter('eu-2', 2, 'Die Prophetin', 'Sie schlafen. Sie ahnen nichts. Wecke sie behutsam. Mit Angebot.'),
  unit('eu-3', 2, 'sell', 1, 'Kevin', 'Ein Straßenboss! Der stellt Dealer ein. Wir stellen jetzt Leute ein, die Leute einstellen.'),
  room('eu-4', 2, 4, 'Die Prophetin', 'Eine Lagerhalle. Endlich etwas, das aussieht, als gehörte es dir.'),
  enter('eu-5', 2, 'Kevin', 'Die Nachbarn kennen uns noch nicht. Das ist der beste Zustand, in dem ein Nachbar sein kann.'),

  // --- 3 Welt ------------------------------------------------------------
  enter('welt-1', 3, 'Die Prophetin', 'Die Welt. Von hier sehen die Gebiete aus wie Zellen. Sie füllen sich. Sie gehören uns.'),
  enter('welt-2', 3, 'Der Buchhalter', 'Zur Erinnerung: angefangen haben wir im Badezimmer. Ich führe darüber Buch.'),
  unit('welt-3', 3, 'sell', 2, 'Der Buchhalter', 'Ein Kartellchef. Er stellt Straßenbosse ein, die Dealer einstellen. Das Organigramm ist inzwischen zwei Seiten lang.'),
  room('welt-4', 3, 7, 'Kevin', 'Ein Gewächshaus. Weit, satt, grün. Frag nicht, was darin wächst. Es wächst.'),
  enter('welt-5', 3, 'Kevin', 'Wenn wir die Welt beliefern, kriegen wir dann so eine Flagge?'),

  // --- 4 Erdorbit --------------------------------------------------------
  enter('orbit-1', 4, 'Kevin', 'Wir sind im Weltraum. WIR SIND IM WELTRAUM. Entschuldigung. Ich bin wieder ruhig.'),
  enter('orbit-2', 4, 'Der Buchhalter', 'Die Erde ist voll. Das war absehbar. Der Rest liegt oben.'),
  enter('orbit-3', 4, 'Die Prophetin', 'Von hier oben ist die Erde ein einziger Kunde. Ein müder, gut belieferter Kunde.'),
  room('orbit-4', 4, 8, 'Die Prophetin', 'Ein Frachtschiff. Das Meer gehört niemandem. Das Meer gehört jetzt uns.'),

  // --- 5 Mond & Mars -----------------------------------------------------
  enter('moon-1', 5, 'Der Buchhalter', 'Der Mond hat Fläche. Sehr viel Fläche. Und keine Behörde. Ich bin fast gerührt.'),
  enter('moon-2', 5, 'Kevin', 'Auf dem Mars wohnen zwölf Leute. Zwölf! Die müssen wir ALLE erwischen.'),
  enter('moon-3', 5, 'Die Prophetin', 'Zwölf sind zwölf. Wir haben mit dreien angefangen, und zwei davon waren wir.'),
  unit('moon-4', 5, 'cook', 2, 'Der Buchhalter', 'Ein Chemiker. Er stellt Köche ein. Niemand in dieser Kette kocht noch selbst, das ist mir aufgefallen.'),

  // --- 6 Äußeres System --------------------------------------------------
  enter('outer-1', 6, 'Der Buchhalter', 'Die Lieferfrist zum Asteroidengürtel liegt bei elf Monaten. Ein ganz normales Problem. Ich habe es im Griff.'),
  enter('outer-2', 6, 'Kevin', 'Ich hab den Asteroiden Namen gegeben. Der große da heißt Kevin. Nach mir.'),
  enter('outer-3', 6, 'Die Prophetin', 'Noch ein Mond. Noch ein Ring. Noch einer. Wir sind so nah.'),
  room('outer-4', 6, 12, 'Kevin', 'Eine Orbitalstation. Die dreht sich, damit die Junkies nicht wegschweben. Daran hat jemand gedacht.'),

  // --- 7 Interstellar (Ende) ---------------------------------------------
  enter('inter-1', 7, 'Die Prophetin', 'Andere Sterne. Andere Kunden. Es hört nicht auf.'),
  enter('inter-2', 7, 'Der Buchhalter', 'Doch. Genau hier hört es auf. Danach gibt es niemanden mehr.'),
  on('inter-3', 7, 'finished', 'Die Prophetin', 'Das war der letzte. Es gibt keinen mehr. Wir sind... zufrieden.'),
  on('inter-4', 7, 'finished', 'Kevin', 'Und was machen wir jetzt?'),
  on('inter-5', 7, 'finished', 'Der Buchhalter', 'Nichts. Zum ersten Mal stimmen die Bücher. Fass nichts an.'),
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
  private seenRooms = new Set<number>();
  private seenUnits = new Set<string>();
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
    if (event.type === 'roomBought') {
      if (this.seenRooms.has(event.tier)) return;
      this.seenRooms.add(event.tier);
      this.fire(l => l.cue.on === 'room' && l.cue.tier === event.tier);
      return;
    }
    if (event.type === 'unitBought') {
      const key = `${event.chain}${event.tier}`;
      if (this.seenUnits.has(key)) return;
      this.seenUnits.add(key);
      this.fire(l => l.cue.on === 'unit' && l.cue.chain === event.chain && l.cue.tier === event.tier);
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
