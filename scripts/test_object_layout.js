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
assert.strictEqual(state.resolveObjects('A').find(item => item.designId === duplicateBedId).width, 2.2, 'duplicate preserves source dimensions');

const historyState = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'object-history-test' });
for (let index = 0; index < 55; index += 1) historyState.updateObject('base-object-garden-bench', { x: DATA.guestGarden.bench.x + (index + 1) * 0.01, z: DATA.guestGarden.bench.z, rotation: 0 });
let undoCount = 0;
while (historyState.undoObject('A')) undoCount += 1;
assert.strictEqual(undoCount, 50, 'object history is capped at 50 operations');

storage.set('migration-test', JSON.stringify({ A: defaults.A, B: defaults.B }));
const migrated = createDesignState({ baseTrees: DATA.trees, baseObjects, defaults, storageKey: 'migration-test' });
assert.deepStrictEqual(migrated.plans.A.objectLayout, { overrides: {}, additions: [] }, 'pre-v4.8 plan migrates to empty objectLayout');

console.log('object layout tests passed');
