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

## Konzept (entschieden am 2026-08-25)

Thema: Drogenhandel-Ökonomie, Vorbild Dr. Meth. Kein Pilz-Thema (verworfen).

Produktion bleibt abstrakt: Ertrag und Durchsatz sind Zahlen und
Balancing-Parameter. Keine reale Chemie, keine Syntheseanleitungen im Spiel,
in den Texten oder im Code.

### Kernsatz

Jeder Markt, den du bedienst, brennt aus - also musst du immer weiter.

### Drei Grundregeln

1. PRODUZIEREN: Herstellorte liefern Ware/Sekunde.
2. VERKAUFEN: Verkauf in einem Markt senkt dort den Preis und hebt die Hitze.
   Beides erholt sich nur, solange dieser Markt in Ruhe gelassen wird.
3. EXPANDIEREN: Frische Märkte sind unverbrannt, aber weiter weg
   (teurer/riskanter im Transport).

Die Expansion ist damit KEIN Menüpunkt, sondern Folge von Regel 2.

### Maßstab: fließend, nicht in Kapiteln

Vom Nutzer am 2026-08-25 korrigiert: Stadt/Land/Kontinent waren nur Beispiele.
Es soll ein FLIESSENDER Übergang mit MEHR Stufen sein, keine 5 harten Akte.

Umsetzung: EINE durchgehende Karte, die mit wachsender Reichweite kontinuierlich
herauszoomt. Märkte sind ein Baum aus Knoten; jeder Knoten verhält sich nach
denselben Regeln (Nachfrage, Preis, Hitze, Erholung) - nur das Label ändert sich.
Selbstähnlich, dadurch ein einziger Code-Pfad für Straßenecke bis Sonnensystem.
Kein Level-Up-Screen, die Kamera zoomt einfach weiter raus.

Stufenentwurf (~13, je ca. 25-40 min -> 5-8 h gesamt):
Straßenecke, Block, Stadt, Ballungsraum, Region, Land, Nachbarländer,
Kontinent, Hemisphäre, Welt, Orbit, Mond/Mars, äußeres System, interstellar (Ende).

Neue Mechaniken werden über diese Stufen VERTEILT eingeführt (ca. alle 2 Stufen
eine), nicht in großen Kapitelblöcken.

### Idle vs. aktiv

Vom Nutzer am 2026-08-25 festgelegt: Grundmodus ist Idlen, aber aktives Spielen
soll sich lohnen.

Lösung ohne Zusatzsystem: Automatisierung ist eine POLITIK, und die
Standard-Politik ist bewusst mittelmäßig (z. B. "gleichmäßig überall verkaufen").
Ein aufmerksamer Spieler rotiert Märkte im richtigen Moment und schlägt den
Autopiloten. Upgrades verbessern die Auto-Politik, schließen die Lücke aber nie
ganz.

Zielwert: aktiv ca. 2x Idle-Rate. Genug, dass es sich lohnt; wenig genug, dass
Idlen nicht wie Bestrafung wirkt.

### Land & Fläche (ergänzt am 2026-08-25)

Vom Nutzer gefordert: Mit Geld wird LAND gekauft, um Herstellorte zu bauen.
Orte verbrauchen unterschiedlich viel Geld UND Fläche. Land ist ENDLICH -
irgendwann gehört einem die Welt zu 100%.

Fläche ist KEINE dritte Währung, sondern eine Kapazität, die mit Bargeld gekauft
wird. v1 hat GENAU EINE Währung: Bargeld.

Doppelnutzung der Karte (wichtig fürs Leitprinzip): Dieselben Baumknoten sind
Markt UND Territorium. Ein gekaufter Knoten liefert Baufläche und senkt dort
zusätzlich die Hitze. Ein Kauf, zwei Wirkungen, keine neue Struktur.

Landpreis steigt mit der Knappheit (Preis pro Knoten wächst exponentiell mit der
Zahl der bereits gekauften). Knotenzahl ist endlich -> 100% ist erreichbar, aber
die letzten Prozent sind teuer. 100% Erde = großer Meilenstein, NICHT das Ende.

Zentrale Design-Spannung: früh ist Land billig und Geld knapp -> man optimiert
ERTRAG PRO GELD (flächenfressende, billige Orte). Spät ist Land aus -> man
optimiert ERTRAG PRO FLÄCHE und muss verdichten. Die optimale Baureihenfolge
kippt im Spielverlauf. Das entsteht aus der Regel, ist nicht geskriptet.

Das Flächenlimit ist der GRUND fürs Weltall-Endgame: See, Untergrund, Orbit und
Mond sind Ausweichventile, die neue Flächen-Pools öffnen, wenn die Erde voll ist.

Herstellorte (Entwurf, 15 Stück, aufsteigend):
 1  Badezimmer          winzige Fläche, trivialer Preis, lächerlicher Ertrag (Start)
 2  Garage/Hinterzimmer sehr klein, billig
 3  Wohnwagen           klein, MOBIL - kann umziehen, Hitze bleibt zurück
 4  Kellergeschoss      klein, mittel - dicht, gut bei Platzmangel
 5  Lagerhalle          mittel/mittel - Brot und Butter
 6  Gewerbepark         mittel, mittel-hoch
 7  Stillgelegte Fabrik groß, mittel - billig pro Fläche
 8  Farm/Gewächshaus    sehr groß, billig pro Fläche - max. Ertrag pro Geld
 9  Frachtschiff        auf See - braucht KEINE Landfläche, teuer
