# Warum es sich leer anfuehlt - und was dagegen hilft

Aufgenommen am 2026-08-26, nachdem das Gebietsmodell komplett durchlief und
sich trotzdem repetitiv anfuehlte. Grundlage: Recherche zu Universal Paperclips,
Kittens Game, Antimatter Dimensions, Cookie Clicker, AdVenture Capitalist,
Dr. Meth und den Design-Aufsaetzen des Genres (Quellen am Ende).

Nachtrag vom selben Tag: das Thema wurde auf WEED umgestellt und die Ernte
bekommt eine zweite Verwendung. Beides steht in CLAUDE.md, die Begruendung in
Abschnitt 2a und E1 hier. Der Befund in Abschnitt 1 ist davon unberuehrt - er
beschreibt das Modell, nicht das Thema.

STAND 2026-08-27: Schritt 0 (Thema) und Schritt 1 (E1, Pflanzen-Kreislauf und
Betriebskosten) sind GEBAUT und durchgemessen. Was dabei herauskam - auch das,
was nicht aufging - steht in BALANCING.md. E2, E3 und E4 stehen noch aus.

Dieses Dokument ergaenzt CLAUDE.md, es ersetzt es nicht.


## 1. Befund: das Spiel trifft seine eigenen Ziele nicht

Sieben Punkte, alle mit Zahlen aus dem eigenen Messlauf belegbar.

### 1.1 Aktives Spiel lohnt sich praktisch nicht

CLAUDE.md fordert: "aktiv ca. 1.5 bis 2x Idle-Rate". Gemessen wurde 5.24 h
gegen 5.60 h - Faktor 1.07. Der Unterschied zwischen aufmerksamem Spiel und
Weggucken liegt bei 7 %, also unter der Wahrnehmungsschwelle. Das Spiel spielt
sich selbst, und der Spieler merkt es.

Ursache: die Zielwahl ist die EINZIGE Entscheidung, und sie beeinflusst nur,
in welcher REIHENFOLGE dieselben 15 Gebiete fallen. Da am Ende jedes Gebiet
uebernommen sein muss, kann die Reihenfolge nur die Zinseszinsen der Rente
verschieben. Mehr als ein paar Prozent kann dabei nicht herauskommen - das ist
strukturell so, kein Balancing-Problem.

### 1.2 Die zwei Ketten sind keine Entscheidung, sondern ein Thermostat

    durchsatz = min(produktion, absatz)

Ein Minimum aus zwei Zahlen erzeugt keine Abwaegung, sondern eine Anweisung:
kauf immer die kleinere Seite. Der Lagerbalken sagt sogar, welche das ist.
Das ist per Definition keine Optimierung, sondern eine Regelung - und ein
Spieler, der eine Regel ausfuehrt, langweilt sich, egal wie huebsch sie ist.

Die Quellen sind hier einig: Tiefe entsteht aus OPTIMIERUNGSPROBLEMEN mit
konkurrierenden Anspruechen auf dieselbe Ressource (Kittens Game: Kitten
fressen Catnip; Paperclips: Draht kostet das Geld, das die Klammern bringen).
Bei uns konkurriert nichts mit nichts: alles kostet Bargeld, und Bargeld kommt
aus allem.

### 1.3 Nichts drueckt zurueck

Mit dem Marktmodell sind Hitze und Marktsperren gestrichen worden - und mit
ihnen die einzige Gegenkraft im Spiel. Jetzt gilt: kein Risiko, kein Verlust,
kein Zeitdruck, keine Konkurrenz. "Kein Fail-State" (richtig) wurde als "nichts
geht je schief" gelesen (falsch). Ohne Gegenkraft ist jede Entscheidung
folgenlos, und folgenlose Entscheidungen fuehlen sich nach Verwaltung an.

### 1.4 Keine Entfaltung - der teuerste Punkt

