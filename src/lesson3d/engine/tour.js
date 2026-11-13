import * as THREE from 'three';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// "Watch the demonstration": steps of { cam: { pos, look } | null (home), act(L), hold seconds }.
export function createTour(camera, controls, home, api) {
  let steps = [], i = -1, t = 0, active = false, paused = false, from = null, step = null;
  const MOVE = 2.4;
  function next() {
    i++;
    if (i >= steps.length) return stop();
    step = steps[i];
    from = { pos: camera.position.clone(), look: controls.target.clone() };
    t = 0;
    step.act?.(api);
  }
  function stop() { active = false; controls.enabled = true; api.onTourEnd?.(); }
  return {
    get active() { return active; },
    start(s) { steps = s; i = -1; active = true; paused = false; controls.enabled = false; next(); },
    stop,
    togglePause() { paused = !paused; },
    update(dt) {
      if (!active || paused) return;
      t += dt;
      const cam = step.cam ?? home;
      const k = ease(Math.min(1, t / MOVE));
      camera.position.lerpVectors(from.pos, new THREE.Vector3(...cam.pos), k);
      controls.target.lerpVectors(from.look, new THREE.Vector3(...cam.look), k);
      if (t > MOVE + (step.hold ?? 2.6)) next();
    },
  };
}
