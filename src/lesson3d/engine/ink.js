import * as THREE from 'three';

export const INK = '#1c2433';
export const ACCENT = '#9a3b2a';
const CAB = new THREE.Vector2(0.4 * Math.cos(0.61), 0.4 * Math.sin(0.61));

// uLift 0: the object lies on the paper as a cabinet-projection drawing. uLift 1: it stands in 3D.
// It turns up about its own baseline (local y = 0), and its depth grows in late so the drawing reads flat
// until it is nearly upright.
const LIFT_GLSL = /* glsl */ `
uniform float uLift; uniform vec2 uCab;
float ejAngle() { float u = clamp(uLift, 0.0, 1.0); return 1.5707963 * u * u * (3.0 - 2.0 * u); }
vec3 ejAxisY(float a) { return vec3(0.0, sin(a), -cos(a)); }
vec3 ejAxisZ(float a) { return vec3(0.0, cos(a), sin(a)); }
vec3 ejLift(vec3 p) {
  float u = clamp(uLift, 0.0, 1.0);
  float lam = pow(u, 4.0);
  float a = ejAngle();
  float X = p.x + (1.0 - lam) * p.z * uCab.x;
  float Y = p.y + (1.0 - lam) * p.z * uCab.y;
  vec3 r = vec3(X, 0.0, 0.0) + Y * ejAxisY(a) + lam * p.z * ejAxisZ(a);
  r.y += 0.04 * (1.0 - u);   // sit just above the paper while flat
  return r;
}
vec3 ejLiftN(vec3 n) { float a = ejAngle(); return normalize(vec3(n.x, 0.0, 0.0) + n.y * ejAxisY(a) + n.z * ejAxisZ(a)); }
`;

// Patch any built-in material so its vertices follow the lift. `outline` pushes along the normal (inverted hull).
export function liftable(material, lift, outline = 0) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLift = lift;
    shader.uniforms.uCab = { value: CAB };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${LIFT_GLSL}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = ejLiftN(vec3(normal));\n#ifdef USE_TANGENT\n\tvec3 objectTangent = vec3(tangent.xyz);\n#endif')
      .replace('#include <begin_vertex>', outline
        ? `vec3 transformed = ejLift(vec3(position) + normal * ${outline.toFixed(3)});`
        : 'vec3 transformed = ejLift(vec3(position));');
  };
  material.customProgramCacheKey = () => `ej-lift-${outline}`;
  return material;
}

// Geometry helpers for lesson authors. Transforms are baked into the geometry, because the lift
// works in each mesh's own space. Keep the base of every object on y = 0, facing +z (the reader).
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function place(geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  return geo.applyMatrix4(_m.compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...scl)));
}
export const P = {
  box: (w, h, d, pos, rot) => place(new THREE.BoxGeometry(w, h, d), pos, rot),
  cyl: (rTop, rBot, h, pos, rot, seg = 24) => place(new THREE.CylinderGeometry(rTop, rBot, h, seg), pos, rot),
  cone: (r, h, pos, rot, seg = 18) => place(new THREE.ConeGeometry(r, h, seg), pos, rot),
  sphere: (r, pos, scl, seg = 20) => place(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), pos, [0, 0, 0], scl),
  torus: (R, r, pos, rot, seg = 40) => place(new THREE.TorusGeometry(R, r, 10, seg), pos, rot),
  tube: (points, r, closed = false) => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed), Math.max(24, points.length * 6), r, 8, closed),
  place,
};

// A "thing" on the page: paper-white fills, an ink silhouette (inverted hull) and ink crease lines that
// are drawn by a pen before the object lifts. Parts: a geometry, or { g, tone: 'paper'|'shade'|'ink',
// group: 'name' (a sub-group the lesson can move later), crease: degrees, edges: false }.
export function makeThing(def) {
  const lift = { value: 0 };
  const group = new THREE.Group();
  group.name = def.id;
  const sub = {};
  const edgeMat = liftable(new THREE.LineBasicMaterial({ color: INK }), lift);
  const hullMat = liftable(new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), lift, 0.07);
  const depthMat = liftable(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), lift);
  const fill = (color) => liftable(new THREE.MeshStandardMaterial({
    color, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), lift);
  const tones = { paper: fill('#f4eddd'), shade: fill('#d6cbb4'), ink: fill('#2a3142'), accent: fill(ACCENT) };
  const edges = [], fills = [], hulls = [], labels = [];

  for (const raw of def.parts) {
    const part = raw.isBufferGeometry ? { g: raw } : raw;
    let parent = group;
    if (part.group) {
      if (!sub[part.group]) { sub[part.group] = new THREE.Group(); group.add(sub[part.group]); }
      parent = sub[part.group];
    }
    if (part.label) { const l = makeLabel(part, lift); parent.add(l); labels.push(l); continue; }
    if (part.lines) {
      // pen strokes given directly as [a, b] segment pairs (a skeletal formula drawn on the page)
      const geo = new THREE.BufferGeometry().setFromPoints(part.lines.flat().map((p) => new THREE.Vector3(...p)));
      const lines = new THREE.LineSegments(geo, edgeMat);
      lines.userData.total = geo.attributes.position.count;
      parent.add(lines); edges.push(lines);
      continue;
    }
    const mesh = new THREE.Mesh(part.g, tones[part.tone ?? 'paper']);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.customDepthMaterial = depthMat;
    mesh.userData.thingId = def.id;
    const hull = new THREE.Mesh(part.g, hullMat);
    parent.add(mesh, hull);
    fills.push(mesh); hulls.push(hull);
    if (part.edges !== false) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(part.g, part.crease ?? 35), edgeMat);
      lines.userData.total = lines.geometry.attributes.position.count;
      parent.add(lines); edges.push(lines);
    }
  }

  const api = {
    def, id: def.id, group, sub, lift, pickables: fills,
    draw(p) {
      for (const l of edges) l.geometry.setDrawRange(0, Math.floor((l.userData.total * p) / 2) * 2);
      for (const l of labels) l.material.opacity = p;
    },
    setLift(u) {
      lift.value = u;
      const solid = u > 0.08;
      for (const m of fills) m.visible = solid;
      for (const h of hulls) h.visible = solid;
    },
    setLit(on) {
      edgeMat.color.set(on ? ACCENT : INK); hullMat.color.set(on ? ACCENT : INK);
    },
    top() {
      const b = new THREE.Box3().setFromObject(group);
      return new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.4, (b.min.z + b.max.z) / 2);
    },
  };
  api.draw(0); api.setLift(0);
  return api;
}

// An atom letter (or any short text) printed on a small plane facing +z. It follows the lift like the rest.
const LABEL_FONT = '"Source Serif 4", Georgia, serif';
function makeLabel({ label, pos, size = 0.6, color = INK }, lift) {
  const H = 128, c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `600 ${H * 0.78}px ${LABEL_FONT}`;
  g.font = font;
  const w = Math.ceil(g.measureText(label).width + H * 0.3);
  c.width = w; c.height = H;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(label, w / 2, H * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(size * (w / H), size).translate(pos[0], pos[1], pos[2] ?? 0.12);
  const mat = liftable(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }), lift);
  mat.customProgramCacheKey = () => 'ej-lift-label';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  return mesh;
}
