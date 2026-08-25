# Umsetzungsplan v1

Stand 2026-08-25. Deadline spielbarer Prototyp: 2026-10-06.
Grundlagen: CLAUDE.md (Design), BALANCING.md (Zahlen).

## 1. Was v1 ist - und was nicht

IST: Ein Durchlauf von der Straßenecke bis interstellar, ca. 7 h, eine Währung,
14 Zoomstufen, 15 Herstellorte, Land als endliche Fläche, Statthalter-Upgrades,
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
      numbers.ts       Hülle um break_infinity.js
      world.ts         Knotenbaum, prozedural aus einem Seed
      market.ts        Preis-/Hitze-Dynamik (kP, rP, gamma, kH, rH, Sperre)
      production.ts    Herstellorte, Kostenkurve, Meilensteine
      land.ts          Parzellen, Preis nach Knappheit
      storage.ts       Lager, Überlauf stoppt Produktion
      policy.ts        Statthalter S0-S3 + manuelle Zuteilung
      sim.ts           fixer Timestep, orchestriert alles
      save.ts          StorageAdapter-Schnittstelle, Version, Offline-Progress
      events.ts        benannte Events (später Steam-Erfolge)
    src/ui/            DOM für Zahlen/Listen, Pixi nur für die Karte
    src/content/       Stimmen-Texte, max. 5 je Stufe
    tools/             Headless-Runner, Balance-Sweeps, Regressionslauf

Regeln: keine CDN-Abhängigkeit, kein Backend, keine direkten localStorage-
Aufrufe außerhalb von save.ts, Erfolge nie im UI-Code.

## 3. Meilensteine

M1 - ERLEDIGT am 2026-08-25: Kern rechnet
  core/ mit balance, numbers, world, production, land, market. Headless-Runner
  reproduziert die Zeittabelle aus BALANCING.md (6.9 h aktiv) als Test.
  ABNAHME: `npm run sim` gibt die 14 Stufenzeiten aus, Abweichung < 10%.

M2 - ERLEDIGT am 2026-08-26 (geplant war 2026-09-08): Spiel wird zum Spiel
  Lager, Statthalter-Politiken, manuelles An/Aus von Gebieten, Events,
  Save/Load mit Version, Offline-Progress (Cap 8 h).
  ABNAHME: Headless-Durchlauf mit Speichern, Beenden, Laden, Weiterspielen.

M3 - bis 2026-09-15 (Zwischenziel aus CLAUDE.md): headless durchspielbar
  Balance-Sweeps über die zwei kritischen Verhältnisse. Die Ausreißer
  Mond/Mars (67 min) und interstellar (167 min) geglättet.
  ABNAHME: aktiv/idle beide zwischen 5 und 8 h, keine Stufe über 45 min.

M4 - bis 2026-09-22: Karte
  Pixi-Karte, stufenloses Zoomen, Knoten mit Nachfrage/Preis/Hitze sichtbar,
  gekauftes Land eingefärbt.
  ABNAHME: Zoom von Stufe 0 bis 13 ohne Ruckeln und ohne Zahlenartefakte.

M5 - bis 2026-09-29: Bedienung
  Kaufflüsse für Orte/Land/Lager, Max-Buy, "Zeit bis zum nächsten Kauf",
  Statthalter-Menü, Stimmen-Einblendungen.
  ABNAHME: ein Fremder spielt 20 min ohne mündliche Erklärung.

M6 - bis 2026-10-06: rund
  Erste 60 Sekunden, Ende, Demo-Build-Flag, Politur.
  ABNAHME: vollständiger Durchlauf bis interstellar im echten Build.

## 4. Reihenfolge innerhalb der Meilensteine

Immer: Konstante nach balance.ts -> Logik in core -> Test im Runner -> erst
danach UI. Nie umgekehrt.

## 5. Technische Risiken

ZOOM ÜBER 14 GRÖSSENORDNUNGEN. 12^13 ist rund 1e14 - Fließkomma in der
Renderpipeline bricht lange vorher. Lösung: niemals absolute Weltkoordinaten
rendern. Es werden nur die ca. 15 Knoten der aktuellen Stufe plus der
Elternknoten gezeichnet, und die Koordinaten werden bei jedem Stufenwechsel neu
auf den Ursprung bezogen. Das ist beim ersten Karten-Commit einzubauen, nicht
später - nachträglich ist es ein Umbau.

BALANCE-DRIFT. Die zwei kritischen Verhältnisse (Ausstoß 13.5 zu Kosten 12,
Kapazität 12 zu Ausstoß 13.5) kippen das Spiel, wenn sie verrutschen. Deshalb
liegen sie in balance.ts an einer Stelle und der Regressionslauf aus M1 läuft
bei jeder Änderung mit.

STIMMEN-TEXTE. Grundton ist Komödie (siehe CLAUDE.md). Einziger handgeschriebener
Inhalt, damit das einzige Stück, das
nicht mitskaliert. Deckel bei 70 Zeilen, notfalls weniger.

## 6. Nach v1

Steam-Wrapper (Electron + steamworks.js), Erfolge auf die vorhandenen Events,
Art-Durchgang, Demo/Vollversion-Trennung, danach optional New Game+.
