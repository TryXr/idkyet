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
| Ruhrgebiet       |  9 min|    0.10 |     0.40 | Badezimmer             |
| Deutschland      | 32 min|    0.83 |     7.60 | Badezimmer             |
| Europa           | 31 min|      10 |       36 | Dachboden              |
| Welt             | 32 min|      79 |      115 | Garage                 |
| Erdorbit         | 40 min|     494 |      492 | Gewächshaus            |
| Mond & Mars      | 51 min|  2.46 k |   2.46 k | Lagerhalle             |
| Aeusseres System | 63 min| 11.94 k |  20.48 k | Plantage               |
| Interstellar     | 76 min| 58.83 k |  81.93 k | Asteroiden-Gewächshaus |

    Gesamtdauer         5.55 h
    stur der Reihe nach 6.03 h   (kluge Zielwahl lohnt sich)
    Uebernahmen         120 von 120
    groesste Luecke     11 min ohne Uebernahme
    Renten am Ende      33 % des Einkommens
    Demo (Ebene 1-5)    rund 2.5 h

Die Ebenen wachsen von 9 auf 76 Minuten - deutlich flacher als vorher (9 auf
110). Grund ist nicht eine Feineinstellung, sondern der Bedarfsanteil: mit dem
Pflanzen-Kreislauf haengt der Durchsatz an Raumkaeufen, und die kommen
gleichmaessiger.

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

- ENTSCHEIDUNGSDICHTE 17 %, Ziel 30 % (TIEFE.md, Abschnitt 5). Die zweitbeste
  Kaufoption liegt im Schnitt bei 65 % der besten - besser als die 12 % vor dem
  Umbau, aber die Kaufentscheidung ist weiter ueberwiegend Rechnen. Dafuer sind
  E2 (Sorten) und E3 (Rivale) da.
- AKTIV GEGEN IDLE steht bei Faktor 1.09 (5.55 h gegen 6.03 h) und damit weiter
  weit unter der Vorgabe von 1.5. Der Regler hilft dem aufmerksamen Spieler
  zwar deutlich (Faktor 1.25 gegen die beste feste Stellung), aber die
  ZIELWAHL bleibt so schwach wie vorher. Das ist der Auftrag von E3.
- Offline-Cap 8 h, passt zur Spiellaenge.
