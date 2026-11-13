// Turns an AI-written reaction "script" into a movie for the reaction theatre.
// The script lists frames; each frame is a dot-separated, atom-mapped SMILES of every species present.
// RDKit checks every SMILES and lays each species out in 2D; consecutive frames are aligned on the atoms
// they share (same map number = same physical atom), so atoms slide instead of jumping.
// Pure module (no DOM): it is also run in Node by the tests.

export const FRAME_TYPES = ['approach', 'combination', 'substitution', 'cleavage', 'rearrangement', 'product'];
const SYM = { 1: 'H', 3: 'Li', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S',
  17: 'Cl', 19: 'K', 20: 'Ca', 26: 'Fe', 29: 'Cu', 30: 'Zn', 34: 'Se', 35: 'Br', 46: 'Pd', 50: 'Sn', 53: 'I' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const BOND = 1.5;                  // RDKit 2D bond length; we work in units of one bond

function parseMolblock(mb) {
  const L = mb.split('\n');
  const na = parseInt(L[3].slice(0, 3), 10), nb = parseInt(L[3].slice(3, 6), 10);
  const atoms = [], bonds = [];
  for (let i = 0; i < na; i++) {
    const l = L[4 + i];
    atoms.push({ x: parseFloat(l.slice(0, 10)) / BOND, y: parseFloat(l.slice(10, 20)) / BOND, sym: l.slice(31, 34).trim(), map: parseInt(l.slice(60, 63), 10) || 0 });
  }
  for (let i = 0; i < nb; i++) {
    const l = L[4 + na + i];
    const t = parseInt(l.slice(6, 9), 10);
    bonds.push({ a: parseInt(l.slice(0, 3), 10) - 1, b: parseInt(l.slice(3, 6), 10) - 1, order: t === 4 ? 1.5 : t });
  }
  return { atoms, bonds };
}

// molecular formula (Hill order) from RDKit's JSON: z defaults to 6, implicit H counts per atom
function formulaOf(json) {
  const m = JSON.parse(json).molecules[0];
  const count = {};
  for (const a of m.atoms) {
    const s = SYM[a.z ?? 6] ?? `Z${a.z}`;
    count[s] = (count[s] ?? 0) + 1;
    if (a.impHs) count.H = (count.H ?? 0) + a.impHs;
  }
  const sub = (n) => (n === 1 ? '' : String(n).replace(/\d/g, (d) => SUB[d]));
  const order = ['C', 'H', ...Object.keys(count).filter((s) => s !== 'C' && s !== 'H').sort()];
  return order.filter((s) => count[s]).map((s) => s + sub(count[s])).join('');
}

// Bracket atoms in order of appearance (all atoms are bracketed in an atom-mapped SMILES):
// [OH3+:8] -> { sym: 'O', aromatic: false, h: 3, charge: 1, map: 8 }
const BRACKET = /\[(\d*)([A-Z][a-z]?|[a-z]{1,2})(@*)(H\d*)?([+-]\d*|\++|-+)?(?::(\d+))?\]/g;
function bracketAtoms(smi) {
  return [...smi.matchAll(BRACKET)].map((m) => {
    const ch = m[5] ?? '';
    const charge = !ch ? 0 : /\d/.test(ch) ? Number(ch) : (ch[0] === '+' ? 1 : -1) * ch.length;
    const aromatic = m[2] === m[2].toLowerCase();
    return { sym: aromatic ? m[2][0].toUpperCase() + m[2].slice(1) : m[2], aromatic, h: m[4] ? Number(m[4].slice(1) || 1) : 0, charge, map: Number(m[6] ?? 0) };
  });
}
const BASE = { C: 4, N: 3, O: 2, S: 6, P: 5, F: 1, Cl: 1, Br: 1, I: 1, B: 3, H: 1, Si: 4, Se: 2 };
// Why RDKit refused a SMILES: atoms whose bonds + hydrogens exceed what their charge allows
function valenceProblems(RD, smi) {
  const m = RD.get_mol(smi, JSON.stringify({ sanitize: false }));
  if (!m) return null;                                   // not even the skeleton parses
  let mb; try { mb = m.get_molblock(); } finally { m.delete(); }
  const { atoms, bonds } = parseMolblock(mb);
  const br = bracketAtoms(smi);
  if (br.length !== atoms.length) return [];
  const sum = atoms.map(() => 0);
  for (const b of bonds) { sum[b.a] += b.order; sum[b.b] += b.order; }
  const out = [];
  br.forEach((a, i) => {
    const base = BASE[a.sym];
    if (base == null) return;                            // metals: no rule
    const allowed = a.sym === 'C' || a.sym === 'B' || a.sym === 'Si' ? base - Math.abs(a.charge) : base + a.charge;
    const used = sum[i] + a.h;
    if (used > allowed + 0.01) {
      out.push(`atom map ${a.map || '?'} (${a.sym}${a.charge ? (a.charge > 0 ? '+' : '-') : ''}) has ${used} bonds+H but at most ${allowed} are possible: fix its charge or its H count`);
    }
  });
  return out;
}

// Layout of one species. If RDKit refuses it (wrong charge or H count), lay out a stand-in where every
// atom is a carbon (same skeleton), then put the real elements back: the film only needs the skeleton.
function layoutSpecies(RD, smi) {
  let mol = RD.get_mol(smi);
  let lenient = false;
  if (!mol) {
    const br = bracketAtoms(smi);
    let i = 0;
    const stand = smi.replace(BRACKET, () => { const a = br[i++]; return `[${a.aromatic ? 'c' : 'C'}${a.map ? `:${a.map}` : ''}]`; });
    mol = RD.get_mol(stand);
    if (!mol) return null;
    try {
      const { atoms, bonds } = parseMolblock(mol.get_molblock());
      if (atoms.length !== br.length) return null;
      atoms.forEach((a, k) => { a.sym = br[k].sym; });
      lenient = true;
      return { atoms, bonds, formula: null, lenient };
    } finally { mol.delete(); }
  }
  try {
    const { atoms, bonds } = parseMolblock(mol.get_molblock());
    return { atoms, bonds, formula: formulaOf(mol.get_json()), lenient };
  } finally { mol.delete(); }
}

function parseFrame(RD, smiles, where, strict = true) {
  const frags = [], errors = [];
  for (const [fi, smi] of String(smiles).split('.').map((s) => s.trim()).filter(Boolean).entries()) {
    const sp = layoutSpecies(RD, smi);
    if (!sp) { errors.push({ msg: `${where}: invalid SMILES "${smi}" (it cannot be read)`, soft: false }); continue; }
    if (sp.lenient && strict) {
      const why = valenceProblems(RD, smi) ?? [];
      errors.push({ msg: `${where}: invalid SMILES "${smi}"${why.length ? `: ${why.join('; ')}` : ' (check charges, H counts and aromatic rings)'}`, soft: true });
    }
    frags.push({ smi, ...sp, fi });
  }
  return { frags, errors };
}

// Check the script. Each error is { msg, soft }: all errors are worth a retry; "soft" ones (a wrong charge or
// H count, the skeleton is fine) can be accepted with a warning when retries run out.
export function validateScript(RD, data) {
  const errors = [], warnings = [];
  if (!data || typeof data !== 'object') return { errors: [{ msg: 'no JSON object' }], warnings };
  if (data.refused) return { errors: [], warnings, refused: true };
  const steps = Array.isArray(data.steps) ? data.steps : [];
  if (!steps.length) errors.push({ msg: 'no steps' });
  const elementOf = new Map();
  let frames = 0;
  steps.forEach((st, si) => {
    if (!Array.isArray(st.frames) || !st.frames.length) { errors.push({ msg: `step ${si + 1}: no frames` }); return; }
    st.frames.forEach((fr, fi) => {
      frames++;
      const where = `step ${si + 1} frame ${fi + 1}`;
      if (!FRAME_TYPES.includes(fr.type)) errors.push({ msg: `${where}: unknown type "${fr.type}"` });
      const { frags, errors: e } = parseFrame(RD, fr.smiles, where);
      errors.push(...e);
      const seen = new Set();
      let unmapped = 0;
      for (const f of frags) for (const a of f.atoms) {
        if (!a.map) { unmapped++; continue; }
        if (seen.has(a.map)) errors.push({ msg: `${where}: atom map number ${a.map} used twice` });
        seen.add(a.map);
        const el = elementOf.get(a.map);
        if (el && el !== a.sym) errors.push({ msg: `${where}: map ${a.map} is ${a.sym} here but ${el} in an earlier frame (an atom cannot change element)` });
        else elementOf.set(a.map, a.sym);
      }
      if (unmapped) errors.push({ msg: `${where}: ${unmapped} atom(s) have no atom-map number; every heavy atom needs one` });
    });
  });
  if (frames < 2) errors.push({ msg: 'need at least two frames' });
  return { errors, warnings };
}

// --- 2D alignment of a fragment onto the previous positions of the atoms it shares ---
function bestFit(src, dst) {
  // src, dst: [[x, y]] pairs. Returns f(p) -> p' (rotation, optional reflection, translation)
  const n = src.length;
  const c = (P) => P.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
  const cs = c(src), cd = c(dst);
  const fit = (flip) => {
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      const x = src[i][0] - cs[0], y = (src[i][1] - cs[1]) * flip, u = dst[i][0] - cd[0], v = dst[i][1] - cd[1];
      sxx += x * u + y * v; sxy += x * v - y * u;
    }
    const th = Math.atan2(sxy, sxx), co = Math.cos(th), si = Math.sin(th);
    const f = (p) => { const x = p[0] - cs[0], y = (p[1] - cs[1]) * flip; return [cd[0] + co * x - si * y, cd[1] + si * x + co * y]; };
    let err = 0;
    for (let i = 0; i < n; i++) { const q = f(src[i]); err += (q[0] - dst[i][0]) ** 2 + (q[1] - dst[i][1]) ** 2; }
    return { f, err };
  };
  const a = fit(1), b = fit(-1);
  return (a.err <= b.err ? a : b).f;
}
const centroid = (P) => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);
const minDist = (A, B) => { let m = Infinity; for (const a of A) for (const b of B) m = Math.min(m, Math.hypot(a[0] - b[0], a[1] - b[1])); return m; };

