import * as THREE from 'three';

// The reaction theatre: ball-and-stick molecules whose atoms keep their identity from keyframe to keyframe.
// Between two keyframes every atom slides to its new place, bonds thicken in (forming, gold glow) or thin
// out (breaking, red glow), and atoms that join or leave fade in or out.
// def = { atoms: { id: { el, label? } }, keys: [{ pos: { id: [x, y, z] }, bonds: [[a, b, order]], vis: [ids],
//          focus?: [ids], hlBond?: [a, b], dur?, hold?, ...anything the UI needs }] }
const EL = {
  C: { r: 0.3, c: '#2b3242' }, H: { r: 0.19, c: '#f4eddd' }, O: { r: 0.34, c: '#d9473b' }, N: { r: 0.34, c: '#2f6bdc' },
  Cl: { r: 0.38, c: '#3fae55' }, Br: { r: 0.42, c: '#a0442c' }, Mg: { r: 0.42, c: '#8fa35a' }, Me: { r: 0.36, c: '#4f5768' },
};
const INK = '#1c2433', ACCENT = '#9a3b2a';
const BOND_R = 0.075, SPACING = 0.2;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const UP = new THREE.Vector3(0, 1, 0);

function textSprite(text, { color = '#ffffff', size = 0.5, weight = 700, halo = null } = {}) {
  const H = 128, c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${H * 0.62}px "Source Serif 4", Georgia, serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width + H * 0.3);
  c.width = w; c.height = H;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  if (halo) { g.lineJoin = 'round'; g.lineWidth = H * 0.16; g.strokeStyle = halo; g.strokeText(text, w / 2, H * 0.55); }
  g.fillText(text, w / 2, H * 0.55);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  s.scale.set(size * (w / H), size, 1);
  s.renderOrder = 10;
  return s;
}

