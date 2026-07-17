(function exposeGroundFeatureCatalog(global) {
  'use strict';

  const MATERIALS = Object.freeze({
    'path-gravel': Object.freeze({ label: '砂利', kind: 'path' }),
    'path-soil': Object.freeze({ label: '土', kind: 'path' }),
    'path-stone': Object.freeze({ label: '石・平板', kind: 'path' }),
    'area-lawn': Object.freeze({ label: '芝生', kind: 'area' }),
    'area-clover': Object.freeze({ label: 'クローバー', kind: 'area' }),
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
    return Object.freeze(base);
  }

  global.GROUND_FEATURE_CATALOG = CATALOG;
  global.GROUND_FEATURE_CATALOG_BY_TYPE = BY_TYPE;
  global.GROUND_FEATURE_MATERIALS = MATERIALS;
  global.createBaseGroundFeatures = createBaseGroundFeatures;
  global.groundPathFromRectangle = pathFromRectangle;
})(window);
