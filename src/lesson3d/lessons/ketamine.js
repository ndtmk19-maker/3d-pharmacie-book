// Lesson: the classic four-step synthesis of ketamine (C. L. Stevens, Parke-Davis), as drawn in the user's scheme.
// Conceptual only: reaction types and what happens to two tracked carbon atoms. No laboratory conditions.
// Numbers: there are no measured quantities here. The jars count atoms (0 or 1), so nothing needs a source
// beyond the structures and formulas, which are cited in `sources`.
import * as THREE from 'three';
import { P } from '../engine/ink.js';
import { tr } from '../i18n.js';
import reaction, { STEPS, TYPES } from './ketamine-reaction.js';

// ---------- drawing helpers: 2D skeletal formulas extruded into ink-drawn 3D models ----------
const BOND_R = 0.075;
const up = new THREE.Vector3(0, 1, 0);
function bondGeo(a, b, r = BOND_R) {
  const A = new THREE.Vector3(a[0], a[1], 0), B = new THREE.Vector3(b[0], b[1], 0);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 10);
  const q = new THREE.Quaternion().setFromUnitVectors(up, B.clone().sub(A).normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), q, new THREE.Vector3(1, 1, 1)));
}
// n = 1 single, 2 double, 3 triple; `inner` offsets the second line toward a ring centre
const bp = (a, b, r) => ({ g: bondGeo(a, b, r), edges: false, seg: [[a[0], a[1], 0], [b[0], b[1], 0]] });
function bond(a, b, n = 1, inner = null) {
  const parts = [];
  if (n === 1) return [bp(a, b)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  let nx = -dy / L, ny = dx / L;
  if (inner) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if ((inner[0] - mx) * nx + (inner[1] - my) * ny < 0) { nx = -nx; ny = -ny; }
    const o = 0.2, s = 0.18;
    const a2 = [a[0] + nx * o + dx / L * s, a[1] + ny * o + dy / L * s];
    const b2 = [b[0] + nx * o - dx / L * s, b[1] + ny * o - dy / L * s];
    return [bp(a, b), bp(a2, b2, BOND_R * 0.85)];
  }
  const offs = n === 2 ? [-0.09, 0.09] : [-0.15, 0, 0.15];
  for (const o of offs) parts.push(bp([a[0] + nx * o, a[1] + ny * o], [b[0] + nx * o, b[1] + ny * o], BOND_R * 0.8));
  return parts;
}
const ringPts = (n, c, start) => Array.from({ length: n }, (_, i) => {
  const R = 1 / (2 * Math.sin(Math.PI / n));                      // bond length 1
  const a = start + (i * 2 * Math.PI) / n;
  return [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
});
const D = Math.PI / 180;
const at = (p, deg, L = 1) => [p[0] + Math.cos(deg * D) * L, p[1] + Math.sin(deg * D) * L];

// Molecule builder: collects bonds and atoms in 2D, then centres it, sits it on y = 0 and fits it to the page cell.
function molecule() {
  const bonds = [], atoms = [];
  const m = {
    bond(a, b, n, inner) { bonds.push({ a, b, n, inner }); return m; },
    ring(pts, doubles = [], centre = null) {
      pts.forEach((p, i) => m.bond(p, pts[(i + 1) % pts.length], doubles.includes(i) ? 2 : 1, centre));
      return m;
    },
    atom(p, text, opts = {}) { atoms.push({ p, text, ...opts }); return m; },
    build(maxW = 5.2, maxH = 4.4) {
      const xs = [], ys = [];
      for (const b of bonds) { xs.push(b.a[0], b.b[0]); ys.push(b.a[1], b.b[1]); }
      for (const a of atoms) { xs.push(a.p[0]); ys.push(a.p[1]); }
      const pad = 0.45;
      const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
      const k = Math.min(1.25, maxW / (x1 - x0), maxH / (y1 - y0));
      const T = (p) => [(p[0] - (x0 + x1) / 2) * k, (p[1] - y0) * k + 0.25];
      const parts = [], strokes = [];
      // a thin plinth so each drawing has a baseline to stand on
      parts.push({ g: P.box((x1 - x0) * k * 0.9, 0.18, 0.9, [0, 0.09, 0]), tone: 'shade' });
      for (const b of bonds) {
        // shorten bonds that end at a lettered atom so the letter sits in clear space
        let A = T(b.a), B = T(b.b);
        const trim = (P0, P1, hit) => {
          if (!hit) return P0;
          // clear more space for wider labels (CH₃, NH₂) than for single letters
          const d = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]); const s = ((0.2 + 0.12 * hit.text.length) * k) / d;
          return [P0[0] + (P1[0] - P0[0]) * s, P0[1] + (P1[1] - P0[1]) * s];
        };
        const isLab = (p) => atoms.find((a) => !a.bare && a.text && a.p[0] === p[0] && a.p[1] === p[1]);
        const A2 = trim(A, B, isLab(b.a)), B2 = trim(B, A, isLab(b.b));
        const bs = bond(A2, B2, b.n ?? 1, b.inner ? T(b.inner) : null);
        parts.push(...bs);
        for (const q of bs) strokes.push(q.seg);
      }
      parts.push({ lines: strokes });
      for (const a of atoms) {
        const p = T(a.p);
        // tracked atoms: an accent dot on the vertex and the label set off to one side
        if (a.mark) parts.push({ g: P.sphere(0.17, [p[0], p[1], 0], [1, 1, 1], 14), tone: 'accent', edges: false });
        const off = a.off ? [Math.cos(a.off * D) * 0.62 * k, Math.sin(a.off * D) * 0.62 * k] : [0, 0];
        if (a.text) parts.push({ label: a.text, pos: [p[0] + off[0], p[1] + off[1], 0.12], size: (a.size ?? 0.62) * Math.max(0.85, k), color: a.color });
      }
      return parts;
    },
  };
  return m;
}

