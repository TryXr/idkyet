# Projekt: 2D Incremental Game

Status: Konzeptphase, noch kein Code. Stack-Empfehlung: TypeScript + Vite, Rendering
via PixiJS (oder Canvas 2D bei einfachem Scope). Spiellogik strikt vom Rendering
getrennt, fixer Timestep für den Tick.

## Leitprinzip: simpel wie genial

Vom Nutzer am 2026-08-25 als oberste Vorgabe gesetzt. Operativ heißt das:

- WENIGE REGELN, DIE SICH MULTIPLIZIEREN. Ziel sind zwei bis drei Grundregeln,
  aus denen Entscheidungen entstehen, die man nicht im Kopf ausrechnen kann.
  Tiefe kommt aus dem Zusammenspiel, nicht aus der Anzahl der Systeme.
- Das Spiel muss sich in EINEM SATZ erklären lassen.
- Emergenz statt Skriptung: interessante Muster sollen aus der Simulation
  entstehen, nicht handgebaut werden.
- Im Zweifel STREICHEN. Jede zusätzliche Währung, jedes zusätzliche Menü muss
  sich gegen dieses Prinzip rechtfertigen. Richtwert: max. 2 Währungen.
- Kein Feature, das nur da ist, weil "Incremental Games das halt so machen".

## Verbindliche Design-Grundlagen

Diese Regeln stammen aus einer Recherche zum Genre (Quellen unten) und gelten für
alle Design- und Implementierungsentscheidungen in diesem Projekt.

### Mathematischer Kern

Kosten wachsen exponentiell, Produktion nur linear/polynomial. Das ist der Motor
des Genres, kein Balancing-Fehler.

    cost(n) = base_cost * growth^n        // growth typisch 1.07 - 1.15
    output  = base * count * multiplier   // linear in count

Exponentielles Wachstum überholt polynomiales immer -> der Spieler läuft
zwangsläufig in eine Wand -> Prestige ist das Ventil.

### Rhythmus statt gleichmäßiger Verlangsamung

Meilenstein-Multiplikatoren einbauen (Vorbild AdVenture Capitalist: x2 bei 25, 50,
100 Einheiten). Erzeugt Schübe schneller Käufe im Wechsel mit ruhigen Phasen.
Diese Rhythmisierung ist wichtiger als die exakte Kurve.

### Prestige (Genre-Referenz - fuer v1 NICHT verwendet, siehe unten)

(Gilt fuer das Genre allgemein. In v1 kein Prestige - siehe Abschnitt Balancing.)
Prestige-Währung als Wurzel der Lifetime-Einnahmen. Der Exponent ist die zentrale
Pacing-Stellschraube:

| Vorbild                  | Formel   | Für Verdopplung nötig |
|--------------------------|----------|-----------------------|
| AdCap / Realm Grinder    | sqrt     | 4x                    |
| Cookie Clicker           | cbrt     | 8x                    |
| Egg, Inc.                | x^(1/7)  | 128x                  |

Flacher = seltenere, längere Runs. Steiler = schnelle Reset-Zyklen.
Mehrere Prestige-Ebenen nur, wenn jede Ebene NEUE MECHANIK bringt, nicht bloß
einen weiteren Multiplikator.

### Was Spieler wirklich hält

Entdeckung, nicht Zahlen. Ständig neue Systeme aufklappen lassen (Vorbild:
Universal Paperclips, Candy Box). Ein Spiel, das nach 20 Minuten alle Mechaniken
gezeigt hat, ist tot.

### Harte Regeln gegen die häufigsten Genrefehler

1. ENDE EINPLANEN. Endlose Verlangsamung ohne Ziel ist der meistgenannte
   Kritikpunkt. Für diesen ersten Wurf: klares Ende nach ca. 5-8 Stunden.
2. Erstes Upgrade innerhalb von SEKUNDEN erreichbar, nicht Minuten.
3. Scope und Deadline vorab festlegen. Fehlende Frist ist laut Postmortems der
   teuerste Fehler im Genre.
4. Thema und Mechanik müssen zusammenpassen (Prestige muss thematisch begründet
   sein, nicht aufgesetzt).
5. Systeme bevorzugen, die Content selbst generieren, statt handgebauten Content.

### Pflicht-Features (von Anfang an, nicht nachrüsten)

