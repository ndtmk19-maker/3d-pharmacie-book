import * as THREE from 'three';

const vert = /* glsl */ `
varying float vU; varying vec3 vN; varying vec3 vView;
void main() {
  vU = uv.x; vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uPower; uniform float uLen; uniform float uSpeed;
varying float vU; varying vec3 vN; varying vec3 vView;
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
void main() {
  // blend source to destination round the hue circle the short way: an RGB mix of opposite hues goes grey
  vec3 a = rgb2hsv(uA), b = rgb2hsv(uB);
  float dh = b.x - a.x; dh -= floor(dh + 0.5);
  float hw = mix(0.36, 0.05, clamp(abs(dh) * 3.5, 0.0, 1.0));
  float bt = smoothstep(0.5 - hw, 0.5 + hw, vU);
  vec3 c = hsv2rgb(vec3(fract(a.x + dh * bt), mix(a.y, b.y, bt), mix(a.z, b.z, bt)));
  float core = pow(abs(dot(normalize(vN), normalize(vView))), 1.5);
  float pulse = 0.5 + 0.5 * sin(vU * uLen * 0.9 - uTime * uSpeed);
  float ends = smoothstep(0.0, 0.05, vU) * smoothstep(1.0, 0.95, vU);
  float alpha = uPower * ends * (0.25 + 0.75 * core) * (0.5 + 0.5 * pulse);
  gl_FragColor = vec4(c * (1.1 + 1.7 * core * pulse), alpha);
}`;

// A glowing tube from one point to another. setPower(0..1) fades it; speed follows the power.
export function createFlow(scene, from, to, colorA, colorB = colorA, { radius = 0.32 } = {}) {
  const dist = from.distanceTo(to);
  const mid = from.clone().lerp(to, 0.5);
  mid.y += dist * 0.35 + 3;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const u = {
    uA: { value: new THREE.Color(colorA) }, uB: { value: new THREE.Color(colorB) }, uTime: { value: 0 },
    uPower: { value: 0 }, uLen: { value: curve.getLength() }, uSpeed: { value: 4 },
  };
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 10, false),
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.renderOrder = 3;
  scene.add(mesh);
  let target = 0;
  return {
    setPower(p) { target = THREE.MathUtils.clamp(p, 0, 1); },
    update(dt, t, still) {
      u.uPower.value += (target - u.uPower.value) * (still ? 1 : Math.min(1, dt * 6));
      u.uSpeed.value = 2 + 6 * u.uPower.value;
      u.uTime.value = still ? 0 : t;
      mesh.visible = u.uPower.value > 0.003;
    },
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); },
  };
}