const ACC = '#9a3b2a';
// Aryl: o-chlorophenyl, ring centred at c, attachment vertex pointing at angle `att`, Cl on the neighbour at att - 60
function aryl(m, c, att, clSide = -60) {
  const pts = ringPts(6, c, att * D);
  m.ring(pts, [1, 3, 5], c);
  const cl = pts[clSide < 0 ? 5 : 1];
  const clEnd = at(cl, att + clSide);
  m.bond(cl, clEnd).atom(clEnd, 'Cl');
  return pts[0];
}
function cyclopentyl(m, attach, dir) {
  // pentagon whose first vertex is `attach`, opening along `dir` degrees
  const R = 1 / (2 * Math.sin(Math.PI / 5));
  const c = at(attach, dir, R);
  const pts = ringPts(5, c, (dir + 180) * D);
  m.ring(pts);
  return { c, pts };
}

// 1. 2-chlorobenzonitrile
function mNitrile() {
  const m = molecule();
  const v = aryl(m, [0, 0], 30);
  const C = at(v, 30), N = at(C, 30);
  m.bond(v, C).bond(C, N, 3).atom(C, 'C*', { color: ACC, size: 0.48, mark: true, bare: true, off: -60 }).atom(N, 'N');
  return m.build();
}
// 2. cyclopentylmagnesium bromide
function mGrignard() {
  const m = molecule();
  const { pts } = cyclopentyl(m, [0, 0], -90);
  const Mg = at(pts[0], 90, 1.2), Br = at(Mg, 0, 1.7);
  m.bond(pts[0], Mg).bond(Mg, Br).atom(Mg, 'Mg').atom(Br, 'Br').atom(pts[0], 'Cα', { color: ACC, size: 0.48, mark: true, bare: true, off: 180 });
  return m.build();
}
// shared aryl–C*(=X)–Cα(cyclopentyl) skeleton for steps 1–3
function arylKetoneLike(top, topLabel, alpha) {
  const m = molecule();
  const v = aryl(m, [0, 0], 30);
  const C = at(v, 30);
  const X = at(C, 90);
  m.bond(v, C).bond(C, X, 2).atom(X, topLabel).atom(C, 'C*', { color: ACC, size: 0.44, mark: true, bare: true, off: 150 });
  if (top) { const Me = at(X, 150, 1.7); m.bond(X, Me).atom(Me, 'CH₃', { size: 0.5 }); }
  const Ca = at(C, -30);
  m.bond(C, Ca);
  cyclopentyl(m, Ca, -30);
  m.atom(Ca, 'Cα', { color: ACC, size: 0.44, mark: true, bare: true, off: -147 });
  if (alpha) { const S = at(Ca, 85, 1.1); m.bond(Ca, S).atom(S, alpha); }
  return m.build();
}
const mKetone = () => arylKetoneLike(false, 'O', null);
const mBromo = () => arylKetoneLike(false, 'O', 'Br');
const mImine = () => arylKetoneLike(true, 'N', 'OH');
function mBr2() {
  const m = molecule();
  m.bond([0, 0], [1.7, 0]).atom([0, 0], 'Br').atom([1.7, 0], 'Br');
  return m.build(3.2, 2.2);
}
function mMethylamine() {
  const m = molecule();
  m.bond([0, 0], [1.9, 0]).atom([0, 0], 'H₃C', { size: 0.55 }).atom([1.9, 0], 'NH₂', { size: 0.55 });
  return m.build(3.6, 2.2);
}
// 4. ketamine: 2-(2-chlorophenyl)-2-(methylamino)cyclohexan-1-one
function mKetamine() {
  const m = molecule();
  const v = aryl(m, [0, 0], 0, -60);
  const C2 = at(v, 0);                                       // the old C*: now in the ring, bearing aryl and NHMe
  const c = at(C2, -30);                                     // cyclohexane centre (circumradius = bond length)
  const pts = ringPts(6, c, 150 * D);                        // pts[0] = C2, pts[5] = its upper-right neighbour
  m.ring(pts);
  const C1 = pts[5];                                         // the old Cα: now the ring C=O
  const O = at(C1, 90);
  m.bond(C1, O, 2).atom(O, 'O');
  const N = at(C2, 105, 1.15), Me = at(N, 90, 1.7);
  m.bond(C2, N).bond(N, Me).atom(N, 'NH').atom(Me, 'CH₃', { size: 0.5 });
  m.atom(C2, 'C*', { color: ACC, size: 0.44, mark: true, bare: true, off: 225 })
    .atom(C1, 'Cα', { color: ACC, size: 0.44, mark: true, bare: true, off: 15 });
  return m.build();
}

