// Example lesson. Copy this file for a new lesson and change the content; the engine reads only this shape.
// Numbers: every value is either cited (source) or marked example: true; stores with no number are qualitative.
import { P } from '../engine/ink.js';

const g = 9.8;                                // N/kg, GCSE value
const book = { m: 0.5, h: 1.2 };              // example book and shelf
const UNITS_PER_M = 4 / 1.2;                  // the drawn shelf is 4 units high

// --- the drawings: primitives with the base on y = 0, about 5 units wide, facing the reader (+z) ---
const wheel = (x) => P.torus(1.25, 0.14, [x, 1.25, 0]);
const things = [
  {
    id: 'cyclist', store: 'kinetic', name: 'a cyclist',
    parts: [wheel(-1.6), wheel(1.6),
      P.cyl(0.1, 0.1, 3.3, [0, 1.6, 0], [0, 0, Math.PI / 2 - 0.25]),
      P.cyl(0.1, 0.1, 1.9, [-0.7, 2.0, 0], [0, 0, -0.5]),
      { g: P.box(0.9, 1.6, 0.7, [-0.3, 3.2, 0], [0, 0, -0.35]), tone: 'shade' },
      P.sphere(0.45, [0.25, 4.3, 0])],
    work: { equation: 'Ek = ½ m v²', inputs: [
      { symbol: 'm', value: 70, unit: 'kg', label: 'mass of rider and bicycle', example: true },
      { symbol: 'v', value: 5, unit: 'm/s', label: 'cycling speed', example: true }],
      J: 0.5 * 70 * 5 * 5, note: 'example values' },
  },
  {
    id: 'book', store: 'gravitational', name: 'a book on a high shelf',
    parts: [
      { g: P.box(0.25, 4, 0.8, [-1.9, 2, 0]), tone: 'shade' },
      P.box(3.2, 0.2, 1.6, [-0.4, 3.9, 0]),
      { g: P.box(1.2, 1.5, 1.0, [-0.5, 4.75, 0]), tone: 'ink', group: 'book' }],
    work: { equation: 'Ep = m g h', inputs: [
      { symbol: 'm', value: book.m, unit: 'kg', label: 'mass of the book', example: true },
      { symbol: 'g', value: g, unit: 'N/kg', label: 'gravitational field strength' },
      { symbol: 'h', value: book.h, unit: 'm', label: 'height of the shelf', example: true }],
      J: book.m * g * book.h, note: 'drop the book to watch where its energy goes' },
  },
  {
    id: 'spring', store: 'elastic', name: 'a stretched spring',
    parts: [
      { g: P.tube(Array.from({ length: 60 }, (_, i) => [Math.cos(i * 0.75) * 0.7, 0.4 + i * 0.07, Math.sin(i * 0.75) * 0.7]), 0.08), edges: false },
      P.box(2.2, 0.3, 1.2, [0, 0.15, 0]), P.box(1, 0.6, 1, [0, 4.8, 0])],
    work: { equation: 'Ee = ½ k e²', inputs: [
      { symbol: 'k', value: 100, unit: 'N/m', label: 'spring constant', example: true },
      { symbol: 'e', value: 0.1, unit: 'm', label: 'extension', example: true }],
      J: 0.5 * 100 * 0.1 * 0.1, note: 'example values' },
  },
  {
    id: 'drink', store: 'thermal', name: 'a hot drink',
    parts: [P.cyl(1.2, 1.0, 2.6, [0, 1.3, 0]), P.torus(0.6, 0.14, [1.25, 1.4, 0]),
      { g: P.cyl(1.1, 1.1, 0.05, [0, 2.4, 0]), tone: 'shade' },
      { g: P.tube([[0, 2.7, 0], [0.3, 3.4, 0], [-0.2, 4.1, 0], [0.2, 4.8, 0]], 0.06), edges: false }],
    work: { equation: 'ΔE = m c Δθ', inputs: [
      { symbol: 'm', value: 0.25, unit: 'kg', label: 'mass of the drink', example: true },
      { symbol: 'c', value: 4200, unit: 'J/kg °C', label: 'specific heat capacity of water' },
      { symbol: 'Δθ', value: 60, unit: '°C', label: 'above room temperature', example: true }],
      J: 0.25 * 4200 * 60, note: 'thermal store counted from room temperature' },
  },
  {
    id: 'cell', store: 'chemical', name: 'an AA cell',
    parts: [P.cyl(0.75, 0.75, 4, [0, 2, 0], [0, 0, 0], 28), { g: P.cyl(0.3, 0.3, 0.3, [0, 4.15, 0]), tone: 'ink' },
      { g: P.cyl(0.77, 0.77, 1.2, [0, 3.2, 0], [0, 0, 0], 28), tone: 'shade' }],
    work: { equation: 'E = Q × V', inputs: [
      { symbol: 'Q', value: 2, unit: 'Ah', label: 'capacity (2 Ah = 7200 C)', example: true },
      { symbol: 'V', value: 1.5, unit: 'V', label: 'nominal voltage' }],
      J: 2 * 3600 * 1.5, note: 'an upper estimate: the voltage falls as the cell runs down' },
  },
  {
    id: 'magnets', store: 'magnetic', name: 'a pair of magnets',
    parts: [{ g: P.box(1.6, 1, 1, [-1.3, 0.5, 0]), tone: 'shade' }, P.box(1.6, 1, 1, [1.3, 0.5, 0]),
      { g: P.box(0.8, 1.02, 1.02, [-0.9, 0.5, 0]), tone: 'ink' }, { g: P.box(0.8, 1.02, 1.02, [0.9, 0.5, 0]), tone: 'ink' }],
    work: { qualitative: true, note: 'no number here: the jar lights without one' },
  },
  {
    id: 'balloon', store: 'electrostatic', name: 'a rubbed balloon',
    parts: [P.sphere(1.3, [0, 3.2, 0], [1, 1.2, 1]), { g: P.cone(0.2, 0.35, [0, 1.62, 0], [Math.PI, 0, 0]), tone: 'shade' },
      { g: P.tube([[0, 1.5, 0], [0.3, 1.0, 0], [-0.2, 0.5, 0], [0, 0, 0]], 0.04), edges: false }],
    work: { qualitative: true, note: 'no number here: the jar lights without one' },
  },
  {
    id: 'sun', store: 'nuclear', name: 'the Sun',
    parts: [P.sphere(1.5, [0, 2.6, 0], [1, 1, 1], 16),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return { g: P.cone(0.25, 0.9, [Math.cos(a) * 2.3, 2.6 + Math.sin(a) * 2.3, 0], [0, 0, a - Math.PI / 2]), tone: 'shade' };
      })],
    work: { equation: 'E = P t', inputs: [
      { symbol: 'P', value: 3.8e26, unit: 'W', label: 'power the Sun radiates' },
      { symbol: 't', value: 1, unit: 's', label: 'one second' }],
      J: 3.8e26, overflow: true, note: 'far too big for any jar: it holds one second of sunshine, and overflows' },
  },
];
// two rows of four on the left page (x, z relative to the page centre)
things.forEach((t, i) => { t.at = [(i % 4 - 1.5) * 6.6, i < 4 ? -4 : 8]; });

