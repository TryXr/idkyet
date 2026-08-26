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

    kosten(t, n) = 10 * 12^t * costMult(t) * 1.115^n   // n = bereits besessen
    ausstoss(t)  = 0.10 * 13.0^t                       // Ware/s

Meilensteine: x2 bei 25, 50, 100, 200 Stueck derselben Art.

Ausstoss waechst mit 13.0 pro Stufe SCHNELLER als die Kosten mit 12. Das ist
notwendig: In der ersten Fassung war es umgekehrt, und die Stufenzeiten haben
sich verdoppelt (21, 24, 30, 46, 77, 154, 293, 533 min) - genau die endlose
Verlangsamung aus den Genre-Postmortems.

| # | Ort                  | Flaeche m2  | costMult | Rolle |
|---|----------------------|------------:|---------:|-------|
| 0 | Badezimmer           |           2 |      1   | Start |
| 1 | Garage               |           8 |      1   | |
| 2 | Wohnwagen            |          15 |      1   | |
| 3 | Kellergeschoss       |          40 |      1.4 | dicht gebaut |
| 4 | Lagerhalle           |         250 |      1   | |
| 5 | Gewerbepark          |         900 |      1   | |
| 6 | Stillgelegte Fabrik  |       4 500 |      0.8 | billig pro Flaeche |
| 7 | Farm / Gewaechshaus  |      30 000 |      0.6 | Flaechenfresser |
| 8 | Frachtschiff         |           0 |      9   | KEIN Land noetig |
| 9 | Bergwerk             |       2 000 |      3   | kaum Oberflaeche |
|10 | Pharmawerk           |      60 000 |      1   | |
|11 | Raffinerie           |     400 000 |      0.8 | |
|12 | Orbitalstation       |           0 |      9   | KEIN Land noetig |
|13 | Mondbasis            |   1 000 000 |      1   | eigener Flaechenpool |
|14 | Asteroiden-Cluster   | 100 000 000 |      0.7 | Endgame |

Der costMult ist NICHT Kosmetik. Ohne Aufschlag auf die flaechenlosen Orte ist
Landknappheit vollstaendig folgenlos: gemessen aenderte sich die Spieldauer
nicht um eine Minute, wenn dem Spieler die halbe Welt fehlte - er wich einfach
auf Schiffe aus. Erst der Aufschlag macht "Land kaufen oder ausweichen?" zu
einer echten Entscheidung.

## 4. Land

    preis(k, pool) = 5 * (1 / (1 - k/pool))^1.5
    pool(stufe)    = 12 * 1.8^stufe

100 m2 pro Parzelle. Der Vorratsfaktor 1.8 ist eng gemessen:

| poolMult | Landbesitz am Ende | Wirkung |
|---------:|-------------------:|---------|
| 1.5      | 100%               | Spiel kommt NIE durch (>40 h) |
| **1.8**  | **55-100%**        | **Land bindet, Rhythmus entsteht** |
| 2.1      | 22.7%              | Land fast bedeutungslos |
| 2.5+     | unter 6%           | Land voellig bedeutungslos |

Bei 14 (erster Entwurf) besass der Spieler nach 254 978 gekauften Parzellen
0.0% der Welt - die gesamte "die Erde wird voll"-Spannung war eine
Behauptung ohne Deckung.

Mit 1.8 gehoert dem Spieler ab Stufe 4 durchgehend 100% der jeweiligen Ebene,
und genau dort tauchen Frachtschiff und Orbitalstation als beste Orte auf. Das
Ausweichventil greift von selbst, ohne Skript.

## 5. Lager

Groesse = `60 s * 1.5^ausbaustufe * aktueller Ausstoss`. Als SEKUNDEN
Produktionspuffer definiert, dadurch skalenfrei - eine feste Stueckzahl waere
im Endgame bedeutungslos. Laeuft das Lager ueber, STOCKT die Produktion.
Kein Verlust, nur Stillstand.

## 6. Statthalter

| Stufe | Name | Kosten | kann |
|-------|------|-------:|------|
| 0 | Handverkauf | - | alles, aber nur bei Anwesenheit |
| 1 | Statthalter anstellen | 400 | verkauft ueberall gleich, flutet |
| 2 | Sperren meiden | 15 000 | meidet heisse Maerkte |
| 3 | Disziplin: Obergrenze & Preis-Vorrang | 900 000 | haelt u* ein, beliefert teuerste zuerst |
| 4 | Marktbeobachtung | 60 000 000 | reagiert alle 90 s statt alle 300 s |