- Offline-Progress: `rate * min(elapsed, cap)`, Timestamp beim Speichern.
- Große Zahlen: eigene Zahlenklasse oder BigInt ab Tag 1 (Number bricht bei 1e308).
- Anzeige "Zeit bis zum nächsten Kauf", Max-Buy-Button.
- Save/Load mit Versionsnummer für Migrationen.
- Kein Fail-State, ständiges Feedback.

### Prozess

- Balancing zuerst als Tabelle/Modell durchrechnen, DANN implementieren.
- Konsolen-/Headless-Prototyp vor UI erzwingt saubere Trennung.
- Früh in r/incremental_games testen lassen.

## Konzept (neu gefasst am 2026-08-26)

Thema: Drogenhandel-Ökonomie. Kein Pilz-Thema (verworfen).

Produktion bleibt abstrakt: Ertrag und Durchsatz sind Zahlen und
Balancing-Parameter. Keine reale Chemie, keine Syntheseanleitungen im Spiel,
in den Texten oder im Code.

WICHTIG: Dieses Konzept ersetzt das ursprüngliche Marktmodell (Preisverfall,
Hitze, Marktsperren, Statthalter-Politiken). Der Stand davon liegt als Tag
`v1-marktmodell` im Repo. Warum der Wechsel: dort war jeder Fortschritt nur
geliehen — ein bedienter Markt brannte aus und zwang zum Weiterziehen. Das neue
Modell BEHÄLT Fortschritt: ein versorgtes Gebiet gehört dir und zahlt dauerhaft.
Das ist das befriedigendere Gefühl und der klassische Genre-Motor.

### Kernsatz

Du kochst, du verkaufst, du übernimmst — Stadt für Stadt, bis dir die Welt
gehört.

### Drei Grundregeln

1. KOCHEN: Arbeiter machen in deinen Räumen Ware. Der Raum bestimmt die
   Qualität (Badezimmer wenig, Labor viel), der Arbeiter die Menge.
2. VERKAUFEN: Verkäufer setzen die Ware in einem Gebiet ab. Das füllt dort den
   Versorgungsbalken und bringt Bargeld.
3. ÜBERNEHMEN: Ein Gebiet bei 100 % gehört dir für immer und zahlt ab da
   passiv — jedes unterschiedlich viel. Sind alle Gebiete einer Ebene deins,
   zoomt die Karte heraus und die nächstgrößere Ebene liegt offen.

Alles Weitere folgt daraus. Es gibt keine vierte Regel.

### Die beiden Knöpfe und wie sie verschwinden

Zu Beginn drückt der Spieler selbst: ein Knopf kocht eine Portion, ein zweiter
verkauft sie. Beide Knöpfe werden im Lauf des Spiels von Helfern übernommen —
das ist der eigentliche Fortschritt, nicht die Zahl auf dem Konto.

ZWEI KETTEN, denn Kochen und Verkaufen sind zwei verschiedene Engpässe:

    KOCHEN     Junkie   -> macht Ware
               Koch     -> stellt Junkies ein
               Chemiker -> stellt Köche ein

    VERKAUFEN  Dealer       -> verkauft Ware
               Straßenboss  -> stellt Dealer ein
               Kartellchef  -> stellt Straßenbosse ein

Jede Stufe erzeugt die Stufe DARUNTER, nicht Ware direkt. Dadurch wächst die
Produktion polynomial (die zweite Stufe ist die Ableitung der ersten), während
die Kosten exponentiell steigen — genau der Motor aus dem Abschnitt
"Mathematischer Kern". Und es erklärt sich von selbst: ein Kartellchef kocht
nichts, er stellt Leute ein.

Der Spieler sieht dadurch immer, welche Hälfte klemmt: Lager voll heißt zu
wenig Verkäufer, Lager leer heißt zu wenig Arbeiter.

### Räume und Arbeiter

Arbeiter brauchen einen Platz. Räume (Badezimmer, Garage, Wohnwagen, Keller,
Lagerhalle … bis Labor und Raffinerie) bieten PLÄTZE und bestimmen die
QUALITÄT, also den Ertrag je Arbeiter.

Zuteilung passiert automatisch und immer in den besten freien Raum — der
Spieler soll nicht Leute auf Zimmer verteilen. Die einzige Entscheidung ist
"mehr Räume oder mehr Arbeiter?", und die stellt sich von allein: zu viele
Arbeiter stehen sichtbar herum, zu viele Räume stehen leer.

