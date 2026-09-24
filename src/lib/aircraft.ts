/**
 * Side-profile specs for common airliners, used to draw a livery-free silhouette of each
 * aircraft type. Dimensions are approximate real values in metres; the shape flags capture
 * what visually tells the families apart.
 */
export interface AircraftSpec {
  /** Overall length (m). */
  length: number
  /** Fuselage height (m) — for the A380 this covers both decks. */
  diameter: number
  engines: 'wing2' | 'wing4' | 'tail2' | 'tail3' | 'prop2'
  wing: 'low' | 'high'
  tail: 'low' | 'T'
  nose: 'airbus' | 'boeing' | 'b787' | 'a350' | 'regional'
  deck: 'single' | 'hump' | 'double'
  winglet: 'none' | 'fence' | 'blended' | 'sharklet' | 'split' | 'curved'
  /** Engine nacelle diameter relative to the fuselage. */
  engineScale: number
}

type Base = Omit<AircraftSpec, 'length'>

const A320: Base = {
  diameter: 3.95,
  engines: 'wing2',
  wing: 'low',
  tail: 'low',
  nose: 'airbus',
  deck: 'single',
  winglet: 'fence',
  engineScale: 0.5,
}
const A320NEO: Base = { ...A320, winglet: 'sharklet', engineScale: 0.56 }
const A220: Base = { ...A320, diameter: 3.7, nose: 'regional', winglet: 'none', engineScale: 0.55 }
const A300: Base = { ...A320, diameter: 5.64, winglet: 'fence', engineScale: 0.5 }
const A330: Base = { ...A300, winglet: 'blended' }
const A330NEO: Base = { ...A300, winglet: 'curved', engineScale: 0.58 }
const A340: Base = { ...A330, engines: 'wing4', engineScale: 0.36 }
const A350: Base = { ...A300, diameter: 5.96, nose: 'a350', winglet: 'curved', engineScale: 0.55 }
const A380: Base = { ...A300, diameter: 8.4, deck: 'double', engines: 'wing4', engineScale: 0.36 }
const B737: Base = {
  ...A320,
  diameter: 3.76,
  nose: 'boeing',
  winglet: 'blended',
  engineScale: 0.46,
}
const B737CLASSIC: Base = { ...B737, winglet: 'none', engineScale: 0.44 }
const B737MAX: Base = { ...B737, winglet: 'split', engineScale: 0.5 }
const B747: Base = {
  ...B737,
  diameter: 6.5,
  deck: 'hump',
  engines: 'wing4',
  engineScale: 0.38,
}
const B757: Base = { ...B737, engineScale: 0.5, winglet: 'none' }
const B767: Base = { ...B737, diameter: 5.03, engineScale: 0.5, winglet: 'none' }
const B777: Base = { ...B737, diameter: 6.2, engineScale: 0.58, winglet: 'none' }
const B787: Base = { ...B737, diameter: 5.77, nose: 'b787', engineScale: 0.52, winglet: 'none' }
const MD80: Base = {
  ...A320,
  diameter: 3.34,
  engines: 'tail2',
  tail: 'T',
  nose: 'boeing',
  winglet: 'none',
  engineScale: 0.4,
}
const MD11: Base = { ...A300, diameter: 6.0, engines: 'tail3', nose: 'boeing', engineScale: 0.45 }
const EJET: Base = {
  ...A320,
  diameter: 3.0,
  nose: 'regional',
  winglet: 'blended',
  engineScale: 0.5,
}
const ERJ: Base = { ...MD80, diameter: 2.28, nose: 'regional', engineScale: 0.5 }
const CRJ: Base = {
  ...MD80,
  diameter: 2.69,
  nose: 'regional',
  winglet: 'blended',
  engineScale: 0.48,
}
const TURBOPROP: Base = {
  ...A320,
  diameter: 2.6,
  engines: 'prop2',
  wing: 'high',
  tail: 'T',
  nose: 'regional',
  winglet: 'none',
  engineScale: 0.45,
}
const BAE146: Base = { ...TURBOPROP, diameter: 3.56, engines: 'wing4', engineScale: 0.36 }