Alle Quellen nennen dasselbe als Hauptgrund, warum Spieler dranbleiben:
UNFOLDING, das regelmaessige Aufklappen neuer Regeln. Paperclips wechselt
mehrfach komplett das Spiel (Klammern -> Boersenhandel -> Sonden -> Krieg),
Antimatter Dimensions aendert in Challenges die Regeln und belohnt mit
Automatisierung, Kittens Game legt alle paar Minuten ein neues System offen.

Unser Modell tut ausdruecklich das Gegenteil: "Selbstaehnlich, ein Code-Pfad
fuer Strassenzug bis Sternbild". Das ist technisch elegant und spielerisch der
Todesstoss. Nach Ebene 1 - also nach rund 20 Minuten - hat der Spieler alles
gesehen, was das Spiel je zeigen wird. CLAUDE.md schreibt den Satz selbst:
"Ein Spiel, das nach 20 Minuten alle Mechaniken gezeigt hat, ist tot."

### 1.5 120 identische Belohnungen

Die Uebernahme ist die Belohnungseinheit, alle 2.5 Minuten, 120 mal. Jede
fuehlt sich an wie die vorige, nur mit groesserer Zahl: Balken voll, Rente
steigt, weiter. Die Belohnungsdichte stimmt, die Belohnungs-VIELFALT ist null.
Genau davor warnen die Postmortems - Zahlen allein tragen keine fuenf Stunden.

### 1.6 Tote Inhalte als Symptom

- Kettenstufe 3 (Professor, Pate) wird nie gekauft. Steht schon als offener
  Punkt in BALANCING.md - es ist aber kein Preisproblem, sondern der Beweis,
  dass die Kette keine Wahl enthaelt: wenn eine Option nie richtig ist, war es
  nie eine Option.
- Die Raumleiter loest sich selbst: kauf immer den teuersten bezahlbaren Raum.
- Das Lager ist ein Pflichtknopf ohne Abwaegung.

### 1.7 Die Stimmen sind zu duenn gestreut, um zu tragen

37 Zeilen auf 5.24 h ist eine Zeile alle achteinhalb Minuten. Als Witzmotor
und Tutorialschicht gedacht, faktisch ein Rauschen. Der Deckel von 70 Zeilen
ist richtig - dann muessen die Zeilen aber dort fallen, wo etwas Neues
passiert, statt gleichmaessig verteilt zu sein.


## 2. Was die Recherche als wirksam ausweist

Sechs Punkte, in der Reihenfolge, in der sie fuer uns zaehlen.

1. ENTFALTUNG ("Paradigm Shifts"). Regelmaessig neue Regeln aufklappen. Von
   allen Quellen als wichtigster Retention-Faktor genannt.
2. RUECKKOPPLUNG. Der Output muss den Input verteuern oder verbrauchen, sonst
   entsteht kein Optimum. Kittens Game: Kitten fressen. Paperclips: Draht.
3. GEGENDRUCK. Etwas muss Ansprueche stellen: Verfall, Konkurrenz, Zugriff,
   Zeitfenster. Ohne das ist Idlen strikt dominant.
4. UNGLEICHE BELOHNUNGEN. Cookie Clicker: Golden Cookies. Antimatter:
   Challenge-Belohnungen als Automatisierung. Verschiedene Belohnungsarten,
   nicht nur mehr vom Gleichen.
5. AUTOMATISIERUNG ALS BELOHNUNG, nicht als Grundzustand. Der Uebergang
   aktiv -> idle ist selbst der Spass. Bei uns ist er nach 60 Sekunden vorbei
   und wiederholt sich nie.
6. MEILENSTEIN-RHYTHMUS. Haben wir (x2 bei 25/50/100...), aber unsichtbar.
   Ein Schub, den niemand bemerkt, ist kein Schub.


## 2a. Machbarkeit: mehrere Ressourcen, wie Dr. Meth (geprueft 2026-08-26)

