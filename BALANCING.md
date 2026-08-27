# Balancing (neu gerechnet am 2026-08-27)

Gilt fuer das Weed-Modell mit Pflanzen-Kreislauf. Der Stand davor (Gebiete
ohne Pflanzen) steckt in der Git-Historie, seine Zahlen sind hier nicht mehr
gueltig; das Marktmodell liegt als Tag `v1-marktmodell`.

Alle Zahlen stehen in `src/core/balance.ts` und sind zur Laufzeit aenderbar,
damit `npm run sweep` sie durchdrehen kann.

## 1. Das Modell in sechs Zeilen

    aktive_pflanzen = min(pflanzen, plaetze)
    pflege          = 1 - e^-(gaertner * 0.075 / vollertrag)
    ertrag          = aktive_pflanzen * qualitaet(raum) * pflege * strom
    absatz          = verkaeufer * 0.4 Ernte/s
    durchsatz       = min(ertrag, absatz)
    einkommen       = durchsatz * preis(ebene) + renten - betriebskosten

Die Ernte teilt sich am REGLER: ein Anteil geht ins Lager (und wird Bargeld),
der Rest wird zu Stecklingen (und in `growSeconds` zu Pflanzen). Bargeld kauft
Platz und Pflege, aber niemals Pflanzen - das ist der Kreislauf, der dem alten
Modell fehlte (TIEFE.md).

## 2. Der Regler ist eine echte Entscheidung

Gemessen mit `npm run decisions`, jeweils ein ganzer Durchlauf:

| Reglerstellung              | Dauer                  |
|-----------------------------|------------------------|
| fest 0 % (alles verkaufen)  | NICHT DURCH (Abbruch)  |
| fest 30 %                   | 6.92 h                 |
| fest 60 %                   | 12.42 h                |
| fest 90 %                   | NICHT DURCH (Abbruch)  |
| angepasst (Faustregel)      | 5.55 h                 |
| mit Voraussicht             | 9.53 h                 |

Beide Extreme scheitern: ohne Zuruecklegen gibt es nie mehr Pflanzen, ohne
Verkaufen nie Bargeld. Die beste feste Stellung braucht 25 % laenger als die
mitdenkende - der Regler ist damit die erste Entscheidung im Spiel, die sich
wirklich auszahlt.

VORAUSSICHT LOHNT NICHT. Schon zu saeen, bevor der neue Raum steht, kostet mehr
Verkauf, als die vermiedene Leerlaufzeit einbringt (9.53 h gegen 5.55 h). Die
richtige Regel ist gierig: erst fuellen, dann verkaufen. Das ist ein Ergebnis,
kein Versaeumnis - die Entscheidung liegt beim ZEITPUNKT DES RAUMKAUFS, nicht
beim Vorsaeen.

Anteil der Spielzeit im Aufbau (Regler ueberwiegend auf "zuruecklegen"):
36 % auf Ebene 1, dann fallend bis 7 % auf Ebene 7, im Schnitt 17 %. Das
Optimum kippt rund 230-mal je Stunde - der Rhythmus aus Schueben und ruhigen
Phasen entsteht also wirklich, ohne dass eine Regel ihn vorschreibt.

## 3. Betriebskosten

    kosten = (potenzial(raeume) - ein Badezimmer) * preis(ebene) * 0.15

Bezahlt wird der PLATZ, nicht die Pflanze: ein leerer Raum kostet trotzdem
Strom. Deshalb ist ein Raumkauf eine Entscheidung mit Nachspiel.

Reicht das Bargeld nicht, sinkt die Pflege - aber nie unter 20 %. Damit gibt es
keine Todesspirale und keine Schulden, nur Tempoverlust.

DAS ERSTE BADEZIMMER IST FREI. Ohne diese Freigrenze begann das Spiel mit einer
offenen Rechnung: in Sekunde eins gibt es kein Bargeld, also kann man nicht
zahlen, und das Erste, was ein Neuling las, war eine Mahnung.

## 4. Die beiden Ketten wachsen nach BEDARF

    ANBAU      Gaertner -> Grower -> Botaniker -> Professor
    VERKAUFEN  Dealer -> Strassenboss -> Grosshaendler -> Konzernchef

Stufe 0 arbeitet, jede hoehere stellt die darunter ein - aber nur, solange es
etwas zu tun gibt: ein Grower sucht Gaertner, solange die Pflege unter 100 %
liegt, ein Strassenboss sucht Dealer, solange die Ernte schneller anfaellt, als
sie abgeholt wird.

