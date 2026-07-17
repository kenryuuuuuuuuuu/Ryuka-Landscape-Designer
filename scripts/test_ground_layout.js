const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const storage = new Map();
global.window = global;
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

function load(file) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
function pointSet(points) {
  return points.map(point => `${point.x.toFixed(6)},${point.z.toFixed(6)}`).sort();
}

load('data/fixed-site-data.js');
load('js/ground-feature-catalog.js');
load('js/ground-feature-models.js');
load('js/design-state.js');

assert.strictEqual(GROUND_FEATURE_CATALOG.length, 11, '11 addable ground feature types');
assert(Object.isFrozen(GROUND_FEATURE_CATALOG), 'ground catalog is frozen');
GROUND_FEATURE_CATALOG.forEach(item => {
  ['featureType', 'label', 'kind', 'category', 'addable', 'defaultLayer', 'materialId', 'defaultWidth', 'minimumWidth', 'maximumWidth', 'minimumArea', 'description'].forEach(field => {
    assert(Object.hasOwn(item, field), `${item.featureType} exposes ${field}`);
  });
});

const base = createBaseGroundFeatures(DATA);
assert.strictEqual(base.length, 12, '12 fixed ground features');
assert.strictEqual(new Set(base.map(item => item.designId)).size, 12, 'fixed ground IDs are unique');
assert.deepStrictEqual(base.map(item => item.designId), [
  'base-ground-path-0', 'base-ground-path-1', 'base-ground-path-2', 'base-ground-path-3',
  'base-ground-yard', 'base-ground-rotation-0', 'base-ground-rotation-1', 'base-ground-rotation-2',
  'base-ground-rotation-3', 'base-ground-herb-zone', 'base-ground-lawn-west', 'base-ground-lawn-east'
]);

const expectedPaths = [
  { points: [{ x: -16, z: -2.8 }, { x: 19.5, z: -2.8 }], width: 2 },
  { points: [{ x: 15, z: -4.45 }, { x: 19.5, z: -4.45 }], width: 1.3 },
  { points: [{ x: 0.6, z: -1.8 }, { x: 0.6, z: 10.4 }], width: 1.6 },
  { points: [{ x: -6.2, z: 11.2 }, { x: 1.4, z: 11.2 }], width: 1.6 }
];
expectedPaths.forEach((expected, index) => {
  const actual = base[index];
  assert.deepStrictEqual(actual.points, expected.points, `path ${index} deterministic center line`);
  assert(Math.abs(actual.width - expected.width) < 1e-9, `path ${index} deterministic width`);
  const ribbon = GROUND_GEOMETRY_UTILS.buildPathRibbon(actual.points, actual.width);
  assert.deepStrictEqual(pointSet(ribbon), pointSet(DATA.paths[index]), `path ${index} ribbon matches fixed polygon`);
  assert(Math.abs(GROUND_GEOMETRY_UTILS.polygonArea(ribbon) - GROUND_GEOMETRY_UTILS.polygonArea(DATA.paths[index])) < 1e-8, `path ${index} area matches fixed polygon`);
});
assert.deepStrictEqual(base.find(item => item.designId === 'base-ground-yard').points, DATA.facilities.yard, 'yard points come from fixed data');
assert.deepStrictEqual(base.find(item => item.designId === 'base-ground-herb-zone').points, DATA.herbs.ground, 'herb ground points come from fixed data');
assert.deepStrictEqual(base.find(item => item.designId === 'base-ground-lawn-west').points, DATA.lawn.west, 'west lawn points come from fixed data');
assert.deepStrictEqual(base.find(item => item.designId === 'base-ground-lawn-east').points, DATA.lawn.east, 'east lawn points come from fixed data');

const U = GROUND_GEOMETRY_UTILS;
assert.strictEqual(U.polylineLength([{ x: 0, z: 0 }, { x: 3, z: 4 }]), 5, 'polyline length');
assert.strictEqual(U.polygonArea([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2 }, { x: 0, z: 2 }]), 8, 'polygon area clockwise');
assert.strictEqual(U.polygonArea([{ x: 0, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 0 }, { x: 0, z: 0 }]), 8, 'polygon area counterclockwise');
assert.strictEqual(U.polygonPerimeter([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2 }, { x: 0, z: 2 }]), 12, 'polygon perimeter');
assert.strictEqual(U.isSimplePolygon([{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }, { x: 2, z: 0 }]), false, 'self-intersection is rejected');
assert.deepStrictEqual(U.removeAdjacentDuplicatePoints([{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 }]), [{ x: 0, z: 0 }, { x: 1, z: 0 }], 'adjacent duplicate points are removed');
[0.4, 1.2, 4].forEach(width => assert(U.buildPathRibbon([{ x: 0, z: 0 }, { x: 4, z: 0 }], width).length === 4, `width ${width} ribbon`));
const acute = U.buildPathRibbon([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4.2, z: 3 }], 1.2);
const reversal = U.buildPathRibbon([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0.1, z: 0.05 }], 1.2);
assert(acute.length >= 4 && acute.every(point => Number.isFinite(point.x) && Number.isFinite(point.z)), 'acute miter is finite');
assert(reversal.every(point => Number.isFinite(point.x) && Number.isFinite(point.z)), 'near-180-degree ribbon has no NaN');

