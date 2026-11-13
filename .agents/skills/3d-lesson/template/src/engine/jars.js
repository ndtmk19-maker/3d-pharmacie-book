import * as THREE from 'three';
import { INK } from './ink.js';

const R = 2.1, H = 6.2;
const SERIF = '"Source Serif 4", Georgia, serif';

const liquidVert = /* glsl */ `
varying vec3 vPos; varying vec3 vObjN; varying vec3 vN; varying vec3 vView;
void main() {
  vPos = position; vObjN = normal; vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
// glowing liquid: rim light, a bright meniscus and slow internal currents so a full jar never reads as flat paint.
// colour × glow goes above 1.0 when lit, which is what the bloom picks up.
const liquidFrag = /* glsl */ `
uniform vec3 uColor; uniform float uGlow; uniform float uTime; uniform float uAlpha; uniform float uR;
varying vec3 vPos; varying vec3 vObjN; varying vec3 vN; varying vec3 vView;
void main() {
  float h = clamp(vPos.y, 0.0, 1.0);
  float facing = abs(dot(normalize(vN), normalize(vView)));
  float rim = pow(1.0 - facing, 2.2);
  float a = atan(vPos.z, vPos.x);
  float sw = 0.5 + 0.5 * sin(vPos.y * 6.0 - uTime * 1.1 + sin(a * 3.0 + uTime * 0.6) * 1.6);
  float b = 0.58 + 0.34 * h + 0.55 * rim + 0.16 * sw;
  if (vObjN.y > 0.5) { float rr = length(vPos.xz) / uR; b = 1.25 + 0.55 * smoothstep(0.55, 1.0, rr); }
  gl_FragColor = vec4(uColor * uGlow * b, uAlpha);
}`;

function ring(r, y) {
  const pts = [];
  for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: INK }));
}

export function createJars(scene, list, center, { cols = 4, dx = 6.6, rowsZ = [-3, 9] } = {}) {
  const map = new Map();
  list.forEach((jar, i) => {
    const g = new THREE.Group();
    g.position.set(center.x + ((i % cols) - (cols - 1) / 2) * dx, center.y, center.z + rowsZ[Math.floor(i / cols)]);
    scene.add(g);
    const body = new THREE.Group();
    g.add(body);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.25, 48).translate(0, 0.125, 0),
      new THREE.MeshStandardMaterial({ color: '#efe7d6', roughness: 0.85 }));
    base.castShadow = base.receiveShadow = true;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 48, 1, true).translate(0, H / 2, 0),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    glass.renderOrder = 2;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R, 0.045, 6, 64).rotateX(Math.PI / 2).translate(0, H, 0),
      new THREE.MeshBasicMaterial({ color: INK }));
    const u = { uColor: { value: new THREE.Color(jar.color) }, uGlow: { value: 0.55 }, uTime: { value: 0 }, uAlpha: { value: 0.93 }, uR: { value: R * 0.9 } };
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, 1, 48, 1).translate(0, 0.5, 0),
      new THREE.ShaderMaterial({ uniforms: u, vertexShader: liquidVert, fragmentShader: liquidFrag, transparent: true }));
    liquid.position.y = 0.25;
    liquid.renderOrder = 1;
    body.add(base, glass, lip, liquid, ring(R, 0.25));

    // the label is printed on the page in front of the jar
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 200;
    const tex = new THREE.CanvasTexture(lc); tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2 * 200 / 512),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.02, R + 1.6);
    g.add(label);

    const s = { level: 0, target: 0, glow: 0.55, glowTarget: 0.55, text: '' };
    const draw = (value, scale) => {
      const text = `${value}|${scale}`;
      if (text === s.text) return;
      s.text = text;
      const c = lc.getContext('2d');
      c.clearRect(0, 0, 512, 200);
      c.textAlign = 'center';
      c.fillStyle = '#1c2433'; c.font = `600 50px ${SERIF}`; c.fillText(jar.name, 256, 58);
      c.fillStyle = '#9a3b2a'; c.font = `600 40px ${SERIF}`; c.fillText(value ?? '', 256, 112);
      c.fillStyle = '#4a5161'; c.font = `italic 400 28px ${SERIF}`; c.fillText(scale ?? '', 256, 166);
      tex.needsUpdate = true;
    };
    draw('', '');

    map.set(jar.id, {
      jar, group: g,
      setLevel(f) { s.target = THREE.MathUtils.clamp(f ?? 0, 0, 1); },
      setGlow(k) { s.glowTarget = 0.55 + 1.9 * k; },     // 0 dim .. 1 fully lit
      setLabel: draw,
      top: () => g.localToWorld(new THREE.Vector3(0, H + 0.6, 0)),
      grow(p) { body.scale.set(1, Math.max(0.001, p), 1); label.material.opacity = p; },
      update(dt, t, still) {
        const k = still ? 1 : Math.min(1, dt * 4);
        s.level += (s.target - s.level) * k;
        s.glow += (s.glowTarget - s.glow) * k;
        liquid.visible = s.level > 0.004;
        liquid.scale.y = Math.max(0.001, s.level * (H - 0.4));
        u.uGlow.value = s.glow;
        u.uTime.value = still ? 0 : t;
      },
    });
  });
  return { get: (id) => map.get(id), all: [...map.values()] };
}
