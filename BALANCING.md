# Balancing (neu gerechnet am 2026-08-26)

Gilt fuer das Gebietsmodell. Das alte Marktmodell (Preisverfall, Hitze,
Statthalter) liegt als Tag `v1-marktmodell` im Repo; seine Zahlen sind hier
nicht mehr gueltig.

Alle Zahlen stehen in `src/core/balance.ts` und sind zur Laufzeit aenderbar,
damit `npm run sweep` sie durchdrehen kann.

## 1. Das Modell in vier Zeilen

    produktion = arbeiter_auf_plaetzen * qualitaet_des_raumes
    absatz     = verkaeufer * 0.4 Ware/s
    durchsatz  = min(produktion, absatz)
    einkommen  = durchsatz * preis(ebene) + summe(renten)

Der Durchsatz ist das Minimum der beiden Haelften. Wer nur eine Seite ausbaut,
produziert ins volle Lager oder laesst Dealer Daeumchen drehen. Das ist der
ganze Antrieb des Spiels - es braucht keine weitere Regel dafuer.

## 2. Die beiden Ketten

    KOCHEN     Junkie -> Koch -> Chemiker -> Professor
    VERKAUFEN  Dealer -> Strassenboss -> Kartellchef -> Pate

Stufe 0 arbeitet, jede hoehere stellt die darunter ein: `hireRate` = 0.0004
Einheiten je Sekunde und Vorgesetztem. Damit ist Stufe k die k-te Aufleitung
von Stufe 0 - die Produktion waechst polynomial, die Kosten exponentiell
(`costGrowth` 1.12 je Stueck, `costTierMult` 55 je Kettenstufe).

GEMESSEN: mit hireRate 0.02 entstanden 511166 Dealer und der Absatz lief der
Produktion um das 71000-fache davon. Mit 0.0004 liegen beide Haelften am Ende
bei 119 k gegen 554 k Ware/s und bleiben ueber 55 % der Spielzeit im
Gleichschritt (Faktor unter 3 auseinander).

Stufe 3 (Professor, Pate) wird im Messlauf nie gekauft - sie ist der Ausblick,
nicht der Normalfall. Erste Kaeufe je Stufe, gemessen: Koch auf Ebene 2,
Strassenboss und Chemiker auf Ebene 3, Kartellchef auf Ebene 4.

## 3. Raeume: Plaetze und Qualitaet

    plaetze(t)   = 2 * 1.6^t
    qualitaet(t) = 0.05 * 1.55^t     // Ware/s je Arbeiter
    kosten(t, n) = 25 * 5.5^t * 1.15^n

Ertrag eines vollen Raumes waechst also rund 2.5-fach je Stufe, die Kosten
5.5-fach. Hoehere Raeume lohnen sich damit erst, wenn man sie auch fuellen kann -
genau die Spannung "mehr Raeume oder mehr Arbeiter?".

`qualityMult` ist der empfindlichste Wert im ganzen Spiel: er bestimmt, wie
schnell der Durchsatz waechst, und damit die Spieldauer. Gemessen (Gesamtdauer
bei sonst gleichen Werten): 1.90 -> 1.58 h, 1.70 -> 2.73 h, 1.55 -> 5.24 h.

## 4. Gebiete: Bedarf, Preis, Rente

    bedarf(L) = 45 * 15^L * 0.87^(L*(L-1)/2)
    preis(L)  = 1.6 * 3.2^L
    rente(T)  = bedarf(T) * preis(T) / 9000 * streuung

15 Gebiete je Ebene, Bedarf und Preis streuen unabhaengig (logNormal, sigma
1.1 bzw. 0.55). Erst dadurch gibt es lohnende und undankbare Ziele - und erst
dadurch schlaegt kluge Zielwahl das stumpfe Abarbeiten.

