import './ui/style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import lesson from './lessons/lesson1.js';
import { ENERGY_STORES, fmt } from './stores.js';
import { createBook, PAGE } from './engine/book.js';
import { makeThing } from './engine/ink.js';
import { createJars } from './engine/jars.js';
import { createFlow } from './engine/flows.js';
import { createPost, createQuality } from './engine/post.js';
import { Ledger } from './engine/ledger.js';
import { createTour } from './engine/tour.js';
import { mountPanel } from './ui/panel.js';
import { mountA11y } from './ui/a11y.js';

document.title = `Lesson ${lesson.n}: ${lesson.title}`;
document.getElementById('loaderKicker').textContent = `Lesson ${lesson.n}`;
document.getElementById('loaderTitle').textContent = lesson.title;

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = `lesson3d:${lesson.n}`;
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
const live = (text) => { document.getElementById('live').textContent = text; };

// --- renderer, scene, camera ---
const canvas = document.getElementById('c');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('nogl', 'ready');
  throw err;
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9b0a2');
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.5, 600);
const HOME = { pos: [0, 54, 68], look: [0, 1, 2] };
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 14;
controls.maxDistance = 400;
controls.maxPolarAngle = 1.35;

scene.add(new THREE.HemisphereLight('#fff8ec', '#8a8172', 1.2));
const key = new THREE.DirectionalLight('#fff3df', 2.6);
key.position.set(-30, 60, 35);
key.castShadow = true;
Object.assign(key.shadow.camera, { left: -45, right: 45, top: 35, bottom: -35, near: 10, far: 160 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.05;
scene.add(key);

const post = createPost(renderer, scene, camera);
const quality = createQuality(renderer, post, key);

// --- the book, the drawings, the jars ---
const book = await createBook(scene, lesson, renderer);
const things = lesson.things.map((def) => {
  const t = makeThing(def);
  t.group.position.set(book.left.x + def.at[0], PAGE.Y, book.left.z + def.at[1]);
  scene.add(t.group);
  return t;
});
const byId = Object.fromEntries(things.map((t) => [t.id, t]));
const jarList = lesson.jars ?? ENERGY_STORES;
const jars = createJars(scene, jarList, book.right);
const colorOf = Object.fromEntries(jarList.map((j) => [j.id, j.color]));
const storesInPlay = new Set(lesson.things.map((t) => t.store));

// --- state ---
const S = { mode: 'explore', lit: null, found: new Set(saved.found ?? []), t0: performance.now(), interactive: false };
const ledger = new Ledger(lesson.event?.accounts ?? []);
let tapFlow = null;
const eventFlows = new Map();

function exploreJars() {
  for (const jar of jars.all) {
    const thing = lesson.things.find((t) => t.store === jar.jar.id);
    const w = thing?.work ?? { qualitative: true };
    if (w.qualitative || w.J == null) { jar.setLevel(0); jar.setLabel('no number', 'not measured here'); }
    else if (w.overflow) { jar.setLevel(1); jar.setLabel(fmt(w.J), 'overflows the jar'); }
    else { jar.setLevel(0.9); jar.setLabel(fmt(w.J), `full jar = ${fmt(w.J / 0.9)}`); }
    jar.setGlow(S.lit === jar.jar.id ? 1 : S.found.has(jar.jar.id) ? 0.22 : 0);
  }
}

function tap(id) {
  const t = byId[id];
  if (!t || !S.interactive) return;
  S.mode = 'explore';
  lesson.event?.reset();
  S.lit = t.def.store;
  S.found.add(S.lit);
  saved.found = [...S.found];
  save();
  for (const o of things) o.setLit(o === t);
  tapFlow?.dispose();
  tapFlow = createFlow(scene, t.top(), jars.get(S.lit).top(), colorOf[S.lit]);
  tapFlow.setPower(0.85);
  panel.margin(t);
  panel.readout('');
  progress();
  live(`${t.def.name}: ${t.def.store} store${t.def.work?.J != null ? `, ${fmt(t.def.work.J)}` : ''}`);
}

function startEvent() {
  const ev = lesson.event;
  if (!ev || !S.interactive) return;
  S.mode = 'event';
  S.lit = null;
  tapFlow?.dispose(); tapFlow = null;
  for (const o of things) o.setLit(o.id === ev.thing);
  ev.start();
  ev.begin(ledger);
  live(`${ev.label}: watch the jars.`);
}

function progress() {
  const found = [...S.found].filter((s) => storesInPlay.has(s)).length;
  const met = found >= storesInPlay.size;
  if (met && !saved.stamped) { saved.stamped = true; save(); live(`Stamp earned: ${lesson.challenge.done}`); }
  panel.progress(found, storesInPlay.size, met);
}

const actions = {
  tap, startEvent,
  event: startEvent,
  watch: () => { if (S.interactive) tour.start(lesson.watch); },
  reset: () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); },
  onPredict: (i) => { saved.predict = i; save(); },
  onLayout: () => layout(),
};
const panel = mountPanel(document.getElementById('ui'), lesson, actions, saved);
mountA11y(document.getElementById('a11y'), lesson, actions);
const tour = createTour(camera, controls, HOME, { tap, startEvent });
progress();