QUALITÄT IST KEIN EIGENER HEBEL. Sie steckt im Raum, ist eine Zahl im
Ertrag und hat kein eigenes Menü (entschieden am 2026-08-26, dieselbe
Begründung wie beim gestrichenen Reinheits-System).

### Gebiete, Versorgung und Übernahme

Jedes Gebiet hat drei Zahlen: BEDARF (wie viel Ware bis 100 %), PREIS je Ware
und RENTE (was es nach der Übernahme dauerhaft zahlt). Alle drei streuen stark —
Duisburg ist nicht Düsseldorf.

Verkaufte Ware füllt den Versorgungsbalken. Bei 100 % ist das Gebiet
übernommen: der Balken bleibt voll, es zahlt ab sofort seine Rente und ist als
Absatzmarkt erledigt. Kein Rückfall, keine Vernachlässigung, kein Verfall — was
dir gehört, bleibt dir.

Daraus entsteht die Zielwahl von selbst: Ein großes Gebiet zahlt mehr Rente,
braucht aber lange; ein kleines ist schnell deins. Wer klug wählt, kommt
schneller voran — ohne dass eine Regel dafür nötig wäre.

### Ebenen: echte Orte, herauszoomende Karte

Gespielt wird auf EINER durchgehenden Karte mit rund 15 Gebieten je Ebene.
Sind alle übernommen, zoomt sie heraus, und dieselben Regeln gelten für die
nächstgrößere Einheit. Selbstähnlich, ein Code-Pfad für Straßenzug bis Sternbild.

    0  Ruhrgebiet          Duisburg, Oberhausen, Essen, Dortmund …
    1  Deutschland         Köln, Hamburg, München, Berlin …
    2  Europa              Niederlande, Italien, Polen, Spanien …
    3  Welt                Nordamerika, Ostasien, Westafrika …
    4  Erdorbit            Bahnen und Stationen
    5  Mond & Mars         Siedlungen
    6  Äußeres System      Ganymed, Titan, Ceres …
    7  Interstellar        Proxima Centauri, Wolf 359, Trappist-1 …

Start ist Duisburg. Echte Namen, weil der Witz in der Beiläufigkeit sitzt: die
Lieferfrist nach Ganymed wird genauso sachlich besprochen wie die nach Essen.
Die Namenslisten sind handgeschrieben (rund 120 Einträge), aber es sind Listen,
kein Fließtext — der Deckel für Stimmen-Texte gilt davon unberührt.

### Idle vs. aktiv

Grundmodus ist Idlen. Aktives Spiel lohnt sich durch die ZIELWAHL: Der Spieler
bestimmt, welches Gebiet gerade beliefert wird. Der Autopilot nimmt stur das
nächstbeste; wer selbst wählt, nimmt das mit dem besten Verhältnis aus Bedarf
und Rente. Kein Zusatzsystem, nur eine Folge von Regel 3.

Zielwert wie bisher: aktiv ca. 1.5 bis 2x Idle-Rate.

### Was aus dem alten Konzept bleibt

- Eine Währung (Bargeld) plus Ware als Ressource. Kein Prestige.
- Lager mit Obergrenze: läuft es über, stockt die Produktion (kein Verlust).
- Offline-Fortschritt, Cap 8 h.
- Klares Ende: alles übernommen, die Stimmen sind zufrieden, Schlussbilanz.
- Ton, Stimmen und Figuren (Buchhalter, Prophetin, Kevin) unverändert.
- Spiellänge 5-8 h.

### Was ersatzlos gestrichen ist

- Preisverfall und Preiserholung je Markt (kP, rP, gamma).
- Hitze und Marktsperren.
- Statthalter-Politiken S0-S3 (ersetzt durch die beiden Helfer-Ketten).
- Land als Parzellen-Fläche (ersetzt durch Plätze in Räumen).

### Story, Ton & Ende (entschieden am 2026-08-25)

GRUNDTON: KOMÖDIE. Vom Nutzer ausdrücklich festgelegt. Das Spiel ist überdreht
und albern, nicht düster und nicht realistisch.