WARUM DIE BREMSE NOETIG WAR: ohne sie wuchsen beide Ketten allein mit der ZEIT,
waehrend der Ertrag an Plaetzen und Pflanzen haengt. Gemessen wurden 2.5 Mrd
Dealer fuer einen Absatz, der nie ueber 75 k stieg - das Dreizehntausendfache
dessen, was je gebraucht wurde. Die halbe Bedienung war damit ab der dritten
Ebene gegenstandslos. Mit der Bremse liegen beide Haelften ab Ebene 4 dauerhaft
innerhalb von Faktor 1.4 beieinander, und der Engpass wechselt hin und her
(31 % bis 59 % der Zeit ernte-begrenzt, je Ebene).

Erst dadurch ist `hireRate` von 0.0004 auf 0.02 gestiegen, ohne dass etwas
davonlaeuft: die Kette reagiert schnell, hoert aber von selbst auf.

STUFE 3 WIRD JETZT GEKAUFT (gemessen 84 Professoren, 79 Konzernchefs). Der
offene Punkt aus der letzten Fassung hat sich damit von selbst erledigt - es
war kein Preisproblem, sondern eine Folge der davonlaufenden Ketten.

## 5. Pflege haengt am ERTRAG, nicht an der Stueckzahl

    pflege = 1 - e^-(gaertner * 0.075 / vollertrag)

Eine Pflanze im Orbitalgewaechshaus macht mehr Arbeit als eine im Badezimmer.
Haengt die Pflege an der blossen Pflanzenzahl, saettigt sie nach kurzer Zeit
dauerhaft bei 100 % - gemessen 1.09e8 Gaertner fuer 30 k Pflanzen - und die
ganze Anbaukette ist Dekoration.

Die Kurve ist WEICH (1 - e^-x), nicht abgeschnitten: ein Gaertner mehr bringt
immer etwas, nur immer weniger. Ein hartes Minimum waere wieder das Thermostat
aus TIEFE.md, Befund 1.2 - dann gaebe es nichts abzuwaegen.

## 5a. Die Konkurrenz (E3, eingebaut am 2026-08-27)

    rate = min(ertrag, absatz) * 0.35        // ab Ebene 3 "Welt"
    verteilt auf die 3 lohnendsten offenen Gebiete,
    ausser dem, das du selbst gerade belieferst
    verliert man eines: bedarf * 1.5, eigener Fortschritt weg, keine Rente

Sie arbeitet mit einem ANTEIL DEINES DURCHSATZES. Damit bleibt sie ueber acht
Groessenordnungen relevant, ohne dass fuer jede Ebene eine eigene Zahl gepflegt
werden muss.

AUF MEHRERE GEBIETE VERTEILT, weil sie sonst wirkungslos ist: arbeitete sie nur
an einem, blockierte der Spieler sie dauerhaft mit einem einzigen Ziel -
gemessen verlor ein aufmerksamer Spieler dann KEIN EINZIGES Gebiet, und der
Gegendruck war keiner.

Was sie kostet, je Spielweise:

| Spielweise                        | Dauer   | verlorene Gebiete |
|-----------------------------------|--------:|------------------:|
| aufmerksam (Regler + Zielwahl)    | 5.59 h  |                 7 |
| Zielwahl stur der Reihe nach      | 6.08 h  |                18 |
| Regler unberuehrt bei 50 %        | 10.85 h |                35 |

(Stand nach E2 und E4. Die verlorenen Gebiete sind gegenueber E2 allein deutlich
gestiegen, weil die Konkurrenz ab Ebene 6 aufruestet - siehe 5d.)

## 5b. Aktiv gegen idle - die Messung stellte lange die falsche Frage

Der Regressionslauf verglich bisher "bestes Gebiet zuerst" mit "der Reihe nach"
und nannte das aktiv gegen idle. Das waren aber ZWEI AUTOPILOTEN: das Spiel
waehlt das Ziel ohnehin selbst, wenn niemand hinsieht. Ein idlender Spieler kann
an der Zielwahl also gar nicht scheitern - deshalb kam dort jahrelang Faktor
1.07 bis 1.11 heraus, und deshalb hat auch die Konkurrenz daran nichts geaendert
(durchgemessen ueber Anteil 0.35 bis 1.2 und Streuung 3 bis 6: der Faktor bleibt
zwischen 1.05 und 1.11, weil ein staerkerer Rivale beide Spielweisen gleich
bestraft).

