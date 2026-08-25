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

Meilenstein M3 erreicht: Simulationskern läuft headless und deterministisch,
mit Speichern, Laden, Offline-Fortschritt und Statthalter-Upgrades.

```
npm install
npm run sim        # Regressionslauf gegen die Design-Ziele
npm test           # Speichern, Laden, Offline-Fortschritt
npm run sweep      # Balance-Sweeps
npm run typecheck
```

## Aufbau

    src/core/    reine Simulation, kein DOM, deterministisch
      balance.ts   ALLE Konstanten an einer Stelle
    tools/       Headless-Runner und Sweeps

Dokumentation: [CLAUDE.md](CLAUDE.md) für Design und Entscheidungen,
[BALANCING.md](BALANCING.md) für die Zahlen, [PLAN.md](PLAN.md) für den Fahrplan.