10  Bergwerk/Bunker     unterirdisch - wenig Oberfläche, teuer
11  Pharmawerk (getarnt) groß, sehr teuer, niedrige Hitze
12  Raffinerie-Komplex  riesig, sehr teuer - Endstufe auf der Erde
13  Orbitalstation      keine Erdfläche, extrem teuer
14  Mondbasis           öffnet neuen Flächen-Pool
15  Asteroiden-Cluster  riesige Fläche, Endgame

GESTRICHEN: Reinheit als eigener Hebel. Redundant zum Ertrags-Multiplikator und
verstößt gegen "im Zweifel streichen". Ertrag bleibt eine Zahl.

### Entschieden am 2026-08-25 (Runde 2)

HITZE-MAXIMUM: Der Markt SPERRT SICH ZEITWEISE. Kein Verkauf mehr in diesem
Knoten, die Hitze kühlt langsam ab, danach ist er wieder nutzbar. Kein Verlust
von Besitz oder Bauten -> verträgt sich mit "kein Fail-State", erzeugt aber genau
den Ausweichdruck, der die Expansion antreibt.

AKTIVER HANDGRIFF: Der Spieler schaltet Gebiete AN und AUS. Ein abgeschalteter
Knoten kühlt ab und erholt sich im Preis. Der Autopilot verkauft stur überall
gleichmäßig und läuft dabei in Sperren; ein wacher Spieler rotiert vorher.
Das ist die gesamte aktive Interaktion - kein Zusatzsystem, nur eine Folge der
drei Grundregeln.

KNOTEN-AGGREGATION: Der Spieler verwaltet immer nur die ca. 15 Knoten seiner
aktuellen Zoomstufe. Alles Feinere klappt in den Elternknoten zusammen und läuft
automatisch mit der Standard-Politik. Dadurch bleibt die Bedienung auf jeder
Größenordnung gleich simpel, und Automatisierung ist mechanisch begründet statt
nur bequem.

SCOPE & DEADLINE: Spielbarer Prototyp (Simulation + minimale UI, ohne Art) in
4-6 Wochen, Zieldatum 2026-10-06. Zwischenziel 2026-09-15: Headless-Sim mit
Balancing durchspielbar.

### Technische Festlegungen

- Zahlen: break_infinity.js (Genre-Standard, > 1e308, schneller als BigInt für
  Fließkomma-Raten).
- Rendering: PixiJS für die Karte, normales DOM für Zahlen/Listen/Menüs.
- Knotenbaum: prozedural aus einem Seed erzeugt, nicht handgebaut.

### Balancing

Durchgerechnet, Zahlen und Begründungen in BALANCING.md. Kernergebnis:
Spiellänge 6.9 h (aktiv) bis 7.9 h (roh geidlet), 14 Stufen à ~16 min.

ENTSCHIEDEN am 2026-08-25: PRESTIGE IST GESTRICHEN. Die Simulation zeigte alle
Prestige-Varianten langsamer als den Einzeldurchlauf (19.5 h statt 6.9 h), weil
die Grundkurve bereits flach ist und jeder Reset Zeit kostet, die der
Multiplikator nicht hereinholt. v1 ist EIN Durchlauf mit klarem Ende und GENAU
EINER Währung (Bargeld). Die Prestige-Abschnitte weiter oben bleiben als
Genre-Referenz stehen, gelten aber nicht für v1. Nachrüstung später nur als
optionales New Game+, nie als Pflichtschleife.
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

### Weitere Festlegungen vom 2026-08-25

ERSTE 60 SEKUNDEN: Start mit einem Badezimmer und einer Parzelle. Der Spieler
verkauft VON HAND - ein Klick je Portion, Zielknoten frei wählbar. Nach ca. 15 s
reicht es für die nächste Charge, nach ca. 60 s für die Garage. Der erste
Statthalter (S0, der dumme) ist das dritte oder vierte Upgrade und beendet das
Klicken dauerhaft.
Klicken ist damit TUTORIAL, kein Dauerzustand - und der Spieler versteht den
Autopiloten, weil er es vorher selbst besser gemacht hat.

LAGER: Fester Bestand mit Obergrenze. Läuft es über, STOCKT DIE PRODUKTION -
kein Verlust, nur Stillstand. Erzeugt Druck (Absatz schaffen oder Lager
ausbauen), ohne zu bestrafen. Lagerausbau ist die dritte Kaufoption neben
Herstellorten und Land. Notwendig, weil der gute Statthalter Ware zurückhält,
statt Märkte zu fluten.

LAND vs. ZOOMSTUFE - sauber getrennt:
  LAND      = WO DU PRODUZIERST (Fläche für Herstellorte)
  ZOOMSTUFE = WO DU VERKAUFST   (Reichweite, neue Märkte)
Zwei Achsen, die sich gegenseitig blockieren: Produktion ohne Reichweite flutet
die Märkte, Reichweite ohne Produktion bleibt ungenutzt. Genau daraus entsteht
das Wechselspiel, das die Simulation gezeigt hat.

OFFLINE-CAP: 8 h (entspricht der Spiellänge).

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
