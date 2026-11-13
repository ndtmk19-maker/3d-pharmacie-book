import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset,
  VignetteEffect, ToneMappingEffect, ToneMappingMode,
} from 'postprocessing';

// HDR chain: only things brighter than 1.0 (the lit liquid and the flows) bloom.
export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.25, intensity: 1.35, radius: 0.72 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.42 });
  composer.addPass(new EffectPass(camera, bloom, tone, vignette));
  composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  return { composer, bloom };
}

// Quality tiers, chosen by sampling frame times (drop a tier when the trimmed mean passes 24 ms).
export function createQuality(renderer, post, key) {
  const tiers = ['high', 'medium', 'low'];
  let tier = 0, samples = [];
  const apply = () => {
    const t = tiers[tier];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, { high: 1.5, medium: 1.25, low: 1 }[t]));
    post.bloom.resolution.scale = { high: 0.5, medium: 0.35, low: 0.25 }[t];
    const size = t === 'low' ? 1024 : 2048;
    if (key.shadow.mapSize.x !== size) { key.shadow.mapSize.set(size, size); key.shadow.map?.dispose(); key.shadow.map = null; }
  };
  apply();
  return {
    get tier() { return tiers[tier]; },
    sample(ms, onChange) {
      samples.push(ms);
      if (samples.length < 90) return;
      samples.sort((a, b) => a - b);
      const mean = samples.slice(5, -5).reduce((a, b) => a + b, 0) / (samples.length - 10);
      samples = [];
      if (mean > 24 && tier < tiers.length - 1) { tier++; apply(); onChange?.(); }
    },
  };
}
