import './ui/style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadLesson } from './route.js';
import { ENERGY_STORES, fmt } from './stores.js';
import { t as tx, lang, SERIF } from './i18n.js';
import { createBook, PAGE } from './engine/book.js';
import { makeThing } from './engine/ink.js';
import { createJars } from './engine/jars.js';
import { createFlow } from './engine/flows.js';
import { createPost, createQuality } from './engine/post.js';
import { Ledger } from './engine/ledger.js';
import { createTour } from './engine/tour.js';
import { createTheater } from './engine/theater.js';
import { mountStage } from './ui/stage.js';
import { mountPanel } from './ui/panel.js';
import { mountA11y } from './ui/a11y.js';

let lesson;
try { lesson = await loadLesson(); }
catch (err) {
  // a generated lesson that is not in this browser (or failed to build): offer the way back
  const box = document.getElementById('loaderTitle');
  document.getElementById('loaderKicker').textContent = tx('aiLesson');
  box.style.cssText = 'animation:none;clip-path:none;font-size:30px';
  box.innerHTML = `${tx(err.code === 'notfound' ? 'notFound' : 'buildFailed')}<br><a href="#/new" style="font-size:18px;color:#9a3b2a">${tx('openStudio')}</a>`;
  if (err.code !== 'notfound') console.error(err);
  await new Promise(() => {});           // stop here: there is no lesson to show
}
lesson.kicker ??= lesson.generated ? tx('aiLesson') : `${tx('lesson')} ${lesson.n}`;
document.title = `${lesson.kicker} · ${lesson.title}`;
document.documentElement.lang = lang;
document.getElementById('loaderKicker').textContent = lesson.kicker;
document.getElementById('loaderTitle').textContent = lesson.title;
document.getElementById('c').setAttribute('aria-label', tx('canvas'));
document.getElementById('noglTitle').textContent = tx('noGlTitle');
document.getElementById('noglBody').textContent = tx('noGlBody');

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = `lesson3d:${lesson.key ?? `ketamine:${lesson.n}`}`;
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
  t.caption = printCaption(def, t.group.position);
  return t;
});

// the molecule's name and formula, printed on the page in front of its drawing
function printCaption(def, at) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 170;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  const fit = (text, px, font) => {
    let size = px; g.font = font(size);
    while (g.measureText(text).width > 620 && size > 18) { size -= 2; g.font = font(size); }
  };
  g.fillStyle = '#1c2433'; fit(def.name, 40, (z) => `600 ${z}px ${SERIF}`); g.fillText(def.name, 320, 62);
  g.fillStyle = '#4a5161'; g.font = `italic 400 34px "Source Serif 4", Georgia, serif`; g.fillText(def.formula ?? '', 320, 126);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2 * 170 / 640),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, opacity: 0 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(at.x, PAGE.Y + 0.02, at.z + 1.25);
  scene.add(m);
  return m;
}
const byId = Object.fromEntries(things.map((t) => [t.id, t]));
const jarList = lesson.jars ?? ENERGY_STORES;
const jars = createJars(scene, jarList, book.right, lesson.jarsLayout);
const colorOf = Object.fromEntries(jarList.map((j) => [j.id, j.color]));
const jarName = Object.fromEntries(jarList.map((j) => [j.id, j.name]));
const storesInPlay = new Set(lesson.things.map((t) => t.store));
const R = lesson.reaction;
const theater = R ? createTheater(scene, R, { origin: new THREE.Vector3(...R.origin), scale: R.scale, center: R.center }) : null;

// --- state ---
const S = { mode: 'explore', lit: null, found: new Set(saved.found ?? []), t0: performance.now(), interactive: false };
const ledger = new Ledger(lesson.event?.accounts ?? []);
let tapFlow = null;
const eventFlows = new Map();

function exploreJars() {
  for (const jar of jars.all) {
    const thing = lesson.things.find((t) => t.store === jar.jar.id);
    if (!thing?.work) {
      // state jars: a jar fills when its state has been found; the tapped one glows
      const id = jar.jar.id, lit = S.lit === id, found = S.found.has(id);
      const shown = S.litThing && byId[S.litThing]?.def.store === id ? byId[S.litThing].def : lesson.things.find((t) => t.store === id);
      jar.setLevel(lit || found ? 0.9 : 0);
      jar.setLabel(lit || found ? shown?.formula ?? '' : '', lit ? shown?.name ?? '' : '');
      jar.setGlow(lit ? 1 : found ? 0.22 : 0);
      continue;
    }
    const w = thing?.work ?? { qualitative: true };
    if (w.qualitative || w.J == null) { jar.setLevel(0); jar.setLabel('no number', 'not measured here'); }
    else if (w.overflow) { jar.setLevel(1); jar.setLabel(fmt(w.J), 'overflows the jar'); }
    else { jar.setLevel(0.9); jar.setLabel(fmt(w.J), `full jar = ${fmt(w.J / 0.9)}`); }
    jar.setGlow(S.lit === jar.jar.id ? 1 : S.found.has(jar.jar.id) ? 0.22 : 0);
  }
}