// ---------- the jars: the state of two tracked atoms ----------
// Row 1: C*, the nitrile carbon. Row 2: Cα, the cyclopentyl carbon bonded to Mg in the Grignard reagent.
const jars = [
  { id: 'c_nitrile', name: { fr: 'C* · nitrile', ar: 'C* · نتريل', en: 'C* · nitrile' }, color: '#2f7bff' },
  { id: 'c_ketone', name: { fr: 'C* · cétone', ar: 'C* · كيتون', en: 'C* · ketone' }, color: '#26c75a' },
  { id: 'c_imine', name: { fr: 'C* · imine', ar: 'C* · إيمين', en: 'C* · imine' }, color: '#8a4dff' },
  { id: 'c_ring', name: { fr: 'C* · cycle, C–N', ar: 'C* · حلقة، C–N', en: 'C* · ring, C–N' }, color: '#ff3fb4' },
  { id: 'a_h', name: { fr: 'Cα · C–H', ar: 'Cα · C–H', en: 'Cα · C–H' }, color: '#18c4dc' },
  { id: 'a_br', name: { fr: 'Cα · C–Br', ar: 'Cα · C–Br', en: 'Cα · C–Br' }, color: '#e8233a' },
  { id: 'a_oh', name: { fr: 'Cα · C–OH', ar: 'Cα · C–OH', en: 'Cα · C–OH' }, color: '#ff7a1c' },
  { id: 'a_co', name: { fr: 'Cα · C=O du cycle', ar: 'Cα · C=O في الحلقة', en: 'Cα · ring C=O' }, color: '#ffcf1a' },
].map((j) => ({ ...j, name: tr(j.name) }));
const jarName = Object.fromEntries(jars.map((j) => [j.id, j.name]));