export function createTheater(scene, def, { origin, scale = 2, center = [0, 0] }) {
  const root = new THREE.Group();
  root.position.copy(origin);
  root.visible = false;
  scene.add(root);
  const mol = new THREE.Group();
  mol.scale.setScalar(scale);
  mol.position.set(-center[0] * scale, -center[1] * scale, 0);
  root.add(mol);

  const keys = def.keys;
  const ids = Object.keys(def.atoms);
  // fill every atom's position forward and backward so an atom has a place before it appears and after it leaves
  for (const id of ids) {
    let last = null;
    for (const k of keys) { if (k.pos[id]) last = k.pos[id]; else if (last) k.pos[id] = last; }
    const first = keys.find((k) => k.pos[id])?.pos[id] ?? [0, 0, 0];
    for (const k of keys) if (!k.pos[id]) k.pos[id] = first;
    for (const k of keys) if (k.pos[id].length === 2) k.pos[id] = [...k.pos[id], 0];
  }
  for (const k of keys) {
    k._vis = new Set(k.vis);
    k._bonds = new Map(k.bonds.map(([a, b, o]) => [[a, b].sort().join('|'), o]));
  }

  // atoms
  const geoCache = {};
  const atoms = {};
  for (const id of ids) {
    const a = def.atoms[id], e = EL[a.el] ?? { r: 0.38, c: '#8a7f6e' };
    const geo = (geoCache[a.el] ??= new THREE.SphereGeometry(e.r, 28, 20));
    const mat = new THREE.MeshStandardMaterial({ color: e.c, roughness: 0.42, metalness: 0, transparent: true, emissive: '#000000' });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, transparent: true, toneMapped: false }));
    hull.scale.setScalar(1.13);
    mesh.add(hull);
    mol.add(mesh);
    let label = null, tag = null;
    const sym = a.el === 'Me' ? 'CH₃' : a.el === 'C' || a.el === 'H' ? null : a.el;
    if (sym) { label = textSprite(sym, { size: e.r * (sym.length > 2 ? 1.25 : 1.55) }); mesh.add(label); }
    if (a.label) { tag = textSprite(a.label, { color: ACCENT, size: 0.5, halo: 'rgba(251,247,238,.92)' }); const a0 = (a.tagDir ?? 90) * Math.PI / 180;
      tag.position.set(Math.cos(a0) * (e.r + 0.36), Math.sin(a0) * (e.r + 0.36), 0.2); mesh.add(tag); }
    atoms[id] = { mesh, mat, hull, label, tag, r: e.r };
  }

  // bonds: every pair that is bonded in any keyframe gets up to three cylinders
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const bonds = new Map();
  for (const k of keys) for (const key of k._bonds.keys()) {
    if (bonds.has(key)) continue;
    const [a, b] = key.split('|');
    const mat = new THREE.MeshStandardMaterial({ color: '#59606f', roughness: 0.55, transparent: true, emissive: '#000000' });
    const meshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(cyl, mat); m.castShadow = true; mol.add(m); return m; });
    bonds.set(key, { a, b, mat, meshes });
  }

  const S = { k: 0, t: 99, playing: false, onChange: null, untilStep: null };
  const tagged = ids.filter((id) => atoms[id].tag);
  // atoms bonded to `id` in the frame being shown (the one we are moving into)
  const neighbours = (id) => [...keys[S.k]._bonds.keys()].map((k) => k.split('|')).filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), d = new THREE.Vector3(), perp = new THREE.Vector3(), q = new THREE.Quaternion();
  const pos = {}, op = {};

  function changed() { S.onChange?.(keys[S.k], S.k); }
  function goto(k, instant = false) {
    S.k = THREE.MathUtils.clamp(k, 0, keys.length - 1);
    S.t = instant ? (keys[S.k].dur ?? 1.9) : 0;   // instant: show the frame settled, then still hold it
    changed();
  }

  return {
    keys,
    get k() { return S.k; },
    get key() { return keys[S.k]; },
    get playing() { return S.playing; },
    set onChange(fn) { S.onChange = fn; },
    setVisible(on) { root.visible = on; },
    goto,
    play() { if (S.k >= keys.length - 1) goto(0); S.playing = true; changed(); },
    pause() { S.playing = false; changed(); },
    toggle() { if (S.playing) this.pause(); else this.play(); },
    next() { if (S.k < keys.length - 1) goto(S.k + 1); },
    prev() { if (S.k > 0) goto(S.k - 1, true); },
    // jump to the start of a step: show its first keyframe as it stands, then play on to the end
    playStep(step) {
      const i = keys.findIndex((k) => k.step === step);
      if (i < 0) return;
      S.untilStep = null;   // keep playing into the following steps, through to ketamine
      S.playing = true;
      goto(i, true);
    },
    update(dt, t, still) {
      if (!root.visible) return;
      const key = keys[S.k], prev = keys[Math.max(0, S.k - 1)];
      const dur = key.dur ?? 1.9, hold = key.hold ?? 2.6;
      S.t += dt;
      if (S.playing && S.t > dur + hold) {
        const nk = keys[S.k + 1];
        if (!nk || (S.untilStep != null && nk.step !== S.untilStep)) { S.playing = false; S.untilStep = null; changed(); }
        else goto(S.k + 1);
      }
      const p = S.k === 0 || still ? 1 : ease(Math.min(1, S.t / dur));
      root.rotation.y = still ? 0 : Math.sin(t * 0.35) * 0.28;
      const pulse = still ? 0.7 : 0.5 + 0.5 * Math.sin(t * 4.2);

      for (const id of ids) {
        const A = atoms[id], p0 = prev.pos[id], p1 = key.pos[id];
        const P = (pos[id] ??= new THREE.Vector3());
        P.set(p0[0] + (p1[0] - p0[0]) * p, p0[1] + (p1[1] - p0[1]) * p, p0[2] + (p1[2] - p0[2]) * p);
        A.mesh.position.copy(P);
        const o = (prev._vis.has(id) ? 1 - p : 0) + (key._vis.has(id) ? p : 0);
        op[id] = o;
        A.mesh.visible = o > 0.01;
        A.mat.opacity = o; A.hull.material.opacity = o;
        if (A.label) A.label.material.opacity = o;
        if (A.tag) A.tag.material.opacity = o;
        const focus = key.focus?.includes(id);
        // focus: a glowing gold halo round the atom; the atom keeps its element colour
        A.hull.material.color.set(focus ? '#ffc23a' : INK);
        A.hull.scale.setScalar(focus ? 1.22 + 0.12 * pulse : 1.13);
        A.mat.emissive.set(focus ? '#ffb020' : '#000000');
        A.mat.emissiveIntensity = focus ? 0.12 * pulse : 0;
      }

      // labels (C*, Cα): a fixed direction if the lesson gives one, otherwise the side away from the atom's bonds
      for (const id of tagged) {
        const A = atoms[id], fixed = key.tags?.[id] ?? def.atoms[id].tagDir;
        let dx = 0, dy = 0;
        if (fixed != null) { dx = Math.cos(fixed * Math.PI / 180); dy = Math.sin(fixed * Math.PI / 180); }
        else {
          for (const n of neighbours(id)) { const v = d.subVectors(pos[n], pos[id]); const l = Math.hypot(v.x, v.y) || 1; dx -= v.x / l; dy -= v.y / l; }
          const l = Math.hypot(dx, dy);
          if (l < 0.2) { dx = 0; dy = 1; } else { dx /= l; dy /= l; }
        }
        A.tag.position.set(dx * (A.r + 0.4), dy * (A.r + 0.4), 0.25);
      }

      for (const [k, B] of bonds) {
        const o0 = prev._bonds.get(k) ?? 0, o1 = key._bonds.get(k) ?? 0;
        const o = S.k === 0 ? o1 : o0 + (o1 - o0) * p;
        const alpha = Math.min(op[B.a], op[B.b]);
        const hl = key.hlBond && [...key.hlBond].sort().join('|') === k;
        if (o1 > o0) { B.mat.emissive.set('#ffcf1a'); B.mat.emissiveIntensity = 2.2 * (1 - 0.55 * p); }
        else if (o1 < o0) { B.mat.emissive.set('#ff3b3b'); B.mat.emissiveIntensity = 2.4 * (1 - p); }
        else if (hl) { B.mat.emissive.set('#ff7a1c'); B.mat.emissiveIntensity = 0.6 + 1.6 * pulse; }
        else B.mat.emissiveIntensity = 0;
        B.mat.opacity = alpha;
        vA.copy(pos[B.a]); vB.copy(pos[B.b]);
        d.subVectors(vB, vA);
        const len = d.length();
        d.normalize();
        perp.set(-d.y, d.x, 0);
        if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
        perp.normalize();
        q.setFromUnitVectors(UP, d);
        const span = Math.max(1, o) - 1;
        B.meshes.forEach((m, i) => {
          const w = THREE.MathUtils.clamp(o - i, 0, 1);
          m.visible = w > 0.01 && alpha > 0.01 && len > 0.05;
          if (!m.visible) return;
          m.position.copy(vA).addScaledVector(d, len / 2).addScaledVector(perp, (i - span / 2) * SPACING);
          m.quaternion.copy(q);
          const r = BOND_R * (i === 0 ? 1 : 0.85) * w;
          m.scale.set(r, len, r);
        });
      }
    },
  };
}