function tap(id) {
  const t = byId[id];
  if (!t || !S.interactive || S.mode === 'theater') return;
  S.mode = 'explore';
  lesson.event?.reset();
  S.lit = t.def.store;
  S.litThing = t.id;
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
  live(`${t.def.name}: ${jarName[t.def.store] ?? t.def.store}`);
}

function startEvent() {
  const ev = lesson.event;
  if (!ev || !S.interactive) return;
  if (S.mode === 'theater') exitTheater(false);
  S.mode = 'event';
  S.lit = null;
  S.litThing = null;
  S.eventShown = ev.thing;
  tapFlow?.dispose(); tapFlow = null;
  panel.margin(byId[ev.thing]);
  for (const o of things) o.setLit(o.id === ev.thing);
  ev.start();
  ev.begin(ledger);
  live(`${ev.label}: ${tx('watchJars')}`);
}

function progress() {
  if (!lesson.challenge) return;
  const found = [...S.found].filter((s) => storesInPlay.has(s)).length;
  const met = found >= storesInPlay.size;
  if (met && !saved.stamped) { saved.stamped = true; save(); live(`${tx('stamp')}: ${lesson.challenge.done}`); }
  panel.progress(found, storesInPlay.size, met);
}

const actions = {
  tap, startEvent,
  event: startEvent,
  watch: () => { if (!S.interactive) return; if (S.mode === 'theater') exitTheater(false); tour.start(lesson.watch); },
  theater: () => enterTheater(1),
  theaterStep: (n) => enterTheater(n),
  reset: () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); },
  onPredict: (i) => { saved.predict = i; save(); },
  onLayout: () => layout(),
};
const panel = mountPanel(document.getElementById('ui'), lesson, actions, saved, jarName);
mountA11y(document.getElementById('a11y'), lesson, actions, jarName);
const tour = createTour(camera, controls, HOME, { tap, startEvent });
const stage = theater ? mountStage(document.getElementById('ui'), R, theater, {
  exit: () => exitTheater(true),
  onKey: (key) => panel.currentStep(key.step),
}) : null;

// --- the reaction theatre: the molecules float above the book and the atoms move step by step ---
let fly = null;
function flyTo(view, dur = 2.2) {
  fly = { from: { pos: camera.position.clone(), look: controls.target.clone() },
    to: { pos: new THREE.Vector3(...view.pos), look: new THREE.Vector3(...view.look) }, t: 0, dur: still ? 0.001 : dur };
  controls.enabled = false;
}
// the theatre camera, pulled back along its line of sight until the molecules fit the visible width
function theaterView() {
  const look = new THREE.Vector3(...R.view.look), pos = new THREE.Vector3(...R.view.pos);
  const wide = innerWidth >= 940;
  const visW = innerWidth - (wide ? 392 : 0);
  const visH = Math.max(200, innerHeight - (stage?.height ?? 0) - (wide ? 16 : 60));
  const tanV = Math.tan(THREE.MathUtils.degToRad(17.5));
  const need = Math.max((R.halfWidth ?? 11) / (tanV * (visW / visH)), (R.halfHeight ?? 0) / tanV);
  const d = pos.distanceTo(look);
  pos.sub(look).multiplyScalar(Math.max(1, need / d)).add(look);
  return { pos: pos.toArray(), look: look.toArray() };
}
function enterTheater(step = 1) {
  if (!theater) return;
  S.interactive = true;                       // the intro does not need to finish first
  tour.stop();
  lesson.event?.reset();
  tapFlow?.dispose(); tapFlow = null;
  for (const o of things) { o.setLit(false); o.group.visible = false; o.caption.visible = false; }
  for (const f of eventFlows.values()) f.setPower(0);
  panel.readout('');
  const was = S.mode;
  S.mode = 'theater';
  document.body.classList.add('theater');
  theater.setVisible(true);
  stage.show(true);
  if (innerWidth < 940) panel.collapse(true);
  layout();
  if (was !== 'theater') { userMoved = false; flyTo(theaterView()); }
  theater.playStep(step);
  live(`${tx('theaterTitle')}: ${R.steps[step - 1].name}`);
}
function exitTheater(goBack) {
  if (S.mode !== 'theater') return;
  S.mode = 'explore';
  S.lit = null;
  document.body.classList.remove('theater');
  theater.pause();
  theater.setVisible(false);
  stage.show(false);
  for (const o of things) { o.group.visible = true; o.caption.visible = true; }
  panel.currentStep(0);
  layout();
  if (goBack) { userMoved = false; flyTo(HOME); }
}
window.__lesson3d = { camera, controls, tour, theater };   // handle for the verification script
progress();