Stufe 3 ist EIN Upgrade aus zwei Faehigkeiten. Getrennt gekauft waere die
Obergrenze allein schlechter als gar nichts (47%), weil der Autopilot dann in
den erstbesten statt in den besten Markt liefert - eine Falle fuer den Spieler.

Ohne Statthalter passiert in der Abwesenheit NICHTS, denn dann verkauft
niemand. Das macht Stufe 1 zum wichtigsten Kauf des Spiels, obwohl sie
schlechter verkauft als Handarbeit.

VERWORFEN: "Opportunismus" - bei Preisspitzen ueber u* hinaus liefern. Klang
nach der fehlenden Menschen-Faehigkeit, machte den Menschen aber LANGSAMER
(5.99 h statt 5.90 h). Der Preisverfall ist ueberlinear und haelt laenger an,
als die Spitze einbringt. Das Feld steht als Konstante auf 0 im Code, damit
niemand die Idee ein zweites Mal hat.

## 7. Marktkapazitaet je Zoomstufe

    kapazitaet(L) = 0.6 * 12^L                    // profitabel verkaufbare Ware/s
    aufstiegskosten(L) = kapazitaet(L) * 12 * s(L)
    s(L) = min(1800, 420 * 1.45^L)                // Sekunden Umsatz

Der Faktor 12 MUSS zum Ausstoss-Faktor der Herstellorte (13.0) passen. Mit 22
statt 12 lief das Spiel bei Stufe 10 (Orbit) in eine Wand von 322 Minuten.
Umgekehrt gemessen: sinkt der Ausstoss-Faktor auf 12.8, also zu nah an die 12,
springt die laengste Stufe von 48 auf 55 min. Abstand mindestens 1.0 halten.

RAMPE STATT GLEICHER LAENGE (M6). s(L) war vorher konstant 1600, wodurch JEDE
Stufe rund 27 min dauerte - auch die allererste, in der man drei Knoepfe kennt
und nichts zu entscheiden hat. Jetzt startet s bei 420 (Straßenecke: 8 min) und
waechst bis zum Deckel von 1800. Die Summe ueber alle Stufen bleibt fast gleich,
das Spiel ist also nicht kuerzer, nur vorne schneller.

Gemessen ueber die Rampenparameter (`npm run sweep`, zweite Tabelle): Start 350
bis 420 und Rampe 1.35 bis 1.55 erfuellen alle Ziele; groessere Deckel als 1800
schieben die laengste Stufe an die 45-Minuten-Grenze.

## 8. Ergebnis: Zeitplan (`npm run sim`, `tools/diagnose.ts`)

| Stufe | Dauer | Landbesitz | hoechster Ort |
|-------|------:|-----------:|---------------|
| Straßenecke     |  8 min |   8.3% | Garage |
| Block           | 13 min |   4.8% | Wohnwagen |
| Stadt           | 28 min |  13.2% | Wohnwagen |
| Ballungsraum    | 20 min |   7.2% | Lagerhalle |
| Region          | 35 min | 100.0% | Gewerbepark |
| Land            | 27 min |  55.3% | Stillgelegte Fabrik |
| Nachbarlaender  | 29 min | 100.0% | Farm / Gewaechshaus |
| Kontinent       | 31 min | 100.0% | Frachtschiff |
| Hemisphaere     | 29 min | 100.0% | Frachtschiff |
| Welt            | 28 min | 100.0% | Pharmawerk |
| Orbit           | 41 min | 100.0% | Bergwerk |
| Mond & Mars     | 35 min | 100.0% | Orbitalstation |
| Aeusseres System| 30 min | 100.0% | Orbitalstation |
| Interstellar    | Saettigung der letzten Stufe | 100.0% | Mondbasis |

| Spielweise                        | Gesamtzeit | Faktor |
|-----------------------------------|-----------:|-------:|
| aktiv (anwesend, Handbetrieb)     | 5.90 h | 1.00 |
| idle mit gekauftem Statthalter    | 6.22 h | 1.05 |
| idle ohne jeden Ausbau            | 11.75 h | 1.99 |
| Demo-Zuschnitt (bis Stufe 5)      | 1.74 h |    -  |

WICHTIG zum Messmodell: Wer anwesend ist, uebersteuert seinen Statthalter
ohnehin - der Autopilot zaehlt nur bei Abwesenheit. Frueher wurde gegen "S3 ab
der ersten Sekunde" gemessen, was nie vorkommt (S3 kostet 60 Mio) und den
falschen Schluss ergab, aktives Spiel sei wertlos.

