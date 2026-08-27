/**
 * Die Zoomstufen und ihre Gebiete.
 *
 * Selbstaehnlich: ein Stadtteil und ein Sternsystem laufen durch denselben
 * Code, nur Zahlen und Name unterscheiden sich. Die Namen sind handgeschrieben
 * (content/places.ts), die Zahlen kommen aus dem Seed - die Liste gibt das
 * Thema, der Seed die Streuung.
 *
 * Normalisiert wird so, dass der Gesamtbedarf einer Stufe exakt der geplanten
 * Zahl aus BALANCING.md entspricht. Dadurch stimmt das Detailmodell mit dem
 * gerechneten Zeitplan ueberein.
 */
import { BALANCE, LEVELS } from './balance.js';
import { CONFIG } from './config.js';
import { placeName } from '../content/places.js';
import { createTerritory, type Territory } from './territory.js';
import { makeStrain, rentFactor } from './strains.js';
import { Rng } from './rng.js';

/** Gesamtbedarf aller Gebiete einer Stufe, in Ware. */
export function levelDemand(level: number): number {
  const { demand0, demandMult, demandDecay } = BALANCE.levels;
  // Produkt der abklingenden Zuwaechse: 11.5, dann 11.5*0.93, dann *0.93^2 ...
  return demand0 * Math.pow(demandMult, level) * Math.pow(demandDecay, level * (level - 1) / 2);
}

/** Mittlerer Erloes je Ware auf dieser Stufe. */
export const levelPrice = (level: number): number =>
  BALANCE.levels.price0 * Math.pow(BALANCE.levels.priceMult, level);

export const levelName = (level: number): string =>
  LEVELS[Math.min(level, LEVELS.length - 1)] ?? `Stufe ${level}`;

/** Hoechste erreichbare Stufe. Im Demo-Build endet das Spiel frueher. */
export const maxLevel = (): number => Math.min(CONFIG.maxLevel, LEVELS.length - 1);

/**
 * Die Gebiete einer Stufe erzeugen.
 *
 * Bedarf und Preis streuen stark und UNABHAENGIG voneinander - erst dadurch
 * gibt es lohnende und undankbare Ziele, und erst dadurch lohnt sich die
 * Zielwahl gegenueber dem Autopiloten.
 */
export function generateLevel(level: number, seed: number): Territory[] {
  const rng = new Rng(seed * 7919 + level * 104729 + 1);
  const count = BALANCE.levels.perLevel;

  const rawDemand = Array.from({ length: count }, () => rng.logNormal(BALANCE.spread.demandSigma));
  const rawPrice = Array.from({ length: count }, () => rng.logNormal(BALANCE.spread.priceSigma));
  const rawRent = Array.from({ length: count }, () => rng.logNormal(BALANCE.spread.rentSigma));

  const demandSum = rawDemand.reduce((a, b) => a + b, 0);
  const demandScale = levelDemand(level) / demandSum;

  const priceMean = rawPrice.reduce((a, b) => a + b, 0) / count;
  const priceScale = levelPrice(level) / priceMean;

  const rentMean = rawRent.reduce((a, b) => a + b, 0) / count;

  // Die Sorten werden ZULETZT gewuerfelt. Das ist kein Schoenheitsfehler,
  // sondern Absicht: so bleiben Bedarf, Preis und Rente Zahl fuer Zahl
  // dieselben wie vor E2, und die gemessene Balance ist weiter vergleichbar.
  const strains = Array.from({ length: count }, (_, i) =>
    makeStrain(placeName(level, i), rng));

  return rawDemand.map((d, i) => {
    const demand = d * demandScale;
    const price = (rawPrice[i] ?? 1) * priceScale;
    // Die Rente haengt am Wert des Gebiets, streut aber eigenstaendig: manche
    // Staedte zahlen besser, als ihre Groesse vermuten laesst.
    const worth = demand * price;
    const strain = strains[i]!;
    // Die Rentensorte wirkt nur hier - deshalb wird sie gleich eingerechnet
    // statt spaeter als Sonderfall. Dadurch sieht die Zielwahl sie von allein.
    const rent = worth / BALANCE.levels.rentSeconds
      * ((rawRent[i] ?? 1) / rentMean) * rentFactor(strain);
    return createTerritory(i, placeName(level, i), demand, price, rent, strain);
  });
}