// ---------- the things on the left page ----------
const L = (fr, ar, en) => tr({ fr, ar, en });
const things = [
  {
    id: 'nitrile', store: 'c_nitrile', parts: mNitrile(),
    name: L('2-chlorobenzonitrile', '2-كلوروبنزونتريل', '2-chlorobenzonitrile'),
    formula: 'C₇H₄ClN',
    note: L('Point de départ. C* est le carbone du nitrile C≡N : électrophile, il sera attaqué par le Grignard.',
      'نقطة البداية. C* هو كربون مجموعة النتريل C≡N، وهو إلكتروفيلي وسيهاجمه كاشف غرينيارد.',
      'The starting point. C* is the nitrile carbon, C≡N: electrophilic, it is attacked by the Grignard reagent.'),
  },
  {
    id: 'grignard', store: 'a_h', parts: mGrignard(),
    name: L('bromure de cyclopentylmagnésium', 'بروميد سيكلوبنتيل المغنيسيوم', 'cyclopentylmagnesium bromide'),
    formula: 'C₅H₉MgBr',
    note: L('Cα est lié à Mg : la liaison C–Mg est polarisée, Cα est nucléophile. Il porte aussi un H, qu’il garde jusqu’à l’étape 2.',
      'Cα مرتبط بالمغنيسيوم: الرابطة C–Mg مستقطبة فيكون Cα نيوكليوفيلياً. ويحمل أيضاً ذرة H يحتفظ بها حتى الخطوة 2.',
      'Cα is bonded to Mg: the C–Mg bond is polarised, so Cα is nucleophilic. It also carries an H, which it keeps until step 2.'),
  },
  {
    id: 'ketone', store: 'c_ketone', parts: mKetone(),
    name: L('2-chlorophényl cyclopentyl cétone', '2-كلوروفينيل سيكلوبنتيل كيتون', '2-chlorophenyl cyclopentyl ketone'),
    formula: 'C₁₂H₁₃ClO',
    note: L('Étape 1. Cα s’additionne sur C* ; l’hydrolyse de l’imine intermédiaire donne la cétone. C* et Cα sont maintenant liés.',
      'الخطوة 1. يضاف Cα إلى C*، ثم يعطي التحلل المائي للإيمين الوسيط كيتوناً. أصبح C* وCα مرتبطين.',
      'Step 1. Cα adds to C*; hydrolysis of the intermediate imine gives the ketone. C* and Cα are now bonded.'),
  },
  {
    id: 'br2', store: 'a_br', parts: mBr2(),
    name: L('dibrome', 'البروم', 'bromine'),
    formula: 'Br₂',
    note: L('Étape 2. Br₂ remplace l’H de Cα, le carbone en α du C=O : c’est une α-bromation.',
      'الخطوة 2. يحل Br₂ محل ذرة H على Cα، وهو الكربون ألفا المجاور لـ C=O: هذه هلجنة ألفا.',
      'Step 2. Br₂ replaces the H on Cα, the carbon alpha to C=O: an α-bromination.'),
  },
  {
    id: 'bromo', store: 'a_br', parts: mBromo(),
    name: L('α-bromocétone', 'ألفا-بروموكيتون', 'α-bromo ketone'),
    formula: 'C₁₂H₁₂BrClO',
    note: L('Cα porte maintenant Br. C* est toujours le carbone de la cétone.',
      'يحمل Cα الآن ذرة Br، وما زال C* كربون الكيتون.',
      'Cα now carries Br. C* is still the ketone carbon.'),
  },
  {
    id: 'methylamine', store: 'c_imine', parts: mMethylamine(),
    name: L('méthylamine', 'ميثيل أمين', 'methylamine'),
    formula: 'CH₃NH₂',
    note: L('Étape 3. L’amine primaire transforme C*=O en imine C*=N–CH₃, et Br sur Cα est remplacé par OH.',
      'الخطوة 3. يحوّل الأمين الأولي C*=O إلى إيمين C*=N–CH₃، ويُستبدل Br على Cα بمجموعة OH.',
      'Step 3. The primary amine turns C*=O into the imine C*=N–CH₃, and the Br on Cα is replaced by OH.'),
  },
  {
    id: 'imine', store: 'a_oh', parts: mImine(),
    name: L('α-hydroxy-imine', 'ألفا-هيدروكسي إيمين', 'α-hydroxy imine'),
    formula: 'C₁₃H₁₆ClNO',
    note: L('1-hydroxycyclopentyl (2-chlorophényl) cétone N-méthylimine. Même formule brute que la kétamine : ce sont des isomères.',
      '1-هيدروكسي سيكلوبنتيل (2-كلوروفينيل) كيتون N-ميثيل إيمين. صيغته الجزيئية هي نفسها صيغة الكيتامين: هما متصاوغان.',
      '1-hydroxycyclopentyl (2-chlorophenyl) ketone N-methylimine. Same molecular formula as ketamine: they are isomers.'),
  },
  {
    id: 'ketamine', store: 'c_ring', parts: mKetamine(),
    name: L('kétamine', 'الكيتامين', 'ketamine'),
    formula: 'C₁₃H₁₆ClNO',
    note: L('Étape 4 (chauffage). 2-(2-chlorophényl)-2-(méthylamino)cyclohexan-1-one. C* est entré dans le cycle à six ; Cα porte le C=O.',
      'الخطوة 4 (تسخين). 2-(2-كلوروفينيل)-2-(ميثيل أمينو)هكسانون حلقي. دخل C* الحلقة السداسية، ويحمل Cα مجموعة C=O.',
      'Step 4 (heat). 2-(2-chlorophenyl)-2-(methylamino)cyclohexan-1-one. C* has joined the six-membered ring; Cα carries the C=O.'),
  },
];
// two rows of four on the left page, in reading order of the scheme
things.forEach((t, i) => { t.at = [(i % 4 - 1.5) * 6.6, i < 4 ? -4 : 9]; });