Wunsch: mehrere Ressourcen, "Dr. Meth hat das super geloest". Nachgesehen, was
dort wirklich passiert:

    Cash      die EINZIGE Waehrung
    Gramm     Bestand, Puffer zwischen Kochen und Verkaufen
    Reinheit  ein Multiplikator, der am Ort haengt ("1 g bei 50 % gibt 50 $")
    Dealer    fester Absatz je halbe Sekunde
    Orte      teurer = mehr Ertrag UND hoehere Reinheit

Das ist genau unsere Struktur: Bargeld, Ware, Raumqualitaet, Dealer, Raeume.
Der Unterschied ist nicht die Anzahl der Ressourcen, sondern dass Dr. Meth die
Reinheit ANZEIGT und in den Preis rechnet, waehrend unsere Raumqualitaet
unsichtbar im Ertrag verschwindet. Eine unsichtbare Zahl kann sich nicht gut
anfuehlen.

URTEIL: machbar, und zwar in dieser Form:

- JA zu einer Ressource, die WIRKLICH etwas Neues kann: die Ernte bekommt eine
  zweite Verwendung (verkaufen oder als Steckling zuruecklegen), daraus wird
  der Bestand PFLANZEN. Das ist der Rueckkopplungs-Kreis, der dem Spiel fehlt,
  und beim Thema Weed erklaert er sich von selbst.
- JA zur sichtbaren Qualitaet in Prozent und im Grammpreis. Billig, wirkt
  sofort.
- NEIN zu vier parallelen Waehrungen mit vier Menues. Das waere die Anzahl der
  Zahlen erhoehen, ohne die Anzahl der Entscheidungen zu erhoehen - genau der
  Fehler, den das Leitprinzip verbietet.

Aufwand fuer den Ressourcen-Umbau: rund eine Woche, davon der groessere Teil
Nachbalancieren. Bei sechs Wochen bis zur Deadline vertretbar.


## 3. Der Eingriff: drei Aenderungen, eine je Regel

Wichtig fuer das Leitprinzip: es kommt KEINE VIERTE REGEL dazu. Jede der drei
bestehenden Regeln bekommt genau eine Eigenschaft, die sie mit den anderen
verzahnt. Aus "drei Regeln nacheinander" wird "drei Regeln, die sich gegenseitig
beschraenken". Das ist der Unterschied zwischen addieren und multiplizieren.

### E1 - ZIEHEN speist sich aus der eigenen Ernte (Rueckkopplung)

Der Kern des Umbaus, und der Grund fuer das Weed-Thema. Zwei Teile:

**Der Setz-Regler.** Die Ernte hat ab jetzt zwei Verwendungen: verkaufen oder
als Steckling zuruecklegen. Ein Regler bestimmt den Anteil. Zurueckgelegte
Ernte wird zu PFLANZEN, und Pflanzen sind die Produktionsbasis - nur durch
Platz in den Raeumen begrenzt.

    aktive_pflanzen = min(pflanzen, plaetze)
    pflege          = min(1, gaertner * pflegeProGaertner / aktive_pflanzen)
    ertrag          = aktive_pflanzen * qualitaet(raum) * pflege

Drei Faktoren, drei verschiedene Waehrungen der Beschaffung: Platz kostet
Bargeld, Pflege kostet Bargeld, Pflanzen kosten ERNTE. Damit ist es ein
Produkt konkurrierender Ansprueche statt eines Minimums aus zwei Zahlen -
Punkt 1.2 des Befunds ist damit erledigt.

Das Optimum des Reglers KIPPT staendig, und genau das erzeugt den Rhythmus:

    frisch gekaufter Raum  ->  alles zuruecklegen, bis er voll ist
    voller Raum            ->  alles verkaufen, bis der naechste bezahlt ist

Damit ist ein Raumkauf ein EREIGNIS mit Nachspiel und kein Listeneintrag. Das
ist der "meaningful"-Fortschritt: der Umzug vom Badezimmer in den Keller
aendert fuer die naechsten Minuten, was man tut - nicht nur, wie schnell die
Zahl steigt.

