# IDKYET (Arbeitstitel)

Ein 2D-Incremental-Game. Du belieferst Märkte, bis dir die Erde ausgeht.

> Jeder Markt, den du bedienst, brennt aus — also musst du immer weiter.

## Kern

Drei Regeln, aus denen alles andere folgt:

1. **Produzieren** — Herstellorte liefern Ware pro Sekunde.
2. **Verkaufen** — Verkauf drückt den Preis und heizt den Markt auf. Beides
   erholt sich nur in Ruhe.
3. **Expandieren** — frische Märkte sind unverbrannt, aber weiter weg.

Eine durchgehend zoomende Karte führt über 14 Stufen von der Straßenecke bis
interstellar. Land ist endlich; wenn die Erde voll ist, geht es nach oben.
Eine Währung, kein Prestige, klares Ende nach rund fünf bis sieben Stunden.

## Stand

Meilenstein M5 erreicht: das Spiel ist bedienbar. Karte, Kaufwege für Orte,
Land und Lager mit Max-Buy und "Zeit bis zum nächsten Kauf", Statthalter-Menü
und die Stimmen als Erzähl- und Tutorialschicht. Darunter der Simulationskern,
headless und deterministisch, mit Speichern, Laden und Offline-Fortschritt.

```
npm install
npm run sim        # Regressionslauf gegen die Design-Ziele
npm test           # Speichern, Karte, Bedienung
npm run sweep      # Balance-Sweeps
npm run typecheck
npm run dev        # Spiel im Browser
```

## Aufbau

    src/core/    reine Simulation, kein DOM, deterministisch
      balance.ts   ALLE Konstanten an einer Stelle
    src/ui/      Anzeigemodell (rein), Bedienfeld, Stimmen-Einblendung
    src/content/ handgeschriebener Text: Stimmen und UI-Texte
    tools/       Headless-Runner, Sweeps, Abnahmetests

Dokumentation: [CLAUDE.md](CLAUDE.md) für Design und Entscheidungen,
[BALANCING.md](BALANCING.md) für die Zahlen, [PLAN.md](PLAN.md) für den Fahrplan.
