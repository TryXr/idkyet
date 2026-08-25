# Balancing v1 (durchgerechnet am 2026-08-25)

Alle Zahlen stammen aus Simulationen, nicht aus dem Bauch. Sie sind ein
belastbarer Startpunkt, kein Endstand - die Feinjustage gehoert in den
Headless-Prototyp.

## 1. Marktmodell

Jeder Knoten hat: `demand` (Nachfrage), `basePrice`, `p` (Preisfaktor 0..1),
`h` (Hitze 0..1). Auslastung `u = zugeteilte Ware / demand`.

    dp/dt = -kP * u^gamma * p + rP * (1 - p)
    dh/dt =  kH * u          - rH * h
    Umsatz = zugeteilte Ware * basePrice * p

| Konstante | Wert  | Bedeutung |
|-----------|-------|-----------|
| kP        | 0.030 | Preisverfall |
| rP        | 0.0080| Preiserholung (~2 min) |
| gamma     | 1.7   | UEBERLINEAR - das ist die wichtigste Zahl, siehe unten |
| kH        | 0.0056| Hitzeaufbau |
| rH        | 0.0125| Abkuehlung (~80 s Zeitkonstante) |
| lockTime  | 120 s | Sperrdauer bei h = 1 |

**gamma > 1 ist der Kern.** Dadurch hat der Umsatz ein Maximum bei
`u* = 0.57` und faellt danach wieder. Einen Markt zu fluten ist aktiv
schaedlich, nicht nur nutzlos. Ohne diese Ueberlinearitaet ist "gleichmaessig
alles abkippen" mathematisch schon fast optimal - dann kann der Autopilot gar
nicht falsch liegen und aktives Spiel ist wertlos. Mit gamma = 1.0 gemessen:
Faktor aktiv/idle nur 1.06.

Knoten muessen STARK streuen, sonst ist Gleichverteilung wieder optimal:
`demand ~ exp(+-1.5)`, `basePrice ~ exp(+-1.0)`. Dazu langsame Schwankung der
Basispreise (mean-reverting, Zeitkonstante ~100 s) - das ist der Grund, warum
Hinschauen sich lohnt.

## 2. Statthalter (Autopilot) - gemessen gegen einen Menschen mit 30 s Reaktion

|                          | Ware knapp | mittel | ausgelastet | Ueberproduktion |
|--------------------------|-----------:|-------:|------------:|----------------:|
| S0 alles abkippen        |  76%       |  86%   |  90%        |  43%            |
| S1 + Sperren meiden      |  76%       |  86%   |  90%        |  45%            |
| S2 + Obergrenze u* + Preis-Vorrang | 83% | 90% | 100%     | 100%            |
| S3 + schnelle Reaktion (90 s)      | 96% | 98% | 100%     | 100%            |

WICHTIG: "Obergrenze" und "Preis-Vorrang" muessen EIN Upgrade sein. Getrennt
gekauft ist die Obergrenze allein schlechter als gar nichts (47%), weil der
Autopilot dann in den erstbesten statt in den besten Markt liefert. Das waere
eine Falle fuer den Spieler.

Der Vorteil des Menschen liegt bei KNAPPER Ware (wohin liefern?), nicht bei
Ueberfluss. Bei Ueberproduktion bricht dagegen der rohe Autopilot auf 43% ein.
Beides zusammen ergibt den Rhythmus: nach jeder Expansion ist es entspannt,
vor der naechsten lohnt Aufmerksamkeit.

## 3. Herstellorte

    kosten(t, n) = 10 * 12^t * 1.115^n       // t = Stufe, n = bereits besessen
    ausstoss(t)  = 0.10 * 13.0^t             // Ware/s

Meilensteine: x2 bei 25, 50, 100, 200 Stueck derselben Art.

Ausstoss waechst mit 13.0 pro Stufe SCHNELLER als die Kosten mit 12. Das ist
notwendig: In der ersten Fassung war es umgekehrt, und die Stufenzeiten haben
sich verdoppelt (21, 24, 30, 46, 77, 154, 293, 533 min) - genau die endlose
Verlangsamung aus den Genre-Postmortems.

Flaechen in m2: 2, 8, 15, 40, 250, 900, 4500, 30000, 0, 2000, 60000, 400000,
0, 1e6, 1e8. Die Nullen sind Frachtschiff und Orbitalstation - sie brauchen
keine Landflaeche und sind das Ventil, wenn die Erde voll ist.

