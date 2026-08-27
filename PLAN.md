# Umsetzungsplan v1

Deadline spielbarer Prototyp: 2026-10-06.
Grundlagen: CLAUDE.md (Design), BALANCING.md (Zahlen).

## Wo wir stehen (2026-08-27)

Aus TIEFE.md sind Schritt 0 (Thema WEED), Schritt 1 (E1, Pflanzen-Kreislauf und
Betriebskosten), Schritt 2 (E3, Konkurrenz) und Schritt 3 (E2, Sorten) gebaut
und durchgemessen. Offen ist nur noch E4 (Entfaltungsplan).

    npm run decisions  # ist der Regler eine Entscheidung, und was tun Sorten?

Gemessen: 5.46 h Gesamtdauer, alle 120 Gebiete, groesste Luecke 11 min, Renten
44 %. Der Regler traegt das aktive Spiel (Faktor 1.84), die Konkurrenz macht
aus der Zielwahl ein Rennen:

    aufmerksam                   5.46 h,  1 Gebiet verloren
    Zielwahl stur der Reihe nach 5.97 h, 13 Gebiete verloren
    Regler unberuehrt           10.06 h, 20 Gebiete verloren

DIE SORTEN (E2): jede Uebernahme laesst genau einen dauerhaften Vorteil da,
Name und Wirkung aus dem Seed. Zum ersten Mal laufen Durchlaeufe auseinander -
fuenf Seeds zwischen 5.46 und 6.98 h, vorher lagen sie alle innerhalb von 1 %.
Bezahlt wurde das mit `levels.demandMult` 13 -> 16.5; ohne diese Gegenrechnung
brach der Durchlauf auf 2.80 h ein.

VON DEN DREI ABNAHMEKRITERIEN DES UMBAUS sind zwei erfuellt (aktiv/idle 1.84,
Streuung 1.28) und eines widerlegt: die ENTSCHEIDUNGSDICHTE steht bei 7 % statt
30 %, und E2 hat sie gesenkt statt gehoben. Der Grund ist strukturell und in
BALANCING.md 5c durchgerechnet - ein globaler Vorteil verschiebt kein Ranking.
Der eigentliche Hebel liegt bei den Kostenkurven: 83 % des Geldes gehen in
Raeume, je 9 % in die beiden Ketten.

## Wo wir vorher standen (2026-08-26)

Das Spiel wurde neu gefasst: aus dem Marktmodell (Preisverfall, Hitze,
Statthalter) wurde das GEBIETSMODELL - kochen, verkaufen, uebernehmen. Der
alte Stand liegt als Tag v1-marktmodell. Warum, steht in CLAUDE.md.

Der neue Kern laeuft vollstaendig durch, die Bedienung steht, alle Pruefsteine
sind gruen.

    npm run sim        # Spieldauer, Zielwahl, Belohnungstaktung
    npm test           # Speichern, Karte, Bedienung, erste Minute, Ende
    npm run diagnose   # wo die Zeit je Ebene hingeht
    npm run sweep      # Bedarf gegen Raumqualitaet
    npm run dev        # Spiel im Browser (Port 5173)
    npm run build      # Vollversion
    npm run build:demo # Demo (endet nach Ebene 6, siehe .env.demo)

Gemessen: 5.24 h Gesamtdauer, 120 Gebiete, Uebernahme alle 2.5 min, kluge
Zielwahl schlaegt stures Abarbeiten (5.24 h gegen 5.60 h), Renten 35 % des
Einkommens.

Im Entwicklungsbuild haengen `sim`, `map`, `panel`, `jumpTo(ebene)` und
`reset()` am globalen Objekt. `reset()` haengt vorher Autospeicher und
Exit-Handler ab; ohne das schreibt die alte Seite ihren Stand waehrend des
Neuladens zurueck.

WAS ALS NAECHSTES ANSTEHT:
- TIEFE.md ZUERST LESEN. Befund, Recherche und Umbauplan stehen dort samt
  Abnahmekriterien und dem, was davon widerlegt wurde.
- E4 (Entfaltungsplan): nicht alles ab Minute eins zeigen. Betriebskosten ab
  Ebene 1, Sorten ab 2, Rivale ab 3 (steht schon), Meilenstein-Anzeige und
  Max-Buy spaeter. Die Stimmen kuendigen jede Stufe an.
- KOSTENKURVEN. 83 % des Geldes gehen in Raeume - die beiden Ketten sind als
  Kaufentscheidung fast Dekoration. Das ist der offene Punkt hinter der
  Entscheidungsdichte, und E2 war nicht das Werkzeug dafuer.
- Echter Playtest mit Fremden (itch.io, r/incremental_games). Der einzige
  Abnahmepunkt, den kein Skript ersetzen kann.
- Die letzte Ebene ist mit 90 min die laengste. Hebel: demandDecay.
- KEIN NEUSTART IM SPIEL. Nach der Schlussbilanz (und bei einem abgelehnten
  Speicherstand) gibt es keinen Weg, von vorn anzufangen - nur `reset()` in der
  Konsole, und das nur im Entwicklungsbuild. Vor jedem oeffentlichen Build
  noetig, sonst sitzt ein Playtester nach dem Ende fest.
- Steam-Wrapper, Art-Durchgang, Erfolge auf die vorhandenen Events.

## 1. Was v1 ist - und was nicht

IST: Ein Durchlauf vom Ruhrgebiet bis interstellar, rund 5 h, eine Währung,
8 Ebenen mit je 15 Gebieten, zwei Helfer-Ketten, Räume mit Plätzen,
Stimmen als Erzähl- und Tutorialschicht, klares Ende.