Die Hauptfigur IST VERRÜCKT und HÖRT STIMMEN, die ihr befehlen, jeden zu
beliefern, den es gibt. Das ist ausdrücklich so gemeint, nicht mehrdeutig.
Erst wenn wirklich jeder beliefert ist, sind die Stimmen zufrieden - das ist das
Ende.

Warum das trägt: Die mechanische Zwangslage (jeder Markt brennt aus, also musst
du weiter) und die erzählerische (die Stimmen wollen mehr) sind DIESELBE SACHE
aus zwei Richtungen. Kein aufgesetzter Plot, sondern eine Deutung der Regeln.

Umsetzung:
- Die Stimmen sind ERZÄHLSCHICHT, TUTORIAL UND WITZMOTOR zugleich. Neue
  Mechaniken werden von ihnen angekündigt statt von einem Tutorial-Kasten.
  Ein System, drei Funktionen - wie Karte = Markt + Territorium.
- Die Stimmen sind FIGUREN, keine bedrohliche Präsenz. Sie widersprechen sich,
  haben Lieblingsthemen, sind mal beleidigt, mal begeistert. Streit unter den
  Stimmen ist die ergiebigste Witzquelle und kostet nichts.
- ESKALATION INS ABSURDE, nicht ins Bedrohliche: anfangs nörgeln sie wegen der
  Nachbarn, am Ende reden sie über Lieferfristen zum Asteroidengürtel, als wäre
  das eine völlig normale Sorge.
- Die Herstellorte sind selbst schon die Gag-Kurve: Badezimmer -> Wohnwagen ->
  Mondbasis -> Asteroiden. Die Reihe trägt den Humor, ohne dass Text nötig ist.
- Komödie hält das Thema automatisch von grimmigem Realismus fern. Kein Elend,
  keine Opfer, keine Chemie - die Ware ist eine abstrakte Zahl und bleibt es.
- UI-Texte und Ortsnamen tragen denselben Ton. Der Witz sitzt in der Beiläufig-
  keit, nicht in Ausrufezeichen.
- SCOPE-GRENZE: maximal 5 Zeilen pro Zoomstufe, also ca. 70 Zeilen insgesamt.
  Handgeschriebener Text ist der einzige Inhalt im Spiel, der nicht generiert
  wird - deshalb hart deckeln. Lieber 40 gute Zeilen als 70 mittelmäßige.

ENDE: Vollständige Sättigung. Jeder Knoten beliefert, kein Markt mehr offen.
Die Stimmen sind zum ersten Mal zufrieden - und wissen dann nichts mehr mit sich
anzufangen. Pointe statt Pathos. Das Spiel rechnet vor, was gebaut wurde,
Schluss.

### Weitere Festlegungen (Stand 2026-08-26)

ERSTE 60 SEKUNDEN: Start mit einem Badezimmer, einem Junkie und Duisburg als
erstem Gebiet. Der Spieler drueckt beide Knoepfe selbst - kochen, verkaufen,
kochen, verkaufen. Nach wenigen Klicks reicht es fuer den zweiten Junkie, nach
rund einer Minute fuer den ersten Dealer, und ab da verkauft es sich von selbst.
Der erste Koch (der Junkies einstellt) beendet auch das Kochen von Hand.
Klicken ist TUTORIAL, kein Dauerzustand - und der Spieler versteht die Helfer,
weil er ihre Arbeit vorher selbst gemacht hat.

LAGER: Fester Bestand mit Obergrenze. Laeuft es ueber, STOCKT DIE PRODUKTION -
kein Verlust, nur Stillstand. Es ist zugleich die Anzeige, welche Kette klemmt:
volles Lager heisst zu wenig Verkaeufer, leeres Lager zu wenig Arbeiter.
Lagerausbau ist die dritte Kaufoption neben Raeumen und Helfern.

ZWEI ACHSEN, die sich gegenseitig blockieren:
  RAEUME + ARBEITER = WIE VIEL DU HAST
  VERKAEUFER        = WIE VIEL DAVON ANKOMMT
Produktion ohne Verkauf laeuft ins volle Lager, Verkauf ohne Produktion steht
still. Daraus entsteht das Wechselspiel - ohne dass eine Regel es vorschreibt.

OFFLINE-CAP: 8 h (entspricht der Spiellaenge).

### Technische Festlegungen