## 4. Land

    preis(k, pool) = 5 * (1 / (1 - k/pool))^1.5

100 m2 pro Parzelle, Vorrat `pool = 12 * 14^stufe`. Endlich, also ist 100%
erreichbar; die letzten Prozent sind teuer, aber nicht unendlich.

## 5. Lager

Groesse = `60 s * 1.5^ausbaustufe * aktueller Ausstoss`. Als SEKUNDEN
Produktionspuffer definiert, dadurch skalenfrei - eine feste Stueckzahl waere
im Endgame bedeutungslos. Laeuft das Lager ueber, STOCKT die Produktion.
Kein Verlust, nur Stillstand.

## 6. Marktkapazitaet je Zoomstufe

    kapazitaet(L) = 0.6 * 12^L          // profitabel verkaufbare Ware/s
    aufstiegskosten(L) = kapazitaet(L) * 12 * 1100   // ~18 min Umsatz

Der Faktor 12 MUSS zum Ausstoss-Faktor der Herstellorte (13.0) passen. Mit 22
statt 12 lief das Spiel bei Stufe 10 (Orbit) in eine Wand von 322 Minuten.
Umgekehrt gemessen: sinkt der Ausstoss-Faktor auf 12.8, also zu nah an die 12,
springt die laengste Stufe von 48 auf 55 min - die Wand kommt zurueck.
Die beiden Zahlen duerfen nicht naeher als etwa 1.0 aneinander.

## 7. Ergebnis: Zeitplan (aus der echten Simulation, `npm run sim`)

| Stufe | erreicht bei | dauert |
|-------|-------------:|-------:|
| Block           | 0.30 h | 18 min |
| Stadt           | 0.60 h | 18 min |
| Ballungsraum    | 0.89 h | 18 min |
| Region          | 1.18 h | 17 min |
| Land            | 1.47 h | 17 min |
| Nachbarlaender  | 1.87 h | 24 min |
| Kontinent       | 2.30 h | 26 min |
| Hemisphaere     | 2.91 h | 37 min |
| Welt            | 3.19 h | 17 min |
| Orbit           | 3.48 h | 17 min |
| Mond & Mars     | 4.21 h | 44 min |
| Aeusseres System| 5.01 h | 48 min |
| Interstellar    | 5.31 h | 18 min |

| Spielweise                        | Gesamtzeit | Faktor |
|-----------------------------------|-----------:|-------:|
| aktiv (Mensch, 30 s Reaktion)     | 5.31 h | 1.00 |
| idle, Statthalter ausgebaut (S3)  | 5.35 h | 1.01 |
| idle, roher Autopilot (S0)        | 6.86 h | 1.29 |

Der Rhythmus ist bewusst ungleichmaessig (18, 18, 18, 17, 17, 24, 26, 37, 17,
17, 44, 48, 18) - keine gleichfoermige Verlangsamung, sondern Schuebe und
ruhige Phasen.

WICHTIG - physische Aufnahmegrenze: ein Markt nimmt hoechstens das 3-fache
seiner Nachfrage auf, der Rest bleibt im Lager liegen. Ohne diese Grenze konnte
der Autopilot das gesamte Lager in einer Sekunde absetzen, und Fluten war
folgenlos: der Faktor aktiv/idle lag dann bei 1.00 statt bei 1.29. Erst aus dem
Zusammenspiel von ueberlinearem Preisverfall UND Aufnahmegrenze entsteht der
Wert aufmerksamen Spielens.

## 8. Offene Punkte

- Die alten Sollzeiten (6.9 h) stammten aus einer Ueberschlagsrechnung, die
  jede Ware zum vollen Preis abgesetzt hat. Das Knotenmodell ist genauer;
  die Tabelle oben ist ab jetzt die Referenz.
- Aeusseres System (48 min) ist die laengste Stufe. Innerhalb der Zielmarke,
  aber der erste Kandidat, falls es sich zaeh anfuehlt.
- S3 ist praktisch so gut wie ein Mensch (Faktor 1.01). Die Reaktionszeit
  allein traegt zu wenig - falls aktives Spiel dauerhaft lohnen soll, muss der
  oberste Statthalter schlechter sein als S3 heute ist.
- Offline-Cap: 8 h, passt zur Spiellaenge.