/** Most specific patterns first; matched against the lower-cased type name without spaces. */
const CATALOG: [RegExp, Base, number][] = [
  [/a318/, A320, 31.4],
  [/a319neo/, A320NEO, 33.8],
  [/a319/, A320, 33.8],
  [/a320neo/, A320NEO, 37.6],
  [/a320/, A320, 37.6],
  [/a321neo|a321lr|a321xlr/, A320NEO, 44.5],
  [/a321/, A320, 44.5],
  [/a220-?100|cs100/, A220, 35],
  [/a220|cs300/, A220, 38.7],
  [/a300/, A300, 54.1],
  [/a310/, A300, 46.7],
  [/a330-?8/, A330NEO, 58.8],
  [/a330-?9|a330neo/, A330NEO, 63.7],
  [/a330-?2/, A330, 58.8],
  [/a330/, A330, 63.7],
  [/a340-?5/, A340, 67.9],
  [/a340-?6/, A340, 75.4],
  [/a340/, A340, 63.7],
  [/a350-?10/, A350, 73.8],
  [/a350/, A350, 66.8],
  [/a380/, A380, 72.7],
  [/737-?max-?7|737-?7\b|7m7/, B737MAX, 35.6],
  [/737-?max-?10|737-?10|7m10/, B737MAX, 43.8],
  [/737-?max-?9|737-?9\b|7m9/, B737MAX, 42.2],
  [/737-?max|737-?8\b|7m8/, B737MAX, 39.5],
  [/737-?3/, B737CLASSIC, 33.4],
  [/737-?4/, B737CLASSIC, 36.4],
  [/737-?5/, B737CLASSIC, 31],
  [/737-?6/, B737, 31.2],
  [/737-?7/, B737, 33.6],
  [/737-?9/, B737, 42.1],
  [/737/, B737, 39.5],
  [/747-?8/, { ...B747, winglet: 'none' }, 76.3],
  [/747sp/, B747, 56.3],
  [/747/, B747, 70.7],
  [/757-?3/, B757, 54.4],
  [/757/, B757, 47.3],
  [/767-?2/, B767, 48.5],
  [/767-?4/, B767, 61.4],
  [/767/, B767, 54.9],
  [/777-?(9|x)/, B777, 76.7],
  [/777-?8\b/, B777, 70.9],
  [/777-?3/, B777, 73.9],
  [/777/, B777, 63.7],
  [/787-?10/, B787, 68.3],
  [/787-?9/, B787, 62.8],
  [/787/, B787, 56.7],
  [/717/, MD80, 37.8],
  [/md-?11/, MD11, 61.6],
  [/dc-?10/, MD11, 55.5],
  [/md-?8\d|md-?90/, MD80, 45.1],
  [/dc-?9/, MD80, 36.4],
  // Before the ERJ patterns: "superjet" contains "erj".
  [/superjet|ssj/, { ...A220, diameter: 3.46 }, 29.9],
  [/(e|erj|embraer)-?170/, EJET, 29.9],
  [/(e|erj|embraer)-?175/, EJET, 31.7],
  [/(e|erj|embraer)-?190/, EJET, 36.2],
  [/(e|erj|embraer)-?195/, EJET, 38.7],
  [/(erj|emb|embraer)-?135/, ERJ, 26.3],
  [/(erj|emb|embraer)-?140/, ERJ, 28.5],
  [/erj|(emb|embraer)-?145/, ERJ, 29.9],
  [/embraer/, EJET, 36.2],
  [/crj-?10/, CRJ, 39.1],
  [/crj-?[12]/, CRJ, 26.8],
  [/crj-?7/, CRJ, 32.3],
  [/crj-?9/, CRJ, 36.4],
  [/crj|canadairregional/, CRJ, 32.3],
  [/atr-?42/, TURBOPROP, 22.7],
  [/atr/, TURBOPROP, 27.2],
  [/q400|dash-?8-?400|dhc-?8-?4/, { ...TURBOPROP, diameter: 2.69 }, 32.8],
  [/dash-?8|dhc-?8|q[123]00/, { ...TURBOPROP, diameter: 2.69 }, 25.7],
  [/saab|fokker50|f50|jetstream|dornier|twinotter|dhc-?6|turboprop/, TURBOPROP, 20],
  [/fokker-?(70|100)|f100|f70/, { ...MD80, diameter: 3.3, nose: 'regional' }, 35.5],
  [/bae146|avro|rj(70|85|100)/, BAE146, 28.6],
  [/c919/, A320NEO, 38.9],
  [/arj21|c909/, { ...CRJ, diameter: 3.3 }, 33.5],
]

/** Generic narrow-body used when the type isn't recognised. */
const FALLBACK: AircraftSpec = { ...A320, length: 37.6 }

export function aircraftSpec(name: string): AircraftSpec {
  const key = name.toLowerCase().replace(/\s+/g, '')
  for (const [re, base, length] of CATALOG) if (re.test(key)) return { ...base, length }
  return FALLBACK
}