// --- the event: drop the book. Exact free fall, slowed so it can be watched; none of the 5.88 J is lost ---
function bookDrop() {
  const SLOW = 0.3, LAND = 0.25;
  const E0 = book.m * g * book.h;
  let s;
  const reset = () => { s = { phase: 'shelf', t: 0, push: 0, y: book.h, v: 0, k: 0 }; };
  reset();
  return {
    label: 'Drop the book',
    accounts: ['gravitational', 'kinetic', 'thermal'],
    capacity: E0 / 0.9,
    reset,
    start() { reset(); s.phase = 'push'; },
    get running() { return s.phase !== 'shelf' && s.phase !== 'rest'; },
    step(dt, L) {
      const h = dt * SLOW;
      s.t += dt;
      if (s.phase === 'push') { s.push = Math.min(1, s.push + dt * 2); if (s.push >= 1) { s.phase = 'fall'; s.t = 0; } }
      else if (s.phase === 'fall') {
        const tf = Math.sqrt((2 * book.h) / g);
        s.k = Math.min(tf, s.k + h);
        const y = book.h - 0.5 * g * s.k * s.k, v = g * s.k;
        const dEp = book.m * g * (s.y - Math.max(0, y));
        s.y = Math.max(0, y); s.v = v;
        L.move('gravitational', 'kinetic', dEp, h);
        if (s.k >= tf) { s.phase = 'land'; s.k = 0; }
      } else if (s.phase === 'land') {
        s.k = Math.min(LAND, s.k + h);
        const keep = E0 * (1 - s.k / LAND);
        L.move('kinetic', 'thermal', L.J.kinetic - keep, h);
        if (s.k >= LAND) { s.phase = 'rest'; s.v = 0; }
      }
    },
    begin(L) { L.set('gravitational', E0); L.set('kinetic', 0); L.set('thermal', 0); },
    pose(thing) {
      const b = thing.sub.book;
      b.position.x = s.phase === 'shelf' ? 0 : 2.6 * Math.min(1, s.push);
      b.position.y = (s.y - book.h) * UNITS_PER_M;
    },
    readout(L) {
      const f = (x) => (Math.abs(x) < 5e-3 ? 0 : x).toFixed(2);
      return `Ep ${f(L.J.gravitational)} J · Ek ${f(L.J.kinetic)} J · thermal ${f(L.J.thermal)} J · total ${f(L.total())} J`;
    },
    thing: 'book',
  };
}

export default {
  n: 1,
  title: 'Energy stores',
  folios: [4, 5],
  figure: 'Eight things, eight stores',
  explanation: [
    'Energy is held in eight kinds of store, and it moves between them.',
    'The jars are a model. Energy is not a fluid, but the jars help us count it.',
  ],
  equation: { symbols: 'E_p = m g h', words: 'gravitational potential energy = mass × gravitational field strength × height' },
  keywords: [
    { term: 'store', definition: 'a way energy is held, such as kinetic or thermal' },
    { term: 'system', definition: 'the object or objects we choose to study' },
    { term: 'joule (J)', definition: 'the unit of energy' },
  ],
  predict: { question: 'When the book falls off the shelf, where does its energy go?', options: ['It is used up', 'It moves to other stores'], answer: 1 },
  explain: 'As the book falls, its gravitational store empties and its kinetic store fills by the same amount. When it hits the page, that energy moves to the thermal stores of the book, the page and the air. The total never changes.',
  tryHint: 'Tap each drawing to light the jar of its store. Then drop the book.',
  challenge: { text: 'Light every jar: find all eight stores.', done: 'All eight stores found' },
  things,
  event: bookDrop(),
  watch: [
    { cam: { pos: [0, 62, 58], look: [0, 0, 0] }, hold: 1.2 },
    { cam: { pos: [-12, 18, 26], look: [-11, 3, 6] }, act: (L) => L.tap('drink') },
    { cam: { pos: [12, 20, 30], look: [14, 4, 2] }, act: (L) => L.tap('cell') },
    { cam: { pos: [-8, 20, 30], look: [-4, 4, -2] }, act: (L) => L.startEvent(), hold: 6 },
    { cam: null, hold: 0.5 },
  ],
};