// ---------- the event: run the four steps and follow the two atoms ----------
// The ledger holds one unit per tracked atom; each step moves it to its new state, so the total stays 2.
function synthesis() {
  const STEPS = [
    { label: L('Grignard + nitrile → cétone', 'غرينيارد + نتريل → كيتون', 'Grignard + nitrile → ketone'), moves: [['c_nitrile', 'c_ketone']], show: 'ketone' },
    { label: L('α-bromation (Br₂)', 'هلجنة ألفا (Br₂)', 'α-bromination (Br₂)'), moves: [['a_h', 'a_br']], show: 'bromo' },
    { label: L('CH₃NH₂ → α-hydroxy-imine', 'CH₃NH₂ → ألفا-هيدروكسي إيمين', 'CH₃NH₂ → α-hydroxy imine'), moves: [['c_ketone', 'c_imine'], ['a_br', 'a_oh']], show: 'imine' },
    { label: L('chauffage → réarrangement, cycle 5 → 6', 'تسخين → إعادة ترتيب، حلقة 5 → 6', 'heat → rearrangement, ring 5 → 6'), moves: [['c_imine', 'c_ring'], ['a_oh', 'a_co']], show: 'ketamine' },
  ];
  const PAUSE = 0.9, MOVE = 1.6;          // seconds of rest, seconds of transfer per step
  let s;
  const reset = () => { s = { phase: 'idle', i: 0, t: 0, done: 0 }; };
  reset();
  return {
    label: L('Lancer la synthèse', 'ابدأ التحضير', 'Run the synthesis'),
    accounts: jars.map((j) => j.id),
    capacity: 1 / 0.9,
    unitLabel: true,
    peakWatts: 1 / MOVE,
    thing: 'nitrile',
    reset,
    start() { reset(); s.phase = 'pause'; },
    get running() { return s.phase === 'pause' || s.phase === 'move'; },
    get litThing() { return s.phase === 'idle' ? null : s.i === 0 && s.phase === 'pause' ? 'nitrile' : STEPS[Math.min(s.i, 3)].show; },
    begin(Lg) { for (const a of this.accounts) Lg.set(a, 0); Lg.set('c_nitrile', 1); Lg.set('a_h', 1); },
    step(dt, Lg) {
      if (s.phase === 'pause') { s.t += dt; if (s.t >= PAUSE) { s.phase = 'move'; s.t = 0; s.done = 0; } }
      else if (s.phase === 'move') {
        s.t = Math.min(MOVE, s.t + dt);
        const target = s.t / MOVE, amt = target - s.done;
        s.done = target;
        for (const [from, to] of STEPS[s.i].moves) Lg.move(from, to, amt, dt);
        if (s.t >= MOVE) {
          for (const [from, to] of STEPS[s.i].moves) { Lg.set(to, 1); Lg.set(from, 0); }  // land exactly on 0 / 1
          s.i++; s.t = 0;
          s.phase = s.i >= STEPS.length ? 'rest' : 'pause';
          if (s.phase === 'rest') s.i = 3;
        }
      }
    },
    pose() {},
    readout(Lg) {
      const where = (prefix) => {
        const id = this.accounts.filter((a) => a.startsWith(prefix)).reduce((a, b) => (Lg.J[b] > Lg.J[a] ? b : a));
        return jarName[id];
      };
      const n = s.phase === 'rest' ? 4 : s.i + (s.phase === 'move' ? 1 : 0);
      const step = n === 0 ? L('départ', 'البداية', 'start') : `${L('étape', 'الخطوة', 'step')} ${n}/4 · ${STEPS[n - 1].label}`;
      return `${step} — ${where('c_')} · ${where('a_')} · ${L('atomes suivis', 'الذرات المتتبَّعة', 'atoms tracked')} : ${Lg.total().toFixed(0)}`;
    },
  };
}

