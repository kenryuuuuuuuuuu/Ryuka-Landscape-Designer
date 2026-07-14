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

load('data/fixed-site-data.js');
load('js/object-catalog.js');
load('js/design-state.js');
load('js/object-editor.js');

const expectedLayers = {
  'tool-shed': 'facilities', 'storage-box': 'facilities', 'compost-bin': 'facilities', 'rainwater-tank': 'facilities',
  'garden-bench': 'guestBeds', 'raised-bed': 'guestBeds', 'planter-box': 'herbs'
};
OBJECT_CATALOG.forEach(profile => {
  assert(profile.category, `${profile.type} has a category`);
  assert.strictEqual(profile.defaultLayer, expectedLayers[profile.type], `${profile.type} default layer`);
});

const baseObjects = createBaseObjects(DATA);
assert.strictEqual(baseObjects.length, 13, 'base object count');
assert.strictEqual(new Set(baseObjects.map(item => item.designId)).size, baseObjects.length, 'base IDs are unique');
assert.deepStrictEqual(
  { x: baseObjects[0].x, z: baseObjects[0].z },
  DATA.facilities.shed,
  'shed center comes from fixed data'
);
assert.deepStrictEqual(
  { x: baseObjects[1].x, z: baseObjects[1].z },
  DATA.guestGarden.bench,
  'bench center comes from fixed data'
);
assert(Object.isFrozen(DATA) && Object.isFrozen(DATA.facilities), 'fixed data remains frozen');

const defaults = {
  A: { season: 'summer', growthYear: 3, density: 'standard', cropPattern: 'A', showFlowers: true, showFruit: true },
  B: { season: 'autumn', growthYear: 5, density: 'lush', cropPattern: 'B', showFlowers: true, showFruit: true }
};
const state = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'object-layout-test' });
const initial = state.resolveObjects('A');
assert.strictEqual(initial.length, 13, 'empty objectLayout resolves only fixed objects');
initial.forEach(item => assert.deepStrictEqual({ x: item.x, z: item.z }, item.basePosition, `${item.designId} starts at fixed position`));

state.setActivePlan('A');
const addedId = state.addObject('compost-bin', { x: 0, z: 8 });
assert(addedId.startsWith('added-object-'), 'addition ID is namespaced');
assert.strictEqual(state.resolveObjects('A').length, 14, 'addition is stored in plan A');
assert.strictEqual(state.resolveObjects('B').length, 13, 'addition does not leak into plan B');
assert.strictEqual(state.canUndoObject('A'), true, 'object history records object edit');
assert.strictEqual(state.canUndo('A'), false, 'plant history remains independent');
assert.strictEqual(state.undoObject('A'), true, 'object undo works');
assert.strictEqual(state.resolveObjects('A').length, 13, 'object undo restores layout');
assert.strictEqual(state.redoObject('A'), true, 'object redo works');
assert.strictEqual(state.resolveObjects('A').length, 14, 'object redo reapplies layout');
const herbBed = initial.find(item => item.designId === 'base-object-herb-bed-0');
const duplicateBedId = state.addObject('raised-bed', { x: -10, z: 10 }, 'A', herbBed);
const duplicateBed = state.resolveObjects('A').find(item => item.designId === duplicateBedId);
assert.strictEqual(duplicateBed.width, 2.2, 'duplicate preserves allowed source dimensions');
assert.strictEqual(duplicateBed.depth, 1.1, 'duplicate preserves herb-bed depth');
assert.strictEqual(duplicateBed.height, 0.42, 'duplicate preserves v4.7 frame target height');
assert.strictEqual(duplicateBed.layer, 'herbs', 'duplicate preserves source layer');
assert.strictEqual(duplicateBed.sizePreset, 'herb-bed', 'duplicate preserves allowed size preset');

const layerState = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'object-layer-test' });
Object.entries(expectedLayers).forEach(([type, layer], index) => {
  const id = layerState.addObject(type, { x: index, z: 12 }, 'A');
  assert.strictEqual(layerState.resolveObjects('A').find(item => item.designId === id).layer, layer, `${type} addition uses catalog layer`);
});
assert.strictEqual(layerState.resolveObjects('A').find(item => item.type === 'raised-bed' && item.sourceType === 'added').height, 0.42, 'added raised bed uses a 0.42m target height');