// --- layout: keep the book centred in the space the panel leaves ---
function layout() {
  const w = innerWidth, h = innerHeight;
  post.composer.setSize(w, h, false);
  const wide = w >= 940;
  const pw = wide ? 392 : 0;
  const ph = wide ? 0 : panel.collapsed ? 52 : Math.min(panel.height, h * 0.46);
  camera.aspect = (w + pw) / (h + ph);
  // the frame is taller than the screen under a bottom sheet: widen its fov so what shows still looks like 35°
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5)) * (h + ph) / Math.max(1, h - ph)));
  camera.setViewOffset(w + pw, h + ph, pw, ph, w, h);
  camera.updateProjectionMatrix();
}
// pull the camera back when the visible area is narrow, so the whole spread fits
const BASE = HOME.pos.slice();
let userMoved = false;
controls.addEventListener('start', () => { if (!tour.active) userMoved = true; });
function goHome() {
  const wide = innerWidth >= 940;
  const pw = wide ? 392 : 0, visW = innerWidth - pw;   // the panel covers pw of the canvas
  // distance at which the spread (about 66 units wide, plus margin) fills the visible width
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * (visW / (innerWidth + pw));
  const look = new THREE.Vector3(...HOME.look);
  const k = Math.max(1, (36 / tanH) / new THREE.Vector3(...BASE).distanceTo(look));
  HOME.pos = new THREE.Vector3(...BASE).sub(look).multiplyScalar(k).add(look).toArray();
  camera.position.set(...HOME.pos);
  controls.target.copy(look);
}
layout();
goHome();
addEventListener('resize', () => { layout(); if (!userMoved && !tour.active) goHome(); });

// --- picking: a click that did not drag the camera ---
const ray = new THREE.Raycaster();
const pickables = things.flatMap((t) => t.pickables);
const hit = (e) => {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  return ray.intersectObjects(pickables, false)[0]?.object.userData.thingId ?? null;
};
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) { const id = hit(e); if (id) { tour.stop(); tap(id); } }
  down = null;
});
canvas.addEventListener('pointermove', (e) => { if (!down && e.pointerType === 'mouse') canvas.style.cursor = S.interactive && hit(e) ? 'pointer' : ''; });
addEventListener('keydown', (e) => {
  if (!tour.active) return;
  if (e.key === ' ') { e.preventDefault(); tour.togglePause(); }
  if (e.key === 'Escape') tour.stop();
});

// --- the frame ---
const clock = new THREE.Clock();
const clamp01 = (x) => Math.min(1, Math.max(0, x));
let frames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;
  const since = still ? 99 : (performance.now() - S.t0) / 1000;

  // intro: the pen draws each drawing flat on the page, then it lifts off; the jars rise
  things.forEach((th, i) => {
    th.draw(clamp01((since - 0.3 - i * 0.12) / 1.0));
    th.setLift(clamp01((since - 1.6 - i * 0.12) / 1.3));
  });
  const grow = clamp01((since - 2.3) / 0.8);
  for (const j of jars.all) j.grow(grow);
  if (!S.interactive && since > 3.6) S.interactive = true;

  const ev = lesson.event;
  if (S.mode === 'event' && ev) {
    ledger.beginStep();
    ev.step(dt, ledger);
    ev.pose(byId[ev.thing]);
    const peak = ev.peakWatts ?? ev.capacity * 4;
    for (const f of eventFlows.values()) f.setPower(0);
    for (const { from, to, watts } of ledger.flows()) {
      const k = `${from}>${to}`;
      if (!eventFlows.has(k)) eventFlows.set(k, createFlow(scene, jars.get(from).top(), jars.get(to).top(), colorOf[from], colorOf[to]));
      eventFlows.get(k).setPower(watts / peak);
    }
    exploreJars();
    for (const a of ev.accounts) {
      const jar = jars.get(a);
      jar.setLevel(ledger.J[a] / ev.capacity);
      jar.setLabel(fmt(ledger.J[a]), `full jar = ${fmt(ev.capacity)}`);
      jar.setGlow(ledger.J[a] > 1e-6 ? 1 : 0.15);
    }
    panel.readout(ev.readout(ledger));
  } else {
    for (const f of eventFlows.values()) f.setPower(0);
    if (ev && byId[ev.thing]) ev.pose(byId[ev.thing]);
    exploreJars();
  }

  for (const j of jars.all) j.update(dt, t, still);
  tapFlow?.update(dt, t, still);
  for (const f of eventFlows.values()) f.update(dt, t, still);
  tour.update(dt);
  controls.update();
  post.composer.render(dt);

  if (++frames === 3) document.body.classList.add('ready');
  if (frames > 120) quality.sample(dt * 1000, layout);
});
