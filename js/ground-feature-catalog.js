(function exposeGroundFeatureCatalog(global) {
  'use strict';

  const MATERIALS = Object.freeze({
    'path-gravel': Object.freeze({ label: '砂利', kind: 'path' }),
    'path-soil': Object.freeze({ label: '土', kind: 'path' }),
    'path-stone': Object.freeze({ label: '石・平板', kind: 'path' }),
    'area-lawn': Object.freeze({ label: '芝生', kind: 'area' }),
    'area-clover': Object.freeze({ label: 'クローバー', kind: 'area' }),
    'area-crimson-clover': Object.freeze({ label: 'クリムソンクローバー', kind: 'area' }),
    'area-green-manure': Object.freeze({ label: '緑肥（ソルゴー/ベッチ）', kind: 'area' }),
    'area-gravel': Object.freeze({ label: '砂利敷き', kind: 'area' }),
    'area-flower-bed': Object.freeze({ label: '花壇', kind: 'area' }),
    'area-vegetable': Object.freeze({ label: '菜園', kind: 'area' }),
    'area-herb': Object.freeze({ label: 'ハーブ区画', kind: 'area' }),
    'area-weed-control': Object.freeze({ label: '防草シート', kind: 'area' }),
    'area-yard-gravel': Object.freeze({ label: '駐車・作業スペース', kind: 'area' })
  });
  const feature = values => Object.freeze({
    addable: true,
    minimumWidth: values.kind === 'path' ? 0.4 : 0,
    maximumWidth: values.kind === 'path' ? 4 : 0,
    minimumArea: values.kind === 'area' ? 0.5 : 0,
    ...values
  });
  const CATALOG = Object.freeze([
    feature({ featureType: 'garden-path', label: '砂利園路', kind: 'path', category: 'path', defaultLayer: 'paths', materialId: 'path-gravel', defaultWidth: 1.2, description: '踏み固めた砂利の園路' }),
    feature({ featureType: 'soil-path', label: '土の小径', kind: 'path', category: 'path', defaultLayer: 'paths', materialId: 'path-soil', defaultWidth: 0.9, description: '自然な土の小径' }),
    feature({ featureType: 'stone-path', label: '石・平板園路', kind: 'path', category: 'path', defaultLayer: 'paths', materialId: 'path-stone', defaultWidth: 1.0, description: '石や平板を使う園路' }),
    feature({ featureType: 'lawn', label: '芝生', kind: 'area', category: 'green', defaultLayer: 'lawn', materialId: 'area-lawn', defaultWidth: 0, description: '芝生の地表区画' }),
    feature({ featureType: 'clover', label: 'クローバー', kind: 'area', category: 'green', defaultLayer: 'lawn', materialId: 'area-clover', defaultWidth: 0, description: 'クローバー主体の低草地' }),
    feature({ featureType: 'crimson-clover', label: 'クリムソンクローバー', kind: 'area', category: 'green', defaultLayer: 'lawn', materialId: 'area-crimson-clover', defaultWidth: 0, description: '春に赤い花が咲く緑肥。秋播き、翌5月に刈る' }),
    feature({ featureType: 'green-manure', label: '緑肥ローテーション', kind: 'area', category: 'green', defaultLayer: 'lawn', materialId: 'area-green-manure', defaultWidth: 0, description: '夏ソルゴー→秋ヘアリーベッチ。将来の菜園予定地' }),
    feature({ featureType: 'gravel-area', label: '砂利敷き', kind: 'area', category: 'surface', defaultLayer: 'facilities', materialId: 'area-gravel', defaultWidth: 0, description: '設備周辺の砂利敷き' }),
    feature({ featureType: 'flower-bed', label: '花壇', kind: 'area', category: 'garden', defaultLayer: 'herbs', materialId: 'area-flower-bed', defaultWidth: 0, description: '草花を植える区画' }),
    feature({ featureType: 'vegetable-bed', label: '菜園', kind: 'area', category: 'garden', defaultLayer: 'rotations', materialId: 'area-vegetable', defaultWidth: 0, description: '野菜を育てる区画' }),
    feature({ featureType: 'herb-bed-area', label: 'ハーブ区画', kind: 'area', category: 'garden', defaultLayer: 'herbs', materialId: 'area-herb', defaultWidth: 0, description: 'ハーブを植える区画' }),
    feature({ featureType: 'weed-control', label: '防草シート', kind: 'area', category: 'surface', defaultLayer: 'facilities', materialId: 'area-weed-control', defaultWidth: 0, description: '防草用の地表区画' }),
    feature({ featureType: 'work-yard', label: '駐車・作業スペース', kind: 'area', category: 'surface', defaultLayer: 'facilities', materialId: 'area-yard-gravel', defaultWidth: 0, description: '駐車や作業に使う砂利区画' })
  ]);
  const BY_TYPE = new Map(CATALOG.map(item => [item.featureType, item]));
  const clonePoints = points => points.map(point => ({ x: Number(point.x), z: Number(point.z) }));
  const rectangle = (cx, cz, width, depth) => [
    { x: cx - width / 2, z: cz - depth / 2 }, { x: cx + width / 2, z: cz - depth / 2 },
    { x: cx + width / 2, z: cz + depth / 2 }, { x: cx - width / 2, z: cz + depth / 2 }
  ];
  const GREEN_MANURE_ZONES = Object.freeze([
    { id: 'g1', featureType: 'crimson-clover', label: 'G1 西の花畑', points: [{ x: -19.88, z: 5.20 }, { x: -11.25, z: 13.80 }, { x: -10.00, z: 13.60 }, { x: -11.00, z: 6.40 }, { x: -11.00, z: 6.50 }, { x: -16.50, z: 6.50 }, { x: -16.59, z: 5.65 }] },
    { id: 'g2', featureType: 'green-manure', label: 'G2 南の緑肥ローテーション', points: [{ x: 1.40, z: 10.17 }, { x: 1.40, z: 12.00 }, { x: -4.80, z: 12.00 }, { x: -4.34, z: 12.97 }, { x: -4.31, z: 13.62 }, { x: -4.47, z: 14.24 }, { x: -4.80, z: 14.80 }, { x: -5.28, z: 15.23 }, { x: -6.28, z: 15.59 }, { x: -7.34, z: 15.43 }, { x: -7.90, z: 15.10 }, { x: -8.33, z: 14.62 }, { x: -8.66, z: 13.83 }, { x: -8.66, z: 12.97 }, { x: -8.33, z: 12.18 }, { x: -7.72, z: 11.57 }, { x: -8.95, z: 11.50 }, { x: -8.50, z: 16.50 }, { x: -6.03, z: 16.82 }, { x: 8.48, z: 11.00 }, { x: 7.34, z: 10.45 }, { x: 4.60, z: 11.70 }, { x: 3.37, z: 10.01 }] },
    { id: 'g3', featureType: 'clover', label: 'G3 東の果樹草生', points: [{ x: 14.20, z: 4.10 }, { x: 10.97, z: 4.10 }, { x: 10.95, z: 4.70 }, { x: 12.70, z: 4.70 }, { x: 12.70, z: 8.70 }, { x: 10.83, z: 8.70 }, { x: 10.80, z: 9.60 }, { x: 11.57, z: 9.76 }, { x: 20.60, z: 6.14 }, { x: 21.50, z: 5.12 }, { x: 21.48, z: 4.98 }, { x: 14.20, z: 3.60 }] },
    { id: 'g4', featureType: 'clover', label: 'G4 中央クローバー', points: [{ x: -11.60, z: 0.00 }, { x: -11.00, z: 0.00 }, { x: -11.00, z: 4.60 }, { x: -0.20, z: 4.60 }, { x: -0.20, z: -0.60 }, { x: -11.60, z: -0.60 }] },
    { id: 'g5', featureType: 'clover', label: 'G5 北縁の緩衝帯', points: [{ x: 13.16, z: -3.85 }, { x: 13.16, z: -4.85 }, { x: -16.72, z: -4.85 }, { x: -17.05, z: -3.78 }] },
    { id: 'g6-1', featureType: 'clover', label: 'G6 動線南の帯-1', points: [{ x: -16.20, z: 0.00 }, { x: -11.60, z: 0.00 }, { x: -11.60, z: -0.60 }, { x: -0.20, z: -0.60 }, { x: -0.20, z: -1.80 }, { x: -16.20, z: -1.86 }] },
    { id: 'g6-2', featureType: 'clover', label: 'G6 動線南の帯-2', points: [{ x: 1.40, z: -1.80 }, { x: 1.40, z: 0.30 }, { x: 1.90, z: 0.30 }, { x: 1.90, z: -0.90 }, { x: 7.90, z: -0.90 }, { x: 7.90, z: 0.30 }, { x: 8.20, z: 0.30 }, { x: 8.20, z: -0.90 }, { x: 13.60, z: -0.90 }, { x: 13.60, z: -1.80 }] },
    { id: 'g7-1', featureType: 'clover', label: 'G7 こぼれ地1', points: [{ x: -19.91, z: 5.28 }, { x: -11.25, z: 13.80 }, { x: -19.88, z: 5.20 }, { x: -16.59, z: 5.65 }, { x: -16.50, z: 6.50 }, { x: -17.20, z: 0.00 }, { x: -16.20, z: 0.00 }, { x: -16.20, z: -1.86 }, { x: -16.00, z: -1.86 }, { x: -16.00, z: -3.78 }, { x: -17.05, z: -3.78 }] },
    { id: 'g7-2', featureType: 'clover', label: 'G7 こぼれ地2', points: [{ x: -7.56, z: 17.43 }, { x: -6.03, z: 16.82 }, { x: -8.50, z: 16.50 }, { x: -8.95, z: 11.50 }, { x: -7.72, z: 11.57 }, { x: -9.00, z: 11.50 }, { x: -10.00, z: 8.80 }, { x: -0.20, z: 10.27 }, { x: -0.20, z: 4.60 }, { x: -11.00, z: 4.60 }, { x: -11.00, z: 6.40 }, { x: -10.00, z: 13.60 }, { x: -11.25, z: 13.80 }] },
    { id: 'g7-3', featureType: 'clover', label: 'G7 こぼれ地3', points: [{ x: 14.10, z: 8.74 }, { x: 11.57, z: 9.76 }, { x: 10.80, z: 9.60 }, { x: 10.83, z: 8.70 }, { x: 8.30, z: 8.70 }, { x: 8.30, z: 4.70 }, { x: 10.95, z: 4.70 }, { x: 10.97, z: 4.10 }, { x: 8.20, z: 4.10 }, { x: 8.20, z: 0.30 }, { x: 7.90, z: 0.30 }, { x: 7.90, z: 4.10 }, { x: 1.90, z: 4.10 }, { x: 1.90, z: 0.30 }, { x: 1.40, z: 0.30 }, { x: 1.40, z: 10.17 }, { x: 3.37, z: 10.01 }, { x: 3.15, z: 9.70 }, { x: 1.70, z: 9.70 }, { x: 1.70, z: 4.70 }, { x: 7.70, z: 4.70 }, { x: 7.70, z: 9.66 }, { x: 9.00, z: 9.70 }, { x: 7.34, z: 10.45 }, { x: 8.48, z: 11.00 }] },
    { id: 'g7-4', featureType: 'clover', label: 'G7 こぼれ地4', points: [{ x: 20.63, z: -3.85 }, { x: 13.16, z: -3.85 }, { x: -8.89, z: -3.80 }, { x: 19.50, z: -3.80 }, { x: 19.50, z: -3.60 }, { x: 20.00, z: -3.60 }, { x: 20.40, z: 1.40 }, { x: 14.50, z: 1.40 }, { x: 14.50, z: -1.80 }, { x: 13.60, z: -1.80 }, { x: 13.60, z: -0.90 }, { x: 14.20, z: -0.90 }, { x: 14.20, z: 3.60 }, { x: 21.48, z: 4.98 }] }
  ]);

  function pathFromRectangle(polygon) {
    if (!Array.isArray(polygon) || polygon.length !== 4) return null;
    const xs = [...new Set(polygon.map(point => Number(point.x)))].sort((a, b) => a - b);
    const zs = [...new Set(polygon.map(point => Number(point.z)))].sort((a, b) => a - b);
    if (xs.length !== 2 || zs.length !== 2) return null;
    const widthX = xs[1] - xs[0], widthZ = zs[1] - zs[0];
    const midpoint = (first, second) => Number(((first + second) / 2).toFixed(12));
    if (widthX >= widthZ) return { points: [{ x: xs[0], z: midpoint(zs[0], zs[1]) }, { x: xs[1], z: midpoint(zs[0], zs[1]) }], width: Number(widthZ.toFixed(12)) };
    return { points: [{ x: midpoint(xs[0], xs[1]), z: zs[0] }, { x: midpoint(xs[0], xs[1]), z: zs[1] }], width: Number(widthX.toFixed(12)) };
  }

  function createBaseGroundFeatures(data) {
    const base = [];
    data.paths.forEach((polygon, index) => {
      const ribbon = pathFromRectangle(polygon);
      base.push(Object.freeze({
        designId: `base-ground-path-${index}`, featureType: 'garden-path', label: `園路 ${index + 1}`,
        kind: ribbon ? 'path' : 'area', category: 'path', layer: 'paths', materialId: 'path-gravel',
        points: clonePoints(ribbon ? ribbon.points : polygon), width: ribbon?.width || 0,
        basePolygon: clonePoints(polygon), y: 0.045
      }));
    });
    base.push(Object.freeze({ designId: 'base-ground-yard', featureType: 'work-yard', label: '作業ヤード', kind: 'area', category: 'surface', layer: 'facilities', materialId: 'area-yard-gravel', points: clonePoints(data.facilities.yard), width: 0, y: 0.05 }));
    data.rotations.forEach((item, index) => base.push(Object.freeze({
      designId: `base-ground-rotation-${index}`, featureType: 'vegetable-bed', label: item.name,
      kind: 'area', category: 'garden', layer: 'rotations', materialId: 'area-vegetable',
      points: rectangle(item.cx, item.cz, item.w, item.d), width: 0, y: 0.037
    })));
    base.push(Object.freeze({ designId: 'base-ground-herb-zone', featureType: 'herb-bed-area', label: 'ハーブの帯', kind: 'area', category: 'garden', layer: 'herbs', materialId: 'area-herb', points: clonePoints(data.herbs.ground), width: 0, y: 0.035 }));
    base.push(Object.freeze({ designId: 'base-ground-lawn-west', featureType: 'clover', label: 'クローバー広場 西', kind: 'area', category: 'green', layer: 'lawn', materialId: 'area-clover', points: clonePoints(data.lawn.west), width: 0, y: 0.04 }));
    base.push(Object.freeze({ designId: 'base-ground-lawn-east', featureType: 'clover', label: 'クローバー広場 東', kind: 'area', category: 'green', layer: 'lawn', materialId: 'area-clover', points: clonePoints(data.lawn.east), width: 0, y: 0.04 }));
    GREEN_MANURE_ZONES.forEach(zone => {
      const item = BY_TYPE.get(zone.featureType);
      base.push(Object.freeze({
        designId: `base-ground-green-${zone.id}`, featureType: zone.featureType, label: zone.label,
        kind: 'area', category: 'green', layer: 'lawn', materialId: item.materialId,
        points: clonePoints(zone.points), width: 0, y: 0.036
      }));
    });
    return Object.freeze(base);
  }

  global.GROUND_FEATURE_CATALOG = CATALOG;
  global.GROUND_FEATURE_CATALOG_BY_TYPE = BY_TYPE;
  global.GROUND_FEATURE_MATERIALS = MATERIALS;
  global.createBaseGroundFeatures = createBaseGroundFeatures;
  global.groundPathFromRectangle = pathFromRectangle;
})(window);