DER ZUWACHS KLINGT AB (`demandDecay` 0.87). Frueh soll der Bedarf schneller
wachsen als der Durchsatz, damit die Ebenen groesser werden; spaet langsamer,
weil oben die Raumleiter endet. Ohne dieses Abklingen dauerte die letzte Ebene
gemessen bis zu 505 min, waehrend die erste 8 min brauchte.

RENTE: ein uebernommenes Gebiet zahlt seinen eigenen Wert in 9000 s noch einmal
ab. Am Ende des Durchlaufs machen Renten 35 % des Einkommens aus - spuerbar,
aber sie ersetzen das Kochen nicht. Frueh sind sie winzig (unter 1 %), weil
alles winzig ist; deshalb zeigt die Anzeige Betraege unter 0.01 mit vier
Nachkommastellen, sonst saehe eine echte Rente aus wie keine.

## 5. Ergebnis (`npm run sim`, `npm run diagnose`)

| Ebene            | Dauer | Ware/s am Ende | Bedarf   |
|------------------|------:|---------------:|---------:|
| Ruhrgebiet       |  9 min|           0.15 |       45 |
| Deutschland      | 11 min|           2.76 |      675 |
| Europa           | 14 min|             21 |   8.81 k |
| Welt             | 20 min|            151 | 100.01 k |
| Erdorbit         | 31 min|            874 | 987.85 k |
| Mond & Mars      | 49 min|          4.59 k |   8.49 M |
| Aeusseres System | 69 min|         23.85 k |  63.47 M |
| Interstellar     | 98 min|        119.15 k | 412.82 M |

    Gesamtdauer        5.24 h
    stur der Reihe nach 5.60 h   (kluge Zielwahl lohnt sich)
    Uebernahmen        120 von 120, im Schnitt alle 2.5 min
    groesste Luecke    12 min ohne Uebernahme
    Renten am Ende     35 % des Einkommens

## 6. Warum die Stufen so unterschiedlich lang sind

Die Ebenen wachsen von 9 auf 98 Minuten. Das ist Absicht, und es ist nur
vertretbar, weil die BELOHNUNGSEINHEIT DAS GEBIET IST, nicht die Ebene: auch
die letzte Ebene gibt alle paar Minuten eine Uebernahme her. Der
Regressionslauf prueft deshalb die groesste Luecke zwischen zwei Uebernahmen
(<= 15 min) und nicht die Ebenenlaenge.

Waere die Ebene die Belohnungseinheit, muesste man auf acht gleich lange Ebenen
von je 40 Minuten gehen - dann waere die erste Ebene 40 min lang, und ein
Neuling saesse eine dreiviertel Stunde vor drei Knoepfen.

## 7. Was am Messwerkzeug schiefging (und nicht am Spiel)

Drei Fehlmessungen, alle in `tools/autoplay.ts`, alle mit demselben Muster:
das Werkzeug hat ein Spiel gemessen, das niemand spielt.

1. Die Kaufpolitik bewertete jede Option ueber `min(Produktion, Absatz)`. Sind
   beide null, verbessert kein einzelner Kauf das Minimum - sie kaufte in
   sechs Stunden nichts und klickte nur von Hand.
2. Sie benutzte die Haende STATT einzukaufen (ein `return` zu frueh), statt
   beides zu tun.
3. Die Ketten liefen ihr davon, weil `hireRate` zu hoch war (siehe 2).

Konsequenz fuer kuenftige Messungen: wenn die Kurve absurd aussieht, zuerst
pruefen, ob der simulierte Spieler ueberhaupt etwas tut.

## 8. Offene Punkte

- Die letzte Ebene ist mit 98 min die laengste. Innerhalb der Belohnungstaktung
  ist das vertretbar, aber wenn ein Playtest es als Durststrecke meldet, ist der
  Hebel `demandDecay` (kleiner = flacheres Ende).
- Kettenstufe 3 (Professor, Pate) wird nie gekauft. Entweder billiger machen
  oder streichen - beides erst nach einem echten Playtest entscheiden.
- Offline-Cap 8 h, passt zur Spiellaenge.