// --- layout: keep the book centred in the space the panel leaves ---
function layout() {
  const w = innerWidth, h = innerHeight;
  post.composer.setSize(w, h, false);
  const wide = w >= 940;
  const pw = wide ? 392 : 0;
  // a bottom strip covered by the panel sheet (narrow) or by the theatre controls
  const sh = stage?.height ? stage.height + (wide ? 16 : 60) : 0;
  const ph = Math.max(wide ? 0 : panel.collapsed ? 52 : Math.min(panel.height, h * 0.46), sh * 0.7);
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
addEventListener('resize', () => {
  layout();
  if (userMoved || tour.active) return;
  if (S.mode === 'theater') { const v = theaterView(); camera.position.set(...v.pos); controls.target.set(...v.look); }
  else goHome();
});

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
  if (S.mode !== 'theater' && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) { const id = hit(e); if (id) { tour.stop(); tap(id); } }
  down = null;
});
canvas.addEventListener('pointermove', (e) => { if (!down && e.pointerType === 'mouse') canvas.style.cursor = S.interactive && hit(e) ? 'pointer' : ''; });
addEventListener('keydown', (e) => {
  if (S.mode === 'theater' && !e.target.closest?.('input, textarea')) {
    const fwd = document.documentElement.lang === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const back = fwd === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === ' ' && !e.target.closest?.('button')) { e.preventDefault(); theater.toggle(); }
    if (e.key === fwd) { theater.pause(); theater.next(); }
    if (e.key === back) { theater.pause(); theater.prev(); }
    if (e.key === 'Escape') exitTheater(true);
    return;
  }
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
    th.caption.material.opacity = clamp01((since - 0.6 - i * 0.12) / 0.8);
  });
  const grow = clamp01((since - 2.3) / 0.8);
  for (const j of jars.all) j.grow(grow);
  if (!S.interactive && since > 3.6) S.interactive = true;

  const ev = lesson.event;
  if (S.mode === 'theater') {
    const lit = theater.key.jars ?? [];
    for (const jar of jars.all) {
      const on = lit.includes(jar.jar.id);
      jar.setLevel(on ? 0.9 : 0);
      jar.setLabel(on ? tx('here') : '', '');
      jar.setGlow(on ? 1 : 0);
    }
    for (const f of eventFlows.values()) f.setPower(0);
  } else if (S.mode === 'event' && ev) {
    ledger.beginStep();
    ev.step(dt, ledger);
    ev.pose(byId[ev.thing]);
    if ('litThing' in ev) {
      const id = ev.litThing;
      for (const o of things) o.setLit(o.id === id);
      if (id && id !== S.eventShown) { S.eventShown = id; panel.margin(byId[id]); }
    }
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
      const v = ledger.J[a];
      jar.setLevel(v / ev.capacity);
      if (ev.unitLabel) jar.setLabel(v > 0.5 ? tx('here') : '', '');
      else jar.setLabel(fmt(v), `full jar = ${fmt(ev.capacity)}`);
      jar.setGlow(v > 1e-6 ? 0.25 + 0.75 * v : 0.15);
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
  theater?.update(dt, t, still);
  if (fly) {
    fly.t += dt;
    const k = Math.min(1, fly.t / fly.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(fly.from.pos, fly.to.pos, e);
    controls.target.lerpVectors(fly.from.look, fly.to.look, e);
    if (k >= 1) { fly = null; controls.enabled = true; }
  }
  controls.update();
  post.composer.render(dt);

  if (++frames === 3) document.body.classList.add('ready');
  if (frames > 120) quality.sample(dt * 1000, layout);
});

// generated lessons open straight onto the reaction theatre
if (lesson.autoTheater) enterTheater(1);