Der grosse Hebel ist nicht Starren auf den Bildschirm, sondern der
STATTHALTER-AUSBAU: wer ihn ignoriert, braucht doppelt so lang.

ENDE (M6): Das Spiel endet nicht mit dem letzten Aufstieg, sondern wenn auch
die letzte Stufe gesaettigt ist - "jeder ist beliefert" (CLAUDE.md). Im Messlauf
faellt das fast zusammen, weil der Autoplay beim letzten Kauf ohnehin weit
ueberbaut; ein Spieler, der dem Bedienfeld folgt, hat dort noch eine echte
Schlussetappe vor sich.

## 9. Weitere gemessene Erkenntnisse

SAMMELKAUF IST PFLICHT, nicht Komfort. Mit einer Parzelle pro Tick hing der
Spieler bis zu 53% einer Zoomstufe an der Flaeche fest (Kontinent 37 min, Orbit
44 min, Mond & Mars 48 min). Mit Sammelkauf verschwanden die Ausreisser
vollstaendig - allerdings wurde die Kurve dadurch erst monoton (16-19 min
ueberall), bis die Landknappheit aus Abschnitt 4 die Rhythmik zurueckbrachte.

PHYSISCHE AUFNAHMEGRENZE: ein Markt nimmt hoechstens das 3-fache seiner
Nachfrage auf, der Rest bleibt im Lager. Ohne diese Grenze konnte der Autopilot
das gesamte Lager in einer Sekunde absetzen und Fluten war folgenlos; der
Faktor aktiv/idle lag dann bei exakt 1.00.

HANDVERKAUF (M6): Ohne Statthalter verkauft niemand - ein Klick schickt das
ganze Lager in ein Gebiet, das es ueber mehrere Sekunden aufnimmt. Gemessen mit
Klickabstand 1 s, 3 s und 5 s: Garage nach 35/38/41 s, erster Statthalter nach
136/160/162 s. Schnelleres Klicken bringt also fast nichts - der Lagerpuffer
begrenzt, nicht die Klickrate. Genau so war es gedacht: Klicken ist Tutorial,
kein Dauerzustand.

## 10. Offene Punkte

- ENTSCHEIDUNGSDICHTE. Auf mehreren Stufen faellt ein einziger Kauf, der Rest
  der Stufe ist Sparen auf den Aufstieg. In M6 durchgemessen, mit klarem
  Ergebnis: die in Abschnitt 10 frueher vermuteten Hebel greifen NICHT.
  - Meilensteine (25/50/100/200 gegen 10/25/50/100 gegen 5/15/40/100) und
    costGrowth (1.115 bis 1.07) bewegen die Kaeufe je Stufe kaum: 6.4 bis 8.1.
  - Die Ursache liegt im Verhaeltnis von Ortsausstoss zu Stufenkapazitaet. Ein
    einziges Stueck der neuesten Art liefert das 2.2- bis 6.3-fache dessen, was
    eine Stufe ueberhaupt abnimmt. Damit ist die Stufe mit einem Klick erledigt.
  - Gegenprobe: Ortsarten erst bei L+1 statt L+2 freischalten. Dann braeuchte es
    2 bis 5.5 Stueck - die Dichte waere gelöst. Der Lauf bleibt so aber auf dem
    Kontinent stehen (40 h, 734 Parzellen), weil die flaechenlosen Orte
    (Frachtschiff, Orbitalstation) zu spaet kommen, um die Landknappheit
    aufzufangen. Verworfen und im Code dokumentiert (sim.unlockedTiers).
  Der Hebel liegt also in der ORTSTABELLE (Flaechen und Kosten der Stufen 8-12),
  nicht in Meilensteinen und nicht in der Freischaltregel. Das ist eine
  Umstellung der Wirtschaft, keine Politur - deshalb v2, nicht v1.
- Straßenecke: mit der Rampe aus Abschnitt 7 erledigt (8 statt 27 min).
- Offline-Cap: 8 h, passt zur Spiellaenge.
- Das Ereignis `storageFull` meldet seit M5 die FLANKE der Drosselung
  (Produktion wird beschnitten), nicht mehr den Stillstand bei genau null.
  Vorher trat es praktisch nie ein, weil jede Sekunde ein wenig Ware abfliesst -
  die Warnung im Bedienfeld haette es also nie gegeben. An den Zahlen aendert
  das nichts, nur an der Meldung.
