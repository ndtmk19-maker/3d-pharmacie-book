import * as THREE from 'three';

// Scene units: the open spread is two 30 × 40 pages; the paper surface sits at y = PAGE.Y.
export const PAGE = { W: 30, D: 40, Y: 1.6, GAP: 0.15 };
const SERIF = '"Source Serif 4", Georgia, serif';

export async function createBook(scene, lesson, renderer) {
  try { await Promise.all([document.fonts.load(`600 40px ${SERIF}`), document.fonts.load(`italic 400 40px ${SERIF}`)]); } catch {}

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#b9b0a2', roughness: 1 }));
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);

  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(PAGE.W * 2 + 2.6, 0.6, PAGE.D + 2.4),
    new THREE.MeshPhysicalMaterial({ color: '#1f2b52', roughness: 0.62, sheen: 0.8, sheenColor: new THREE.Color('#8ea0d8'), sheenRoughness: 0.35 }));
  cover.position.y = 0.3;
  cover.castShadow = cover.receiveShadow = true;
  scene.add(cover);

  const edge = new THREE.MeshStandardMaterial({ color: '#e6dcc6', roughness: 0.95 });
  const aniso = renderer.capabilities.getMaxAnisotropy();
  for (const side of [-1, 1]) {
    const tex = new THREE.CanvasTexture(printPage(lesson, side));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, aniso);
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE.W, 1, PAGE.D), [edge, edge, top, edge, edge, edge]);
    block.position.set(side * (PAGE.W / 2 + PAGE.GAP), PAGE.Y - 0.5, 0);
    block.receiveShadow = true;
    scene.add(block);
  }
  const cx = PAGE.W / 2 + PAGE.GAP;
  return { left: new THREE.Vector3(-cx, PAGE.Y, 0), right: new THREE.Vector3(cx, PAGE.Y, 0) };
}

// Print the page: the canvas top maps to the far edge of the page (-z).
function printPage(lesson, side) {
  const W = 1200, H = 1600, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f4eddd';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {               // paper tooth
    g.fillStyle = `rgba(90,70,40,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  const gut = side < 0 ? g.createLinearGradient(W, 0, W - 140, 0) : g.createLinearGradient(0, 0, 140, 0);
  gut.addColorStop(0, 'rgba(60,45,25,0.16)'); gut.addColorStop(1, 'rgba(60,45,25,0)');
  g.fillStyle = gut; g.fillRect(0, 0, W, H);

  const x0 = side < 0 ? 110 : 150;
  const spaced = (text, x, y, font, color, spacing = 0) => {
    g.font = font; g.fillStyle = color;
    if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
    g.fillText(text, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  };
  const folio = (side < 0 ? lesson.folios?.[0] : lesson.folios?.[1]) ?? '';
  g.textAlign = side < 0 ? 'left' : 'right';
  spaced(String(folio), side < 0 ? 80 : W - 80, H - 70, `400 30px ${SERIF}`, '#5a5448');
  g.textAlign = 'left';

  if (side < 0) {
    spaced(`LESSON ${lesson.n}`, x0, 130, `600 26px ${SERIF}`, '#9a3b2a', 8);
    spaced(lesson.title, x0, 215, `600 76px ${SERIF}`, '#1c2433');
    g.strokeStyle = '#9a3b2a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x0, 250); g.bezierCurveTo(x0 + 120, 236, x0 + 240, 262, x0 + 360, 246); g.stroke();
    spaced(`Figure ${lesson.n} · ${lesson.figure}`, x0, H - 150, `italic 400 34px ${SERIF}`, '#4a5161');
  } else {
    spaced((lesson.jarsTitle ?? 'THE JARS').toUpperCase(), x0, 130, `600 26px ${SERIF}`, '#9a3b2a', 8);
    spaced(lesson.jarsCaption ?? 'Each jar is one store. Its level shows the joules.', x0, 190, `italic 400 36px ${SERIF}`, '#4a5161');
  }
  return c;
}