Die Pflanzenzahl waechst exponentiell, solange zurueckgelegt wird. Das ist
ungefaehrlich, weil sie am Platz haengt und Platz exponentiell teurer wird -
der Genre-Motor bleibt also unangetastet.

**Betriebskosten.** Strom, Duenger, Lohn: Bargeld je Sekunde, abhaengig von
aktiven Pflanzen und Raumstufe. Damit wird Leerlauf teuer, ein volles Lager
schmerzt wirklich, und die Raumleiter muss man sich verdienen statt sie
abzuarbeiten. Kein Fail-State: reicht das Einkommen nicht, sinkt die Pflege
(niemand kuemmert sich), es entstehen aber keine Schulden.

Beim Thema Weed ist die Stromrechnung ausserdem der naheliegendste Witz im
ganzen Spiel, und die Stimmen bekommen ihn geschenkt.

Aufwand: der groesste Einzelposten. `rooms.ts` und der Produktionspfad in
`sim.ts` werden umgebaut, ein Regler kommt ins Panel, und `qualityMult` muss
neu gesucht werden (`npm run sweep`). Rund eine Woche.

### E2 - UEBERNEHMEN bringt eine SORTE (ungleiche Belohnung)

Jedes Gebiet bringt bei der Uebernahme eine Sorte mit. Name aus dem Ortsnamen,
Vorteil aus dem Seed - kein handgeschriebener Inhalt, ein Feld mehr in
`territory.ts`:

| Sorte (Beispiel)   | Dauerhafter Vorteil                         |
|--------------------|---------------------------------------------|
| Duisburger Nebel   | +Ertrag je Pflanze                          |
| Oberhausen Kush    | +Plaetze je Raum                            |
| Essener Feierabend | -Betriebskosten                             |
| Dortmund Diesel    | +Absatz je Verkaeufer                       |
| Ganymed Frost      | -Ernte je Steckling (Pflanzen werden billig)|
| Bochumer Klassik   | doppelte Rente, sonst nichts                |

Was das aendert: die Zielwahl entscheidet, WAS DU WIRST, nicht nur wie
schnell. Zwei Durchlaeufe sehen verschieden aus. Aus gleichfoermigen
Uebernahmen werden Entscheidungen mit Nachwirkung. Und die Sortenliste ist
nebenbei eine SAMMLUNG - sichtbarer Beweis dafuer, wo man ueberall war, was
Punkt 1.5 des Befunds direkt angeht.

Aufwand: mittel. Feld in `Territory`, Zuweisung in `world.ts`, Wirkung als
Modifikatoren in `sim.ts`, Anzeige auf der Karte, im Panel und in der
Schlussbilanz.

### E3 - VERKAUFEN hat Konkurrenz (Gegendruck)

Ein Rivale nimmt offene Gebiete der aktuellen Ebene langsam selbst ein. Ein
Gebiet, das er bekommt, ist nicht verloren, aber teurer zurueckzuholen (Bedarf
x1.5, keine Rente bis zur Rueckeroberung).

Was das aendert:
- Aus der Checkliste wird ein Rennen. Die Reihenfolge hat jetzt echte Kosten.
- Aktives Spiel wird sofort deutlich mehr wert als 7 % - man nimmt dem Rivalen
  gezielt die guten Gebiete weg.
- Der Autopilot bleibt spielbar (er verliert ein paar Gebiete und holt sie
  spaeter), also bleibt es ein Idle-Game.
- Es erzaehlt sich von selbst, ohne eine einzige Textzeile.

Das ist der Ersatz fuer die gestrichene Hitze - aber ohne eigenes System, ohne
zweite Waehrung, ohne Menue: nur eine Uhr auf den vorhandenen Gebieten.

Aufwand: klein bis mittel. Ein Timer je Ebene in `sim.ts`, ein Flag in
`Territory`, Kartenfarbe.

### E4 - Entfaltungsplan: was wann aufklappt

Kein neues System, sondern eine REIHENFOLGE fuer das, was ohnehin da ist. Alles
gleichzeitig zu zeigen ist der Grund, warum sich Ebene 2 bis 8 gleich anfuehlen.