const sanitized = layerState.sanitizeObjectLayout({ additions: [
  { id: 'added-object-oversize', type: 'storage-box', x: 1, z: 2, width: 19, depth: 19, height: 19, rotation: 1e100, layer: 'not-a-layer' },
  { id: 'added-object-herb-preset', type: 'raised-bed', x: 2, z: 3, width: 2.2, depth: 1.1, height: 0.42, sizePreset: 'herb-bed', layer: 'herbs', rotation: Infinity },
  { id: 'added-object-invalid-coordinate', type: 'garden-bench', x: NaN, z: 1 }
] });
assert.strictEqual(sanitized.additions.length, 2, 'invalid coordinates are removed');
const oversize = sanitized.additions.find(item => item.id === 'added-object-oversize');
assert.deepStrictEqual([oversize.width, oversize.depth, oversize.height], [0.9, 0.9, 0.9], 'arbitrary dimensions reset to catalog values');
assert.strictEqual(oversize.layer, 'facilities', 'invalid layer resets to catalog layer');
assert(oversize.rotation >= -Math.PI && oversize.rotation < Math.PI, 'huge rotation is normalized');
const sanitizedHerb = sanitized.additions.find(item => item.id === 'added-object-herb-preset');
assert.deepStrictEqual([sanitizedHerb.width, sanitizedHerb.depth, sanitizedHerb.height], [2.2, 1.1, 0.42], 'explicit herb-bed preset is retained');
assert.strictEqual(sanitizedHerb.rotation, 0, 'non-finite rotation resets safely');

const planState = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'object-plan-validation-test' });
planState.addObject('compost-bin', { x: -12, z: 12 }, 'A');
planState.addObject('rainwater-tank', { x: 12, z: 12 }, 'B');
const seenPlans = new Set();
planState.cleanInvalidObjects((item, x, z, rotation, planKey, context) => {
  seenPlans.add(planKey);
  const addedTypes = context.objects.filter(object => object.sourceType === 'added').map(object => object.type);
  assert.deepStrictEqual(addedTypes, planKey === 'A' ? ['compost-bin'] : ['rainwater-tank'], `${planKey} uses its own object snapshot`);
  assert.strictEqual(context.plants.length, DATA.trees.length, `${planKey} uses its own plant snapshot`);
  return true;
});
assert.deepStrictEqual(Array.from(seenPlans).sort(), ['A', 'B'], 'both plans are validated');

const F = OBJECT_FOOTPRINT_UTILS;
const circle = { width: 2, depth: 2, footprint: 'circle' };
const box = { width: 2, depth: 1, footprint: 'box' };
assert(F.footprintOverlap(circle, 0, 0, 0, circle, 1.5, 0, Math.PI / 4), 'circle-circle overlap is detected');
assert(!F.footprintOverlap(circle, 0, 0, 0, circle, 2.1, 0, 0), 'separate circles do not overlap');
assert(F.footprintOverlap(circle, 0, 0, 0, box, 1.2, 0, Math.PI / 4), 'circle-OBB overlap is detected');
assert(F.footprintOverlap(box, 0, 0, Math.PI / 4, box, 1, 0, -Math.PI / 4), 'OBB-OBB overlap is detected');
assert(F.circlePoints(circle, 0, 0, 0, 24).length >= 16, 'circle boundary uses at least 16 samples');
const squareSite = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }];
assert(F.circlePoints(circle, 4.5, 0, 0, 24).some(point => !F.pointInPolygon(point.x, point.z, squareSite)), 'circle circumference detects a site-boundary crossing');

const historyState = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'object-history-test' });
for (let index = 0; index < 55; index += 1) historyState.updateObject('base-object-garden-bench', { x: DATA.guestGarden.bench.x + (index + 1) * 0.01, z: DATA.guestGarden.bench.z, rotation: 0 });
let undoCount = 0;
while (historyState.undoObject('A')) undoCount += 1;
assert.strictEqual(undoCount, 50, 'object history is capped at 50 operations');