- Zahlen: break_infinity.js (Genre-Standard, > 1e308, schneller als BigInt).
- Rendering: PixiJS fuer die Karte, normales DOM fuer Zahlen/Listen/Menues.
- Gebiete: Namen aus handgeschriebenen Listen, Zahlen (Bedarf, Preis, Rente)
  prozedural aus einem Seed. Die Liste gibt das Thema, der Seed die Streuung.

### Balancing

Zahlen und Begruendungen in BALANCING.md. Kein Prestige (entschieden am
2026-08-25 und weiter gueltig): die Simulation zeigte jede Prestige-Variante
langsamer als den Einzeldurchlauf, weil die Grundkurve flach ist und jeder
Reset Zeit kostet, die der Multiplikator nicht hereinholt. v1 ist EIN Durchlauf
mit klarem Ende. Nachruestung spaeter nur als optionales New Game+.

## Veröffentlichung (entschieden am 2026-08-25)

Ziel ist eine Steam-Veröffentlichung. Zuerst gebaut wird aber eine WEB-APP.
Der Web-Build ist die Basis, der Steam-Build ein Wrapper darum.

### Architektur-Regeln, damit der Steam-Port später schmerzfrei bleibt

Diese Punkte kosten jetzt fast nichts und sind später teuer nachzurüsten:

1. KEIN BACKEND. Die komplette Simulation läuft im Client. Kein Server, keine
   Accounts, keine Online-Pflicht. Steam-Spieler spielen offline.
2. SPEICHERN HINTER EINER SCHNITTSTELLE (StorageAdapter). Web: localStorage.
   Desktop: Datei. Später optional Steam Cloud. Nie direkt localStorage im
   Spielcode aufrufen.
3. KEINE EXTERNEN CDN-ABHÄNGIGKEITEN. Alles wird mitgebündelt, sonst startet der
   Desktop-Build offline nicht.
4. ERFOLGE ALS EVENTS. Die Simulation feuert benannte Events; eine dünne Schicht
   hört zu. Web ignoriert sie, Steam-Build meldet sie an Steamworks. Erfolge
   niemals im UI-Code verstreuen.
5. UI RESPONSIV von Anfang an - Browserfenster UND 1920x1080 Vollbild.
6. FIXER TIMESTEP, DETERMINISTISCHE SIM. Nötig für Offline-Progress und dafür,
   dass Balancing headless testbar bleibt.

### Wrapper-Entscheidung (später, aber Richtung steht)

Electron + steamworks.js ist der bestdokumentierte Weg für genau diesen Fall
(Web-Spiel als Steam-Titel, inkl. Erfolge und Cloud). Tauri ist schlanker, für
Steamworks aber weniger ausgetreten. Entscheidung fällt erst nach dem Prototyp -
durch Regel 1 bis 3 oben bleibt sie offen.

### Steam-Rahmenbedingungen

- Steam Direct: 100 USD einmalig pro App, wird ab 1000 USD Umsatz gutgeschrieben.
- Nach Zahlung 30 Tage Wartezeit vor Release. Nicht verkürzbar, einplanen.

### Strategische Warnung: Web-Version nicht das ganze Spiel

Wenn das vollständige Spiel gratis im Browser liegt, untergräbt das den
Steam-Verkauf. Web-Build deshalb als DEMO/Marketing behandeln (erste ein bis
zwei Stunden oder älterer Stand), Steam-Build als Vollversion mit Mehrwert
(Erfolge, Cloud-Saves, Endgame-Inhalte).

Konsequenz für den Code: von Anfang an ein Build-Flag, das Inhalte abschneidet.
Nachträglich ein Spiel in Demo und Vollversion zu trennen ist Handarbeit.

Der Web-Build dient gleichzeitig dem Playtest (itch.io, r/incremental_games) und
sammelt Wunschlisten-Einträge vor dem Steam-Release.

## Quellen

- https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- https://github.com/ac2522/IdleFramework/blob/main/IDLE_GAME_MECHANICS_RESEARCH.md
- https://www.gamedeveloper.com/design/lessons-of-my-first-incremental-game
- https://kastark.co.uk/articles/incrementals.html
- https://en.wikipedia.org/wiki/Incremental_game
- https://github.com/ceifa/steamworks.js/
- https://www.overactiongamestudio.com/tutorials/18-developing-and-publishing-a-web-game-on-steam-with-electronjs-steamworks-js