Die richtige Frage ist der REGLER, denn den stellt niemand automatisch:

    Regler nachgestellt   5.59 h
    Regler unberuehrt    10.85 h
    Faktor                 1.94   (Vorgabe 1.5 bis 2)

Der Regressionslauf prueft ab jetzt genau das. Die Zielwahl bleibt als
Nebenkriterium drin - sie bringt reale 11 %, nur traegt sie die Vorgabe nicht.

## 5c. Die Sorten (E2, eingebaut am 2026-08-27)

Jedes Gebiet bringt bei der Uebernahme genau EINEN dauerhaften Vorteil mit.
Fuenf davon wirken ueberall und SUMMIEREN sich, der sechste nur im eigenen
Gebiet:

    +Ertrag  +Plaetze  +Absatz        Faktor = 1 + Summe
    -Strom   -Stecklinge              Faktor = 1 / (1 + Summe)
    x2 Rente                          nur dieses Gebiet, gleich in world.ts
                                      eingerechnet

Staerke je Sorte 0.03 im Mittel, log-normal gestreut (sigma 0.9), also grob
1.9 % bis 4.7 %. Nach 120 Uebernahmen steht das Beet bei etwa Ertrag x2.0,
Plaetze x1.8, Absatz x1.5, Strom x0.65.

SUMMIEREN STATT MULTIPLIZIEREN ist keine Feinheit, sondern die Bedingung dafuer,
dass die Sache ueberhaupt zu balancieren ist: 120 multiplikative Faktoren
sprengen jede Kurve, eine Summe landet planbar beim Doppelten.

### Was das gekostet hat

Ohne Gegenrechnung fiel der Durchlauf von 5.56 h auf 2.80 h. Gegengesteuert
wurde ueber `levels.demandMult` (13 -> 16.5), nicht ueber `rooms.qualityMult`:
der Bedarf wirkt je Stufe, die Raumqualitaet ueber die ganze Leiter - und die
Leiter endet bei zwoelf Raeumen, die Stufen nicht. Ueber `qualityMult` gedreht
wurde die letzte Ebene jedes Mal unverhaeltnismaessig lang.

Auch die Sortenstaerke selbst ist ein Hebel, und zwar der teuerste. Gemessen
bei jeweils passend nachgezogenem Bedarf:

| Staerke | demandMult | Dauer  | letzte Ebene | Rentenanteil |
|--------:|-----------:|-------:|-------------:|-------------:|
|    0.00 |       13.0 | 5.56 h |       76 min |          34 %|
|    0.02 |       15.5 | 5.45 h |       84 min |          39 %|
|    0.03 |       16.5 | 5.48 h |       91 min |          42 %|
|    0.05 |       17.0 | 4.73 h |       78 min |          41 %|

Genommen wurde 0.03: die staerkste Stufe, bei der die Kurvenform noch haelt.
Staerkere Sorten muessen mit noch mehr Bedarf bezahlt werden, und der Bedarf
waechst exponentiell mit der Ebene - deshalb blaeht sich immer zuerst das Ende
auf.

### Was sie bringen, und was nicht

STREUUNG UEBER SEEDS - das war Abnahmekriterium 3 und ist erfuellt:

| Sortenstaerke | fuenf Seeds        | Streuung |
|---------------|--------------------|---------:|
| 0.00          | 9.59 bis 9.87 h    |     1.04 |
| 0.03          | 5.59 bis 7.29 h    |     1.30 |

Alle fuenf liegen weiter in der Vorgabe von 5 bis 8 h - die Streuung kostet
also keine Durchspielbarkeit.

Und die Beete sehen verschieden aus: Seed 1 endet bei Ertrag x2.03, Seed 5 bei
x1.50, dafuer mit mehr Plaetzen. Zwei Partien sind zum ersten Mal nicht
dieselbe Partie.

ENTSCHEIDUNGSDICHTE - Abnahmekriterium 2, VERFEHLT und verschlechtert:

| Sortenstaerke | demandMult | Dichte |
|---------------|-----------:|-------:|
| 0.00          |       13.0 |   15 % |
| 0.00          |       16.5 |   12 % |
| 0.03          |       13.0 |    7 % |
| 0.03          |       16.5 |    7 % |

