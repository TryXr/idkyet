/**
 * Die Namen der Gebiete - 15 je Zoomstufe.
 *
 * Echte Orte, weil der Witz in der Beiläufigkeit sitzt: die Lieferfrist nach
 * Ganymed wird genauso sachlich besprochen wie die nach Essen. Das ist eine
 * LISTE, kein Fließtext - der Deckel von 5 Stimmen-Zeilen je Stufe gilt davon
 * unberührt.
 *
 * Die Zahlen dahinter (Bedarf, Preis, Rente) kommen aus dem Seed, nicht von
 * Hand. Die Liste gibt das Thema, der Seed die Streuung.
 */
export const PLACES: ReadonlyArray<ReadonlyArray<string>> = [
  // 0 Ruhrgebiet - hier fängt alles an, in Duisburg
  [
    'Duisburg', 'Oberhausen', 'Mülheim', 'Essen', 'Gelsenkirchen',
    'Bochum', 'Herne', 'Dortmund', 'Bottrop', 'Recklinghausen',
    'Hagen', 'Hamm', 'Witten', 'Castrop-Rauxel', 'Gladbeck',
  ],
  // 1 Deutschland
  [
    'Düsseldorf', 'Köln', 'Frankfurt', 'Stuttgart', 'München',
    'Nürnberg', 'Hannover', 'Bremen', 'Hamburg', 'Berlin',
    'Leipzig', 'Dresden', 'Mannheim', 'Karlsruhe', 'Kiel',
  ],
  // 2 Europa
  [
    'Niederlande', 'Belgien', 'Frankreich', 'Schweiz', 'Österreich',
    'Italien', 'Spanien', 'Portugal', 'Polen', 'Tschechien',
    'Dänemark', 'Schweden', 'Norwegen', 'Großbritannien', 'Griechenland',
  ],
  // 3 Welt
  [
    'Nordamerika', 'Mexiko', 'Brasilien', 'Argentinien', 'Westafrika',
    'Nordafrika', 'Ostafrika', 'Südafrika', 'Naher Osten', 'Russland',
    'Indien', 'China', 'Japan', 'Südostasien', 'Australien',
  ],
  // 4 Erdorbit
  [
    'Niedriger Orbit', 'Mittlerer Orbit', 'Geostationär', 'Polarbahn', 'Molnija-Bahn',
    'Lagrange 1', 'Lagrange 2', 'Lagrange 4', 'Lagrange 5', 'Friedhofsorbit',
    'Werft Tiangong', 'Solarfarm Helios', 'Zollstation Ost', 'Schrottplatz Kessler', 'Hotel Zarja',
  ],
  // 5 Mond & Mars
  [
    'Mare Tranquillitatis', 'Shackleton', 'Kopernikus', 'Tycho', 'Mare Imbrium',
    'Olympus Mons', 'Valles Marineris', 'Hellas', 'Jezero', 'Utopia Planitia',
    'Elysium', 'Chryse', 'Arsia Mons', 'Phobos', 'Deimos',
  ],
  // 6 Äußeres System
  [
    'Ceres', 'Vesta', 'Pallas', 'Hygiea', 'Io',
    'Europa', 'Ganymed', 'Kallisto', 'Titan', 'Enceladus',
    'Iapetus', 'Titania', 'Triton', 'Charon', 'Eris',
  ],
  // 7 Interstellar
  [
    'Proxima Centauri', 'Alpha Centauri', 'Barnards Pfeil', 'Wolf 359', 'Sirius',
    'Epsilon Eridani', 'Tau Ceti', 'Trappist-1', 'Gliese 581', 'Kepler-186',
    'Vega', 'Altair', 'Prokyon', 'Ross 128', '61 Cygni',
  ],
];

/** Name eines Gebiets. Fehlt einer, faellt es auf eine Nummer zurueck. */
export function placeName(level: number, index: number): string {
  return PLACES[level]?.[index] ?? `Gebiet ${index + 1}`;
}