export default {
  n: 1,
  folios: [12, 13],
  title: L('Synthèse de la kétamine', 'تحضير الكيتامين', 'The synthesis of ketamine'),
  figure: L('Deux atomes, quatre étapes', 'ذرتان وأربع خطوات', 'Two atoms, four steps'),
  jarsTitle: L('Les deux atomes suivis', 'الذرتان المتتبَّعتان', 'The two tracked atoms'),
  jarsCaption: L('En haut, C* (le carbone du nitrile). En bas, Cα.', 'في الأعلى C* (كربون النتريل)، وفي الأسفل Cα.', 'Top row: C* (the nitrile carbon). Bottom row: Cα.'),
  explanation: [
    L('La kétamine est préparée en quatre étapes à partir du 2-chlorobenzonitrile et du bromure de cyclopentylmagnésium.',
      'يُحضَّر الكيتامين في أربع خطوات انطلاقاً من 2-كلوروبنزونتريل وبروميد سيكلوبنتيل المغنيسيوم.',
      'Ketamine is made in four steps from 2-chlorobenzonitrile and cyclopentylmagnesium bromide.'),
    L('Suivez deux carbones : C*, le carbone du nitrile, et Cα, le carbone du cyclopentyle qui s’y lie. Leur groupe fonctionnel change à chaque étape.',
      'تتبّع ذرتي كربون: C* كربون النتريل، وCα كربون السيكلوبنتيل الذي يرتبط به. تتغير المجموعة الوظيفية لكل منهما في كل خطوة.',
      'Follow two carbons: C*, the nitrile carbon, and Cα, the cyclopentyl carbon that bonds to it. Their functional group changes at every step.'),
    L('À la dernière étape, la chaleur provoque un réarrangement : le cycle à cinq devient un cycle à six.',
      'في الخطوة الأخيرة يسبّب التسخين إعادة ترتيب: تتحول الحلقة الخماسية إلى حلقة سداسية.',
      'In the last step, heat causes a rearrangement: the five-membered ring becomes a six-membered ring.'),
  ],
  equation: {
    symbols: 'C₇H₄ClN + C₅H₉MgBr → … → C₁₃H₁₆ClNO',
    words: L('Grignard → α-bromation → imine (CH₃NH₂) → réarrangement α-iminol (chauffage)',
      'غرينيارد ← هلجنة ألفا ← إيمين (CH₃NH₂) ← إعادة ترتيب ألفا-إيمينول (تسخين)',
      'Grignard → α-bromination → imine (CH₃NH₂) → α-iminol rearrangement (heat)'),
  },
  keywords: [
    { term: L('organomagnésien (Grignard)', 'مركّب عضوي مغنيسيومي (غرينيارد)', 'Grignard reagent'),
      definition: L('R–MgBr ; le carbone lié à Mg est nucléophile et s’additionne sur un carbone électrophile (ici, celui du nitrile).',
        'R–MgBr؛ الكربون المرتبط بالمغنيسيوم نيوكليوفيلي ويضاف إلى كربون إلكتروفيلي (هنا كربون النتريل).',
        'R–MgBr; the carbon bonded to Mg is nucleophilic and adds to an electrophilic carbon (here the nitrile carbon).') },
    { term: L('α-bromation', 'هلجنة ألفا', 'α-bromination'),
      definition: L('remplacement d’un H par Br sur le carbone voisin d’un C=O.',
        'استبدال ذرة H بذرة Br على الكربون المجاور لمجموعة C=O.',
        'replacing an H with Br on the carbon next to a C=O.') },
    { term: L('imine', 'إيمين', 'imine'),
      definition: L('groupe C=N, formé par une amine primaire et un carbonyle.',
        'مجموعة C=N، تتكوّن من أمين أولي ومجموعة كربونيل.',
        'a C=N group, formed from a primary amine and a carbonyl.') },
    { term: L('réarrangement α-iminol', 'إعادة ترتيب ألفا-إيمينول', 'α-iminol rearrangement'),
      definition: L('migration d’une liaison C–C de l’alcool vers le carbone de l’imine ; ici elle agrandit le cycle de 5 à 6 atomes.',
        'انتقال رابطة C–C من كربون الكحول إلى كربون الإيمين؛ وهنا يوسّع الحلقة من 5 إلى 6 ذرات.',
        'a C–C bond migrates from the alcohol carbon to the imine carbon; here it enlarges the ring from 5 to 6 atoms.') },
    { term: L('isomères', 'متصاوغات', 'isomers'),
      definition: L('molécules de même formule brute mais de structures différentes.',
        'جزيئات لها الصيغة الجزيئية نفسها وبنى مختلفة.',
        'molecules with the same molecular formula but different structures.') },
  ],
  predict: {
    question: L('Pendant le chauffage final (α-hydroxy-imine → kétamine), la formule brute change-t-elle ?',
      'أثناء التسخين الأخير (ألفا-هيدروكسي إيمين → كيتامين)، هل تتغير الصيغة الجزيئية؟',
      'During the final heating (α-hydroxy imine → ketamine), does the molecular formula change?'),
    options: [
      L('Oui : une molécule d’eau est éliminée', 'نعم: تُفقد جزيئة ماء', 'Yes: a water molecule is lost'),
      L('Oui : un atome de carbone est ajouté au cycle', 'نعم: تضاف ذرة كربون إلى الحلقة', 'Yes: a carbon atom is added to the ring'),
      L('Non : c’est un réarrangement, les deux sont C₁₃H₁₆ClNO', 'لا: إنها إعادة ترتيب، وكلاهما C₁₃H₁₆ClNO', 'No: it is a rearrangement, both are C₁₃H₁₆ClNO'),
    ],
    answer: 2,
  },
  tryHint: L('Touchez chaque molécule pour allumer l’état de C* ou de Cα qu’elle montre. Puis lancez la synthèse.',
    'المس كل جزيء ليضيء برطمان حالة C* أو Cα التي يُظهرها. ثم ابدأ التحضير.',
    'Tap each molecule to light the jar for the state of C* or Cα it shows. Then run the synthesis.'),
  explain: L('L’α-hydroxy-imine et la kétamine ont la même formule, C₁₃H₁₆ClNO : le chauffage ne fait que réarranger les liaisons. Une liaison C–C du cycle migre de Cα vers C*. C* entre ainsi dans le cycle, qui passe de 5 à 6 atomes, et porte l’aryle et le groupe NH–CH₃ ; l’oxygène de Cα devient le C=O de la cyclohexanone. Le sixième carbone du cycle n’est pas ajouté : c’est C*, l’ancien carbone du nitrile.',
    'للألفا-هيدروكسي إيمين والكيتامين الصيغة نفسها C₁₃H₁₆ClNO: التسخين يعيد ترتيب الروابط فقط. تنتقل رابطة C–C من الحلقة من Cα إلى C*، فيدخل C* الحلقة التي تصبح من 6 ذرات بدل 5، ويحمل مجموعة الأريل ومجموعة NH–CH₃؛ ويصبح أكسجين Cα مجموعة C=O في الهكسانون الحلقي. الكربون السادس في الحلقة لم يُضَف: إنه C*، كربون النتريل القديم.',
    'The α-hydroxy imine and ketamine share the formula C₁₃H₁₆ClNO: heating only rearranges bonds. A ring C–C bond migrates from Cα to C*. C* thus joins the ring, which grows from 5 to 6 atoms, and carries the aryl and the NH–CH₃ group; the oxygen on Cα becomes the cyclohexanone C=O. The sixth ring carbon is not added: it is C*, the old nitrile carbon.'),
  challenge: {
    text: L('Allumez les huit bocaux : trouvez chaque état de C* et de Cα.', 'أضئ البرطمانات الثمانية: اعثر على كل حالة لـ C* و Cα.', 'Light all eight jars: find every state of C* and Cα.'),
    done: L('Les deux atomes suivis jusqu’au bout', 'تتبّعت الذرتين حتى النهاية', 'Both atoms followed to the end'),
  },
  sources: [
    L('C. L. Stevens (Parke-Davis), brevet US 3 254 124 (1966), « Aminoketones and methods for their production ».',
      'C. L. Stevens (Parke-Davis)، براءة الاختراع الأمريكية US 3,254,124 (1966)، «Aminoketones and methods for their production».',
      'C. L. Stevens (Parke-Davis), US Patent 3,254,124 (1966), “Aminoketones and methods for their production”.'),
    L('PubChem, kétamine (CID 3821) : formule C₁₃H₁₆ClNO. pubchem.ncbi.nlm.nih.gov',
      'PubChem، الكيتامين (CID 3821): الصيغة C₁₃H₁₆ClNO. pubchem.ncbi.nlm.nih.gov',
      'PubChem, ketamine (CID 3821): formula C₁₃H₁₆ClNO. pubchem.ncbi.nlm.nih.gov'),
    L('La kétamine est un anesthésique de la Liste modèle OMS des médicaments essentiels et une substance contrôlée. Cette leçon décrit les réactions, pas un mode opératoire.',
      'الكيتامين مخدّر مدرج في قائمة منظمة الصحة العالمية النموذجية للأدوية الأساسية، وهو مادة خاضعة للرقابة. يشرح هذا الدرس التفاعلات وليس طريقة عمل مخبرية.',
      'Ketamine is an anaesthetic on the WHO Model List of Essential Medicines and a controlled substance. This lesson describes the reactions, not a laboratory procedure.'),
  ],
  things,
  jars,
  jarsLayout: { rowsZ: [-9, 7] },
  reaction: { ...reaction, steps: STEPS, types: TYPES },
  event: synthesis(),
  watch: [
    { cam: { pos: [0, 62, 58], look: [0, 0, 0] }, hold: 1.2 },
    { cam: { pos: [-26, 16, 22], look: [-24, 3, -2] }, act: (A) => A.tap('nitrile') },
    { cam: { pos: [-11, 18, 32], look: [-12, 3, 8] }, act: (A) => A.tap('imine') },
    { cam: { pos: [15, 36, 46], look: [15, 3, 3] }, act: (A) => A.startEvent(), hold: 11 },
    { cam: null, hold: 0.5 },
  ],
};
