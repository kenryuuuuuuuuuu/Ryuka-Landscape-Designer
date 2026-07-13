(function exposeAssetCatalog(global) {
  'use strict';

  function entry(id, label, category, canonicalSize, castShadow, fallbackType) {
    return Object.freeze({
      id,
      label,
      category,
      variants: Object.freeze({
        high: `./assets/models/${id}-high.glb`,
        low: `./assets/models/${id}-low.glb`
      }),
      canonicalSize: Object.freeze(canonicalSize),
      castShadow,
      receiveShadow: true,
      envMapIntensity: category === 'facility' ? 0.65 : 0.25,
      fallbackType,
      author: 'Ryuka Landscape Designer',
      license: 'Project original',
      sourceNote: 'scripts/generate_demo_glbs.py で生成'
    });
  }

  global.ASSET_CATALOG = Object.freeze([
    entry('tool-shed', '道具物置', 'facility', { x: 3.95, y: 2.45, z: 3.05 }, true, 'procedural-tool-shed'),
    entry('garden-bench', '木製ベンチ', 'furniture', { x: 1.60, y: 0.50, z: 0.45 }, true, 'procedural-garden-bench'),
    entry('raised-bed-frame', 'レイズドベッド木枠', 'garden', { x: 2.40, y: 0.42, z: 1.20 }, false, 'procedural-raised-bed-frame')
  ]);
})(window);