IST NICHT: Prestige, zweite Währung, Konkurrenz-KI, Achievements-UI, Art-Stil,
Steam-Build, Mehrsprachigkeit, Ton.

Diese Liste ist die Scope-Bremse. Alles, was hier nicht steht, ist v2.

## 2. Architektur

Harte Trennung: `core/` kennt kein DOM, kein Pixi, keine Zeit außer dem Tick.
Dadurch ist die gesamte Balance headless testbar - und der Steam-Port betrifft
nur die Ränder.

    src/core/          reine Simulation, deterministisch, ohne Rendering
      balance.ts       ALLE Konstanten an einer Stelle, zur Laufzeit änderbar
      config.ts        Zuschnitt des Builds (Demo endet früher)
      numbers.ts       Hülle um break_infinity.js
      world.ts         Knotenbaum, prozedural aus einem Seed
      chains.ts        die beiden Helfer-Ketten (jede Stufe stellt ein)
      rooms.ts         Plaetze und Qualitaet
      territory.ts     Bedarf, Preis, Rente, Uebernahme
      sim.ts           fixer Timestep, orchestriert alles
      save.ts          StorageAdapter-Schnittstelle, Version, Offline-Progress
      events.ts        benannte Events (später Steam-Erfolge)
    src/ui/            DOM für Zahlen/Listen, Pixi nur für die Karte
      model.ts         Anzeigemodell, rein und ohne DOM - headless prüfbar
      panel.ts         Bedienfeld, baut das Gerüst einmal und füllt nur noch
      voices-view.ts   Einblendung der Stimmen über der Karte
      ending.ts        Schlussbilanz
    src/content/       Ortsnamen, Stimmen (max. 5 je Ebene), UI-Texte
    tools/             Headless-Runner, Balance-Sweeps, Regressionslauf

Regeln: keine CDN-Abhängigkeit, kein Backend, keine direkten localStorage-
Aufrufe außerhalb von save.ts, Erfolge nie im UI-Code.

## 3. Meilensteine

M1 bis M6 wurden zwischen dem 2026-08-25 und 2026-08-26 fuer das MARKTMODELL
abgearbeitet (Kern, Speichern, Balancing, Karte, Bedienung, Ende). Dieser Stand
liegt vollstaendig als Tag `v1-marktmodell` im Repo, samt seiner eigenen
Zeitplaene und Abnahmen.

Am 2026-08-26 wurde das Spiel neu gefasst: Gebiete statt Maerkte, zwei
Helfer-Ketten statt Statthalter-Politiken, Raeume statt Land. Was aus M1 bis M6
uebernommen wurde, weil es vom Modell unabhaengig ist:

  - grosse Zahlen, fixer Timestep, deterministische Simulation
  - Speichern/Laden mit Versionsnummer, Offline-Fortschritt (Cap 8 h)
  - Ereignis-System als Grundlage fuer spaetere Steam-Erfolge
  - Pixi-Karte mit stufenlosem Zoom und lokalen Koordinaten
  - headless Messwerkzeuge: Regressionslauf, Diagnose, Sweep
  - Stimmen als Erzaehl- und Tutorialschicht, Demo-Zuschnitt, Schlussbilanz

ABNAHME des neuen Modells (alle gruen, siehe BALANCING.md):

  - durchspielbar in 5.24 h, alle 120 Gebiete uebernommen
  - nie laenger als 15 min ohne Uebernahme (groesste Luecke 12 min)
  - kluge Zielwahl schlaegt stures Abarbeiten (5.24 h gegen 5.60 h)
  - Renten tragen 35 % bei, ersetzen das Kochen aber nicht
  - erste Minute traegt: erster Junkie nach 8 s, erster Dealer nach 32 s
  - keine Sackgassen ueber 1888 Stichproben eines ganzen Durchlaufs
  - jede Stimmen-Zeile faellt im Spiel wirklich (37 von 37)
  - Demo-Zuschnitt durchspielbar in 2.44 h

OFFEN: der Test mit einem echten Fremden. Dafuer ist der Web-Build da.

## 4. Reihenfolge innerhalb der Meilensteine

Immer: Konstante nach balance.ts -> Logik in core -> Test im Runner -> erst
danach UI. Nie umgekehrt.

## 5. Technische Risiken

ZOOM ÜBER ACHT EBENEN. Der Bedarf wächst über die Ebenen um viele
Größenordnungen. Würde die Karte absolute Weltkoordinaten führen, wäre die
Fließkomma-Genauigkeit lange vorher dahin. Lösung: es werden nur die 15 Gebiete
der aktuellen Ebene gezeichnet, und die Koordinaten werden bei jedem
Ebenenwechsel neu auf den Ursprung bezogen.

BALANCE-DRIFT. Der empfindlichste Wert ist rooms.qualityMult: er bestimmt, wie
schnell der Durchsatz wächst, und damit die Spieldauer (1.90 ergab 1.58 h,
1.55 ergibt 5.24 h). Danach kommen levels.demandMult und demandDecay. Alle drei
liegen in balance.ts an einer Stelle, und der Regressionslauf läuft bei jeder
Änderung mit.

STIMMEN-TEXTE. Grundton ist Komödie (siehe CLAUDE.md). Einziger handgeschriebener
Inhalt, damit das einzige Stück, das
nicht mitskaliert. Deckel bei 70 Zeilen, notfalls weniger.

## 6. Nach v1

Steam-Wrapper (Electron + steamworks.js), Erfolge auf die vorhandenen Events,
Art-Durchgang, Demo/Vollversion-Trennung, danach optional New Game+.