const defaults = {
  A: { season: 'summer', growthYear: 3, density: 'standard', cropPattern: 'A', showFlowers: true, showFruit: true },
  B: { season: 'autumn', growthYear: 5, density: 'lush', cropPattern: 'B', showFlowers: true, showFruit: true }
};
const state = createDesignState({ baseTrees: DATA.trees, baseObjects: [], baseGroundFeatures: base, defaults, storageKey: 'ground-layout-test' });
assert.deepStrictEqual(state.plans.A.groundLayout, { overrides: {}, additions: [] }, 'groundLayout migration supplies empty plan A layout');
assert.deepStrictEqual(state.plans.B.groundLayout, { overrides: {}, additions: [] }, 'groundLayout migration supplies empty plan B layout');
assert.strictEqual(state.resolveGroundFeatures('A').length, 12, 'empty groundLayout resolves fixed features only');

state.updateGroundFeature('base-ground-path-0', { points: [{ x: -15.75, z: -2.8 }, { x: 19.5, z: -2.8 }], width: 1.8, materialId: 'path-soil' }, 'A');
assert.strictEqual(state.resolveGroundFeatures('A')[0].width, 1.8, 'plan A width override');
assert.strictEqual(state.resolveGroundFeatures('B')[0].width, 2, 'plan B remains independent');
assert.strictEqual(state.undoGround('A'), true, 'ground undo');
assert.strictEqual(state.resolveGroundFeatures('A')[0].width, 2, 'ground undo restores width');
assert.strictEqual(state.redoGround('A'), true, 'ground redo');
assert.strictEqual(state.resolveGroundFeatures('A')[0].width, 1.8, 'ground redo restores edit');

const additionId = state.addGroundFeature('flower-bed', { points: [{ x: -9, z: 5 }, { x: -7, z: 5 }, { x: -7, z: 7 }, { x: -9, z: 7 }], materialId: 'area-flower-bed' }, 'A');
assert(additionId.startsWith('added-ground-'), 'addition ID is namespaced');
assert.strictEqual(state.resolveGroundFeatures('A').length, 13, 'addition appears in plan A');
assert.strictEqual(state.resolveGroundFeatures('B').length, 12, 'addition does not leak into plan B');
assert.strictEqual(state.removeGroundFeature(additionId, 'A'), true, 'addition can be removed');
assert.strictEqual(state.undoGround('A'), true, 'removed addition is undoable');

const invalid = state.sanitizeGroundLayout({
  overrides: { unknown: { points: [{ x: 0, z: 0 }, { x: 2, z: 0 }], width: 2, materialId: 'path-gravel' } },
  additions: [
    { id: 'bad', featureType: 'garden-path', points: [{ x: 0, z: 0 }], width: 99, materialId: 'unknown' },
    { id: 'added-ground-valid', featureType: 'garden-path', points: [{ x: 0, z: 0 }, { x: 3, z: 0 }], width: 99, materialId: 'unknown', layer: 'bad' },
    { id: 'added-ground-crossed', featureType: 'flower-bed', points: [{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }, { x: 2, z: 0 }] }
  ]
});
assert.deepStrictEqual(invalid.overrides, {}, 'unknown fixed override is removed');
assert.strictEqual(invalid.additions.length, 1, 'invalid point sets are removed');
assert.strictEqual(invalid.additions[0].width, 4, 'path width is clamped to 4m');
assert.strictEqual(invalid.additions[0].materialId, 'path-gravel', 'unknown material falls back');
assert.strictEqual(invalid.additions[0].layer, 'paths', 'layer falls back to catalog layer');
const twentyFour = Array.from({ length: 24 }, (_, index) => ({ x: index * 0.25, z: Math.sin(index * 0.2) }));
assert.strictEqual(state.sanitizeGroundLayout({ additions: [{ id: 'added-ground-24', featureType: 'garden-path', points: twentyFour, width: 0.1 }] }).additions.length, 1, '24-point path is accepted');
assert.strictEqual(state.sanitizeGroundLayout({ additions: [{ id: 'added-ground-25', featureType: 'garden-path', points: twentyFour.concat({ x: 6.25, z: 0 }), width: 1 }] }).additions.length, 0, '25-point path is rejected');
assert.strictEqual(state.sanitizeGroundLayout({ additions: [{ id: 'added-ground-area-two', featureType: 'lawn', points: [{ x: 0, z: 0 }, { x: 2, z: 0 }] }] }).additions.length, 0, 'area requires at least three points');

const historyState = createDesignState({ baseTrees: DATA.trees, baseGroundFeatures: base, defaults, storageKey: 'ground-history-limit' });
for (let index = 0; index < 55; index += 1) historyState.updateGroundFeature('base-ground-path-0', { points: expectedPaths[0].points, width: 0.4 + (index % 30) * 0.1, materialId: 'path-gravel' }, 'A');
let undoCount = 0;
while (historyState.undoGround('A')) undoCount += 1;
assert.strictEqual(undoCount, 50, 'ground history is capped at 50 operations');
assert.strictEqual(historyState.canUndoObject('A'), false, 'ground edits do not enter object history');
assert.strictEqual(historyState.canUndo('A'), false, 'ground edits do not enter plant history');

const totals = groundFeatureTotals(state.resolveGroundFeatures('A'));
assert(totals.pathLength > 0 && totals.pathArea > 0, 'path length and area totals');
assert(Object.keys(totals.areaByMaterial).length >= 4, 'area totals are grouped by material');
assert(Object.isFrozen(DATA) && Object.isFrozen(DATA.paths), 'fixed data remains frozen');

console.log('ground layout tests passed');