| Ebene              | Was neu dazukommt                                            |
|--------------------|--------------------------------------------------------------|
| 0 Ruhrgebiet       | Von Hand ernten und verkaufen, eine Pflanze im Badezimmer, der Setz-Regler. Sonst nichts sichtbar. |
| 1 Deutschland      | Betriebskosten werden faellig. Kettenstufe 2, Lager.         |
| 2 Europa           | Gebietseigenschaften (E2) werden sichtbar und waehlbar.      |
| 3 Welt             | Der Rivale taucht auf (E3). Kettenstufe 3.                   |
| 4 Erdorbit         | Meilenstein-Anzeige und Max-Buy: Automatisierung als Belohnung. |
| 5 Mond & Mars      | Kettenstufe 4 wird endlich bezahlbar (siehe 4.2).            |
| 6 Aeusseres System | Der Rivale wird aggressiver - Endspiel-Tempo.                |
| 7 Interstellar     | Alle Regeln zusammen, keine neuen. Schlussbogen.             |

Die Stimmen kuendigen jede dieser Stufen an - dort fallen die Zeilen, dort
sitzt der Witz, und die 70-Zeilen-Grenze bleibt unangetastet.


## 4. Was gestrichen oder gestrafft wird

Die Eingriffe kosten Spielzeit und Aufmerksamkeit, also muss anderes weg.

### 4.1 Weniger Gebiete, mehr Gewicht

15 Gebiete je Ebene -> 8. Damit 64 statt 120 Uebernahmen. Jede einzelne traegt
dann eine Eigenschaft (E2) und ist eine echte Wahl, statt Teil einer langen
gleichfoermigen Reihe. Bedarf entsprechend anheben, damit die Spieldauer bleibt
(`levels.demandMult` gegenrechnen, `npm run sweep`).

### 4.2 Kettenstufe 3 wird billiger, nicht gestrichen

`costTierMult` von 55 auf ~35, damit Professor und Konzernchef im letzten
Drittel wirklich fallen. Mit den Betriebskosten aus E1 hat die Stufe zum ersten
Mal ein Argument: sie stellt ein, ohne selbst laufend Geld zu kosten -
Verwaltung statt Muskel.

### 4.3 Lager bleibt, wird aber Folge statt Knopf

Mit E1 ist "Lager voll" bereits schmerzhaft. Der Lager-Kaufknopf kann dann
verschwinden und die Kapazitaet an den besten Raum gekoppelt werden - ein
Knopf weniger im Sinne des Leitprinzips.


## 5. Reihenfolge, und wie wir merken, ob es wirkt

Immer wie bisher: Konstante -> Kern -> Messlauf -> erst dann UI.

    Schritt 0  Thema umstellen: Anzeigetexte, Namen der Raeume und Ketten,
               Stimmen-Zeilen. Rein kosmetisch, ein halber Tag, und danach
               sieht man beim Spielen, wovon man redet. Interne Bezeichner
               (`cook`, `sell`) bleiben, wie sie sind.
    Schritt 1  E1 Pflanzen, Setz-Regler und Betriebskosten, headless.
               Der grosse Brocken, rund eine Woche mit Nachbalancieren.
               Messen: kippt das Optimum des Reglers wirklich mit jedem
               Raumkauf? Wenn eine feste Reglerstellung durchweg optimal ist,
               ist die Entscheidung nur dekorativ und muss schaerfer werden.
    Schritt 2  E3 Rivale, headless. 1-2 Tage.
               Messen: aktiv gegen idle. ABBRUCHKRITERIUM unten.
    Schritt 3  E2 Sorten. 2-3 Tage.
               Messen: Streuung der Durchlaeufe ueber verschiedene Seeds.
    Schritt 4  4.1 und 4.2 nachbalancieren, Regressionslauf gruen.
    Schritt 5  E4 Entfaltung in UI und Stimmen, sichtbare Qualitaet in Prozent
               und im Grammpreis. 2-3 Tage.
    Schritt 6  Playtest mit Fremden. Der eigentliche Abnahmepunkt.