// Build the theatre definition: { atoms, keys, center, halfWidth, halfHeight, steps }
export function buildReaction(RD, data, tr = (v) => (typeof v === 'object' && v ? v.fr ?? v.en : v)) {
  const atoms = {};
  const keys = [];
  const labelOf = Object.fromEntries((data.labels ?? []).map((l) => [l.map, l.label]));
  let prev = new Map();            // id -> [x, y, z] in the previous frame
  let uid = 0;

  data.steps.forEach((st, si) => st.frames.forEach((fr, fi) => {
    const { frags } = parseFrame(RD, fr.smiles, '', false);
    // per fragment: ids and raw 2D coordinates
    const F = frags.map((f) => ({
      ...f,
      ids: f.atoms.map((a) => (a.map ? `m${a.map}` : `u${uid++}`)),
      P: f.atoms.map((a) => [a.x, a.y]),
    }));
    for (const f of F) f.atoms.forEach((a, i) => {
      const id = f.ids[i];
      if (!atoms[id]) atoms[id] = { el: a.sym === 'H' ? 'H' : a.sym, label: a.map ? labelOf[a.map] : undefined };
    });
    // align fragments that share atoms with the previous frame; the biggest first
    F.sort((a, b) => b.atoms.length - a.atoms.length);
    const placed = [];
    const fresh = [];
    for (const f of F) {
      const pairs = f.ids.map((id, i) => [i, prev.get(id)]).filter(([, p]) => p);
      if (pairs.length >= 2) {
        const fn = bestFit(pairs.map(([i]) => f.P[i]), pairs.map(([, p]) => [p[0], p[1]]));
        f.P = f.P.map(fn);
        placed.push(f);
      } else if (pairs.length === 1) {
        const [i, p] = pairs[0];
        const dx = p[0] - f.P[i][0], dy = p[1] - f.P[i][1];
        f.P = f.P.map((q) => [q[0] + dx, q[1] + dy]);
        placed.push(f);
      } else fresh.push(f);
    }
    if (!placed.length && fresh.length) {      // first frame: lay the species out left to right
      let x = 0;
      for (const f of fresh) {
        const xs = f.P.map((p) => p[0]), ys = f.P.map((p) => p[1]);
        const dx = x - Math.min(...xs), dy = -(Math.min(...ys) + Math.max(...ys)) / 2;
        f.P = f.P.map((p) => [p[0] + dx, p[1] + dy]);
        x += Math.max(...xs) - Math.min(...xs) + 2.2;
        placed.push(f);
      }
    } else {
      // new reagents arrive to the upper right of what is already on stage
      const all = placed.flatMap((f) => f.P);
      let maxX = Math.max(...all.map((p) => p[0])), top = Math.max(...all.map((p) => p[1]));
      for (const f of fresh) {
        const xs = f.P.map((p) => p[0]), ys = f.P.map((p) => p[1]);
        const dx = maxX + 1.6 - Math.min(...xs), dy = top - Math.max(...ys) + 0.5;
        f.P = f.P.map((p) => [p[0] + dx, p[1] + dy]);
        maxX = Math.max(...f.P.map((p) => p[0]));
        placed.push(f);
      }
    }
    // push smaller species away from the main one until they no longer touch it
    const main = placed.reduce((a, b) => (b.atoms.length > a.atoms.length ? b : a));
    for (const f of placed) {
      if (f === main) continue;
      const cm = centroid(main.P);
      for (let k = 0; k < 14 && minDist(f.P, main.P) < 1.25; k++) {
        const cf = centroid(f.P);
        let d = [cf[0] - cm[0], cf[1] - cm[1]]; const len = Math.hypot(...d) || 1; d = [d[0] / len, d[1] / len + 0.25];
        f.P = f.P.map((p) => [p[0] + d[0] * 0.45, p[1] + d[1] * 0.45]);
      }
    }

    const pos = {}, bonds = [], vis = [];
    for (const f of placed) {
      const z = f === main ? 0 : 0.8;
      f.ids.forEach((id, i) => { pos[id] = [f.P[i][0], f.P[i][1], z]; vis.push(id); });
      for (const b of f.bonds) bonds.push([f.ids[b.a], f.ids[b.b], b.order]);
    }
    // atoms that just left drift away; atoms that just arrived slide in (set on the previous key)
    for (const [id, p] of prev) if (!pos[id]) pos[id] = [p[0] + 0.6, p[1] + 1.8, p[2] + 1.2];
    const k = keys.length;
    if (k > 0) for (const id of vis) if (!prev.has(id) && !keys[k - 1].pos[id]) keys[k - 1].pos[id] = [pos[id][0] + 1.4, pos[id][1] + 1.0, 1.4];

    keys.push({
      step: si + 1, type: FRAME_TYPES.includes(fr.type) ? fr.type : 'approach',
      text: tr(fr.text) ?? '', focus: (fr.focus ?? []).map((m) => `m${m}`),
      pos, bonds, vis, formulas: placed.map((f) => f.formula ?? '?'),
      dur: fr.type === 'product' ? 0.8 : 2.2, hold: 3.2,
    });
    prev = new Map(vis.map((id) => [id, pos[id]]));
  }));

  // the frame that fits every visible atom of the whole movie
  const P = keys.flatMap((k) => k.vis.map((id) => k.pos[id]));
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const scale = Math.min(2.1, 20 / Math.max(1, w), 13 / Math.max(1, h));
  return {
    atoms, keys,
    center: [(minX + maxX) / 2, (minY + maxY) / 2],
    scale,
    halfWidth: (w / 2) * scale + 1.6,
    halfHeight: (h / 2) * scale + 1.4,
    steps: data.steps.map((st, i) => ({ n: i + 1, name: tr(st.name) ?? `${i + 1}`, types: [...new Set(st.frames.map((f) => f.type))].filter((t) => t !== 'approach' && t !== 'product') })),
  };
}
