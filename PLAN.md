# Umsetzungsplan v1

Deadline spielbarer Prototyp: 2026-10-06.
Grundlagen: CLAUDE.md (Design), BALANCING.md (Zahlen).

## Wo wir stehen (2026-08-26)

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
- Echter Playtest mit Fremden (itch.io, r/incremental_games). Der einzige
  Abnahmepunkt, den kein Skript ersetzen kann.
- Kettenstufe 3 (Professor, Pate) wird nie gekauft - billiger machen oder
  streichen, nach dem Playtest entscheiden.
- Die letzte Ebene ist mit 98 min die laengste. Hebel: demandDecay.
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
