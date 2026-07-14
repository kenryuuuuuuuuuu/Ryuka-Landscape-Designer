(function exposeObjectCatalog(global) {
  'use strict';

  const ALLOWED_LAYERS = Object.freeze(['facilities', 'guestBeds', 'herbs', 'lawn']);
  const TYPES = Object.freeze([
    { type: 'tool-shed', label: '道具物置', category: 'facility', defaultLayer: 'facilities', width: 3.95, depth: 3.05, height: 2.45, clearance: 0.35, assetId: 'tool-shed', doorOffsetZ: 1.38 },
    { type: 'garden-bench', label: 'ガーデンベンチ', category: 'furniture', defaultLayer: 'guestBeds', width: 1.6, depth: 0.45, height: 0.5, clearance: 0.25, assetId: 'garden-bench' },
    { type: 'raised-bed', label: 'レイズドベッド', category: 'garden', defaultLayer: 'guestBeds', width: 2.4, depth: 1.2, height: 0.42, clearance: 0.3, assetId: 'raised-bed-frame', sizePresets: Object.freeze({ 'catalog-default': [2.4, 1.2, 0.42], 'guest-bed': [2.4, 1.2, 0.42], 'herb-bed': [2.2, 1.1, 0.42] }) },
    { type: 'storage-box', label: '屋外収納ボックス', category: 'facility', defaultLayer: 'facilities', width: 0.9, depth: 0.9, height: 0.9, clearance: 0.2 },
    { type: 'compost-bin', label: 'コンポスト', category: 'facility', defaultLayer: 'facilities', width: 0.9, depth: 0.9, height: 1.05, clearance: 0.3 },
    { type: 'rainwater-tank', label: '雨水タンク', category: 'facility', defaultLayer: 'facilities', width: 0.85, depth: 0.85, height: 1.25, clearance: 0.3, footprint: 'circle' },
    { type: 'planter-box', label: 'プランターボックス', category: 'garden', defaultLayer: 'herbs', width: 1.2, depth: 0.45, height: 0.45, clearance: 0.2 }
  ]);
  const BY_TYPE = new Map(TYPES.map(item => [item.type, item]));

  function item(id, type, x, z, extra = {}) {
    const profile = BY_TYPE.get(type) || extra;
    return Object.freeze({
      id, designId: id, type, label: profile.label || type, x, z, rotation: 0,
      width: profile.width, depth: profile.depth, height: profile.height,
      clearance: profile.clearance, footprint: profile.footprint || 'box',
      sourceType: 'base', baseRotation: 0, sizePreset: 'catalog-default', ...extra
    });
  }

  function createBaseObjects(data) {
    const F = data.facilities;
    const G = data.guestGarden;
    const H = data.herbs;
    const L = data.lawn;
    const objects = [
      item('base-object-tool-shed', 'tool-shed', F.shed.x, F.shed.z, { layer: 'facilities', doorOffsetZ: F.shedDoor.z - F.shed.z }),
      item('base-object-garden-bench', 'garden-bench', G.bench.x, G.bench.z, { layer: 'guestBeds' }),
      ...G.beds.map((p, index) => item(`base-object-guest-bed-${index}`, 'raised-bed', p.x, p.z, { layer: 'guestBeds', width: 2.4, depth: 1.2, bedKind: 'guest', sizePreset: 'guest-bed', seed: 100 + index })),
      ...H.beds.map((p, index) => item(`base-object-herb-bed-${index}`, 'raised-bed', p.x, p.z, { layer: 'herbs', width: 2.2, depth: 1.1, bedKind: 'herb', sizePreset: 'herb-bed', seed: 220 + index })),
      ...F.storage.map((p, index) => item(`base-object-storage-${index}`, 'storage-box', p.x, p.z, { layer: 'facilities' })),
      item('base-object-water-station', 'water-station', F.well.x, F.well.z, {
        label: '浅井戸・洗い場', layer: 'facilities', width: 2.35, depth: 2.0, height: 1.15,
        clearance: 0.3, footprint: 'box', parts: Object.freeze({
          well: { x: 0, z: 0 },
          pump: { x: F.pump.x - F.well.x, z: F.pump.z - F.well.z },
          basin: { x: F.basin.x - F.well.x, z: F.basin.z - F.well.z }
        })
      }),
      item('base-object-pergola', 'pergola', L.pergola.x, L.pergola.z, {
        label: 'パーゴラテラス', layer: 'lawn', width: L.pergola.diameter, depth: L.pergola.diameter,
        height: 2.75, clearance: 0.3, footprint: 'circle'
      })
    ];
    return Object.freeze(objects);
  }

  global.OBJECT_CATALOG = TYPES;
  global.OBJECT_CATALOG_BY_TYPE = BY_TYPE;
  global.OBJECT_ALLOWED_LAYERS = ALLOWED_LAYERS;
  global.createBaseObjects = createBaseObjects;
})(window);