(Isolationsmessung von vor E4. Der Stand heute ist 6 %.)

Die Sorten selbst druecken die Zahl, nicht das Nachbalancieren. Der Grund ist
strukturell: ein GLOBALER Faktor hebt alle Optionen einer Seite gleich an und
laesst die Rangfolge unberuehrt - er schiebt die beiden Seiten nur weiter
auseinander, und genau deren Abstand misst die Dichte.

Die Messung zeigt dabei den eigentlichen Grund, warum die Kaufentscheidung
duenn ist, und der hat mit Sorten nichts zu tun: 83 % DES GELDES GEHEN IN
RAEUME, in jedem Seed, mit und ohne Sorten. Die beiden Helfer-Ketten bekommen
je 9 %. Solange eine Kategorie vier Fuenftel des Budgets bindet, gibt es bei
den anderen nichts abzuwaegen. Das ist ein Problem der Kostenkurven und
gehoert in den naechsten Schritt, nicht in E2.

## 5d. Der Entfaltungsplan (E4, eingebaut am 2026-08-27)

Kein neues System, nur eine Reihenfolge - aber sie kostet Spielzeit, also
gehoert sie hierher. Die Tabelle steht als `UNFOLD` und `CHAIN_TIER_LEVEL` in
`balance.ts`, `npm test` prueft, dass jede Ebene wirklich etwas aufklappt.

    Gesamtdauer      5.46 h -> 5.59 h
    aktiv/idle         1.84 -> 1.94
    letzte Ebene     90 min -> 96 min
    verlorene Gebiete     7 (aufmerksam), 18 (stur), 35 (Regler unberuehrt)

Die Ebenen 0 bis 3 blieben auf die Minute gleich lang: die Kettenstufen wurden
dort ohnehin noch nicht gekauft, der Deckel greift also erst da, wo er soll.
Gemessen wird Kettenstufe 3 jetzt genau auf ihrer Freigabe-Ebene gekauft, und
Stufe 4 ebenso - der Deckel ist damit ein Ereignis und keine Bremse.

DIE KONKURRENZ RUESTET AB EBENE 6 AUF (Anteil 0.35 -> 0.6). Das ist das einzige
Stueck Entfaltung, das nicht bloss ein Knopf ist, und es kostet einen
aufmerksamen Spieler jetzt 7 statt 1 Gebiet ueber den ganzen Durchlauf. Damit
das ueberhaupt wahrnehmbar ist, steht ihr Absatz ab Ebene 3 als Zahl neben dem
eigenen - vorher war sie eine Kraft, die man nur an ihren Folgen merkte.

### Was das Messen an sich selbst gefunden hat

Zwei Fehler, beide erst durch den neuen Pruefstein sichtbar:

1. MAX-BUY erschien nicht auf seiner Ebene, sondern drei spaeter. Der Knopf
   hing an der Bedingung "du kannst mehr als zehn auf einmal bezahlen" - eine
   Kassenlage, keine Ebene. Die Stimme kuendigte ihn also drei Ebenen zu frueh
   an. Jetzt genuegen zwei.
2. Der Pruefstein selbst mass zuerst die LETZTE Stichprobe je Ebene statt der
   Vereinigung. Direkt nach einem Kauf ist nie etwas bezahlbar, also sah er
   Knoepfe nicht, die es gab.

Beides derselbe alte Fehlertyp aus Abschnitt 8: erst pruefen, ob das Werkzeug
das misst, was es zu messen behauptet.

## 6. Raeume, Pflanzen, Gebiete

    plaetze(t)   = 2 * 1.6^t
    qualitaet(t) = 0.05 * 1.55^t     // Ernte/s je Pflanze
    kosten(t, n) = 25 * 5.5^t * 1.15^n
    steckling(t) = 6 * 1.55^t        // Ernte je neuer Pflanze

`seedCostMult` ist bewusst gleich `qualityMult`: dadurch dauert das Fuellen
eines neuen Raumes ueberall gleich lange, und der Rhythmus bleibt ueber alle
acht Ebenen derselbe.

ZWOELF RAUMSTUFEN, nicht fuenfzehn. Mehr wurde im Durchlauf nie gekauft; die
letzten drei waren totes Inventar. Jetzt endet die Leiter genau dort, wo das
Spiel endet - im Asteroiden-Gewaechshaus.

    bedarf(L) = 45 * 13^L * 0.87^(L*(L-1)/2)
    preis(L)  = 1.6 * 3.2^L
    rente(T)  = bedarf(T) * preis(T) / 9000 * streuung