storage.set('migration-test', JSON.stringify({ A: defaults.A, B: defaults.B }));
const migrated = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'migration-test' });
assert.deepStrictEqual(migrated.plans.A.objectLayout, { overrides: {}, additions: [] }, 'pre-v4.8 plan migrates to empty objectLayout');

const threeSandbox = { console };
threeSandbox.window = threeSandbox;
threeSandbox.self = threeSandbox;
vm.createContext(threeSandbox);
vm.runInContext(fs.readFileSync('vendor/three.min.js', 'utf8'), threeSandbox, { filename: 'vendor/three.min.js' });
global.THREE = threeSandbox.THREE;
load('js/object-models.js');
const material = () => new THREE.MeshBasicMaterial();
const modelOptions = { mode: 'real', modelDetail: 'simple', wood: material(), roof: material(), soil: material(), gravel: material() };
const shedObject = initial.find(item => item.designId === 'base-object-tool-shed');
const shedModel = createObjectModel(shedObject, modelOptions);
shedModel.updateMatrixWorld(true);
const doorPosition = new THREE.Vector3();
shedModel.getObjectByName('shed-door').getWorldPosition(doorPosition);
assert(Math.abs(doorPosition.x - DATA.facilities.shedDoor.x) < 1e-9, 'fallback shed door fixed x matches v4.7');
assert(Math.abs(doorPosition.z - DATA.facilities.shedDoor.z) < 1e-9, 'fallback shed door fixed z matches v4.7');

const expectedClusterCount = object => {
  const random = (() => { let seed = object.seed >>> 0; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const columns = Math.max(2, Math.floor(object.width / 0.42)), rows = Math.max(2, Math.floor(object.depth / 0.42));
  let count = 0;
  for (let ix = 0; ix < columns; ix += 1) for (let iz = 0; iz < rows; iz += 1) if (random() >= 0.18) count += 1;
  return count;
};
initial.filter(item => item.type === 'raised-bed').forEach(object => {
  const model = createObjectModel(object, modelOptions), count = expectedClusterCount(object);
  assert.strictEqual(object.height, 0.42, `${object.designId} uses a 0.42m GLB target height`);
  assert.strictEqual(model.children[0].scale.y, 0.38, `${object.designId} fallback frame remains 0.38m high`);
  assert.strictEqual(model.children[0].position.y, 0.19, `${object.designId} fallback frame base remains unchanged`);
  assert.strictEqual(model.children[1].position.y, 0.42, `${object.designId} soil surface position remains unchanged`);
  assert.strictEqual(model.userData.plantClusterCount, count, `${object.designId} preserves v4.7 random sequence`);
  assert.strictEqual(model.userData.plantLeafCount, count * 5, `${object.designId} has five leaves per cluster`);
});
const assetTargets = [];
const assetManager = {
  createInstance(id, options) {
    assetTargets.push({ id, variant: options.variant, targetSize: { ...options.targetSize } });
    return new THREE.Group();
  }
};
const sampleBed = initial.find(item => item.designId === 'base-object-guest-bed-0');
['high', 'low'].forEach(variant => createObjectModel(sampleBed, { ...modelOptions, modelDetail: 'detailed', variant, assetManager }));
assert.deepStrictEqual(assetTargets, [
  { id: 'raised-bed-frame', variant: 'high', targetSize: { x: 2.4, y: 0.42, z: 1.2 } },
  { id: 'raised-bed-frame', variant: 'low', targetSize: { x: 2.4, y: 0.42, z: 1.2 } }
], 'HIGH and LOW raised-bed GLBs use a 0.42m target height');
const pergola = createObjectModel(initial.find(item => item.designId === 'base-object-pergola'), modelOptions);
assert.strictEqual(pergola.userData.pergolaLeafCount, 28, 'pergola restores 28 leaf clusters');
assert.strictEqual(pergola.userData.pergolaStructuralParts, 15, 'pergola restores all structural and bench parts');

console.log('object layout tests passed');