### Neue Abnahmekriterien fuer `npm run sim`

Die alten bleiben (Dauer 5-8 h, groesste Luecke <= 15 min, keine Sackgassen).
Dazu kommen drei, die genau das messen, was jetzt fehlt:

1. AKTIV SCHLAEGT IDLE UM >= 1.5x. Das ist die Vorgabe aus CLAUDE.md, die
   heute mit 1.07 verfehlt wird. Wichtigste einzelne Zahl des ganzen Umbaus.
2. ENTSCHEIDUNGSDICHTE: in >= 30 % der Messpunkte muessen mindestens zwei
   Kaufoptionen innerhalb von 10 % gleich gut sein. Sind sie es nie, ist die
   Wahl weiterhin nur Rechnen.
3. STREUUNG UEBER SEEDS: zwei Durchlaeufe mit verschiedenen Seeds sollen sich
   in der Zusammensetzung des Endstands deutlich unterscheiden (Raeume,
   Kettenstufen, Eigenschaften), nicht nur in der Dauer.

### Abbruchkriterium

Bringt E3 nach Schritt 2 den Aktiv/Idle-Faktor nicht ueber 1.3, ist die
Zielwahl als Traeger des aktiven Spiels endgueltig widerlegt. Dann nicht
weiterbasteln, sondern die Zielwahl als Hauptentscheidung aufgeben und
stattdessen die Kaufentscheidung zur Hauptentscheidung machen (Loehne haerter,
Raumleiter mit echten Verzweigungen).


## 6. Risiken

- SCOPE. Deadline 2026-10-06 steht. E1 und E3 sind billig, E2 ist der teuerste
  Punkt. Wenn die Zeit knapp wird: E2 auf drei Eigenschaften kuerzen, nicht
  streichen - ungleiche Belohnungen sind der zweitwichtigste Punkt der Liste.
- BALANCE-DRIFT. E1 greift direkt in die Ertragsseite ein, `qualityMult` wird
  neu gesucht werden muessen. Der Sweep ist dafuer da.
- LEITPRINZIP. Drei Zusaetze koennen sich wie drei Systeme anfuehlen. Gegenprobe
  bei jedem Schritt: laesst sich das Spiel noch in einem Satz erklaeren, und
  bleibt jeder Zusatz eine EIGENSCHAFT einer bestehenden Regel statt einer
  neuen Regel? Wenn nein, streichen.
- FALSCHE DIAGNOSE. Moeglich, dass das Spiel nicht zu flach, sondern zu LANG
  ist. Billiger Gegentest vor Schritt 1: einen Durchlauf auf 2 h zusammen-
  stauchen (`qualityMult` hoch) und selbst spielen. Fuehlt es sich dann gut an,
  ist Laenge das Problem und dieser ganze Plan halb so gross.


## 7. Quellen

- https://paperpilot.dev/garden/guide-to-incrementals/appeal-to-players
- https://paperpilot.dev/garden/guide-to-incrementals/defining-the-genre
- https://if50.substack.com/p/2017-universal-paperclips
- https://github.com/ac2522/IdleFramework/blob/main/IDLE_GAME_MECHANICS_RESEARCH.md
- https://www.gamedeveloper.com/design/lessons-of-my-first-incremental-game
- https://antimatterdimensions.online/challenges/
- https://wiki.kittensgame.com/en/general-information/game-mechanics
- https://en.wikipedia.org/wiki/Universal_Paperclips
- https://drmeth.com/faq/ (Reinheit, Combo, Orte, Dealer - Vorbild fuer 2a)
- https://store.steampowered.com/app/1056230/Medicinal_Herbs__Cannabis_Grow_Simulator/
  (Sorten und Anbau-Kreislauf als Vorbild fuer das Thema, nicht fuer den Detailgrad)