15 Gebiete je Ebene, Bedarf und Preis streuen unabhaengig (logNormal, sigma
1.1 bzw. 0.55). Erst dadurch gibt es lohnende und undankbare Ziele.

## 7. Ergebnis (`npm run sim`, `npm run diagnose`)

| Ebene            | Dauer | Ernte/s | Absatz/s | bester Raum            |
|------------------|------:|--------:|---------:|------------------------|
| Ruhrgebiet       |  8 min|    0.11 |     0.45 | Badezimmer             |
| Deutschland      | 28 min|    1.76 |     9.52 | Kleiderschrank         |
| Europa           | 26 min|      22 |       48 | Dachboden              |
| Welt             | 28 min|     193 |      184 | Garage                 |
| Erdorbit         | 35 min|  1.43 k |   1.77 k | Scheune                |
| Mond & Mars      | 50 min|  8.21 k |   8.16 k | Lagerhalle             |
| Aeusseres System | 65 min| 55.01 k |  55.00 k | Orbitalgewächshaus     |
| Interstellar     | 96 min|219.36 k | 219.36 k | Asteroiden-Gewächshaus |

    Gesamtdauer         5.59 h
    stur der Reihe nach 6.08 h   (kluge Zielwahl lohnt sich)
    Uebernahmen         120 von 120
    groesste Luecke     11 min ohne Uebernahme
    Renten am Ende      44 % des Einkommens
    Demo (Ebene 1-5)    rund 2.1 h

Die Ebenen wachsen von 8 auf 96 Minuten. Vor den Sorten waren es 9 auf 76 - die
letzte Ebene ist der Preis dafuer, dass der Bedarf gegen die Sorten anziehen
musste (5c) und die Konkurrenz oben aufruestet (5d). Sie bleibt der
empfindlichste Punkt der ganzen Kurve, weil dort die Raumleiter endet und der
Durchsatz nicht mehr mitwaechst.

## 8. Was am Messwerkzeug schiefging (und nicht am Spiel)

Zu den drei alten Fehlern (BALANCING-Historie: Kaufpolitik ohne Wirkung, Haende
STATT Einkauf, zu hohe `hireRate`) kommt ein vierter, gefunden am 2026-08-27:

4. Die Bewertung benutzte `min(Ernte, Absatz)` plus einen kleinen Trostpreis
   fuer beide Seiten. Der Trostpreis wuchs mit der GROSSEN Seite mit, das
   Minimum nicht - also lohnte sich der Ausbau der ohnehin ueberlegenen Seite
   immer weiter. Ersetzt durch ein WEICHES Minimum `(a*b)/(a+b)`: es verhaelt
   sich wie das Minimum, sobald eine Seite kleiner ist, hat aber keine Kante
   und keinen toten Punkt.

Konsequenz bleibt dieselbe: wenn die Kurve absurd aussieht, zuerst pruefen, ob
der simulierte Spieler ueberhaupt etwas Sinnvolles tut.

## 9. Offene Punkte

- ENTSCHEIDUNGSDICHTE 6 %, Ziel 30 % (TIEFE.md, Abschnitt 5). Weder E2 noch E3
  konnten das heben, und E2 hat es gesenkt - warum, steht in 5c. Der Hebel
  liegt woanders: 83 % des Geldes gehen in Raeume, je 9 % in die beiden Ketten.
  Solange das so ist, gibt es nichts abzuwaegen. Anzugehen ueber die
  KOSTENKURVEN (`rooms.costMult`, `chain.costTierMult`), nicht ueber weitere
  Belohnungen.
- LETZTE EBENE 96 min, die laengste im Spiel. Hebel bleibt `demandDecay`.
- Offline-Cap 8 h, passt zur Spiellaenge.

ERLEDIGT: Aktiv gegen idle steht bei Faktor 1.94 (siehe 5b). Nicht durch die
Konkurrenz, sondern weil die Messung endlich das misst, was ein Spieler
tatsaechlich selbst entscheidet.

ERLEDIGT: Streuung ueber Seeds, Faktor 1.04 -> 1.30 (siehe 5c).

ERLEDIGT: Jede Ebene klappt etwas auf (siehe 5d), und `npm test` haelt das fest.
