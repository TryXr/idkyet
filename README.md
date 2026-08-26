# IDKYET (Arbeitstitel)

Ein 2D-Incremental-Game. Du kochst, du verkaufst, du übernimmst — Stadt für
Stadt, bis dir die Welt gehört.

> Ein Gebiet, das du zu 100 % versorgt hast, gehört dir für immer und zahlt.

## Kern

Drei Regeln, aus denen alles andere folgt:

1. **Kochen** — Arbeiter machen in deinen Räumen Ware. Der Raum bestimmt die
   Qualität (Badezimmer wenig, Labor viel), der Arbeiter die Menge.
2. **Verkaufen** — Verkäufer setzen die Ware im Zielgebiet ab. Das füllt dort
   den Versorgungsbalken und bringt Bargeld.
3. **Übernehmen** — Ein Gebiet bei 100 % gehört dir und zahlt ab da passiv.
   Sind alle Gebiete einer Ebene deins, zoomt die Karte heraus.

Am Anfang drückst du beide Knöpfe selbst. Beide werden von Helfern übernommen —
Junkie, Koch, Chemiker auf der einen Seite, Dealer, Straßenboss, Kartellchef auf
der anderen. Jede Stufe stellt die darunter ein. Das ist der eigentliche
Fortschritt, nicht die Zahl auf dem Konto.

Acht Ebenen führen vom Ruhrgebiet bis zu anderen Sternen: Duisburg, Essen,
Dortmund, dann Deutschland, Europa, die Welt, der Orbit, Mond und Mars, der
Asteroidengürtel. Eine Währung, kein Prestige, klares Ende nach rund fünf
Stunden — erreicht ist es, wenn wirklich jeder beliefert ist.

## Stand

Das Gebietsmodell läuft vollständig: erste Minute von Hand, zwei Helfer-Ketten,
Räume mit Plätzen, 120 Gebiete über acht Ebenen, Schlussbilanz, Demo-Zuschnitt.
Darunter der Simulationskern, headless und deterministisch, mit Speichern,
Laden und Offline-Fortschritt.

Das ältere Marktmodell (Preisverfall, Hitze, Statthalter) liegt als Tag
`v1-marktmodell` im Repo.

```
npm install
npm run sim        # Regressionslauf gegen die Design-Ziele
npm test           # Speichern, Karte, Bedienung, erste Minute, Ende
npm run diagnose   # wo die Zeit je Ebene hingeht
npm run sweep      # Balance-Sweeps
npm run typecheck
npm run dev        # Spiel im Browser
npm run build      # Vollversion
npm run build:demo # Demo-Zuschnitt (endet nach Ebene 6, rund 2.4 h)
```

## Aufbau

    src/core/    reine Simulation, kein DOM, deterministisch
      balance.ts   ALLE Konstanten an einer Stelle
      chains.ts    die beiden Helfer-Ketten
      rooms.ts     Plätze und Qualität
      territory.ts Bedarf, Preis, Rente, Übernahme
      config.ts    Zuschnitt des Builds (Demo endet früher)
    src/ui/      Anzeigemodell (rein), Bedienfeld, Stimmen-Einblendung
    src/content/ handgeschriebener Text: Ortsnamen, Stimmen, UI-Texte
    tools/       Headless-Runner, Sweeps, Abnahmetests

Dokumentation: [CLAUDE.md](CLAUDE.md) für Design und Entscheidungen,
[BALANCING.md](BALANCING.md) für die Zahlen, [PLAN.md](PLAN.md) für den Fahrplan.
