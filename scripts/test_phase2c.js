const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

class StubResource {
  constructor(...args) { this.args = args; }
}
const context = {
  window: {},
  THREE: {
    MeshStandardMaterial: StubResource,
    MeshPhysicalMaterial: StubResource,
    MeshBasicMaterial: StubResource,
    BoxGeometry: StubResource,
    DoubleSide: 2
  },
  console
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source('js/parking-model.js'), context, { filename: 'parking-model.js' });
vm.runInContext(source('js/site-model.js'), context, { filename: 'site-model.js' });
vm.runInContext(source('js/workspaces.js'), context, { filename: 'workspaces.js' });

const parking = context.window.PARKING_DATA;
const road = context.window.ROAD_DATA;
const workspaces = context.window.WORKSPACES;
const plain = value => JSON.parse(JSON.stringify(value));

const originalLayouts = {
  guest: [[-4.6, 5.0], [-1.8, 5.0]],
  A: [[21.3, 2.5], [22.5, 8.7]],
  B: [[21.9, 7.35], [24.7, 7.35]],
  C: [[23.6, 6.3], [23.6, 8.9]]
};
const expected = {
  guest: [[-11.946, -9.454], [-9.146, -9.454]],
  A: [[13.954, -11.954], [15.154, -5.754]],
  B: [[14.554, -7.104], [17.354, -7.104]],
  C: [[16.254, -8.154], [16.254, -5.554]]
};
const round = value => Math.round(value * 1e6) / 1e6;
const formula = ([x, z]) => [round(-7.346 + x), round(-13.089 + (z - 1.365))];
const offset = ([x, z]) => [round(x - 7.346), round(z - 14.454)];
const matrix = ([x, z]) => {
  const affine = [[1, 0, -7.346], [0, 1, -14.454], [0, 0, 1]];
  return [round(affine[0][0] * x + affine[0][1] * z + affine[0][2]), round(affine[1][0] * x + affine[1][1] * z + affine[1][2])];
};

for (const [layout, points] of Object.entries(originalLayouts)) {
  assert.deepStrictEqual(points.map(formula), expected[layout], `${layout}: formula conversion mismatch`);
  assert.deepStrictEqual(points.map(offset), expected[layout], `${layout}: offset conversion mismatch`);
  assert.deepStrictEqual(points.map(matrix), expected[layout], `${layout}: affine conversion mismatch`);
}

assert.deepStrictEqual(plain(parking.guestCars.map(item => [item.x, item.z])), expected.guest);
for (const key of ['A', 'B', 'C']) assert.deepStrictEqual(plain(parking.ownerLayouts[key].map(item => [item.x, item.z])), expected[key]);
assert.strictEqual(Object.keys(parking.ownerLayouts).length, 3);
assert.strictEqual(Object.keys(parking.carportBounds).length, 3);

assert.deepStrictEqual(plain(road.turnaround.map(point => [point.x, point.z])), [
  [14.264, -14.954], [19.454, -15.054], [19.454, -9.664], [16.614, -9.664]
]);
assert.strictEqual(Object.keys(road).length, 4);

assert(workspaces.field && workspaces.exterior, 'field/exterior workspaces are required');
assert(workspaces.exterior.sections.includes('appearance'));
assert(workspaces.exterior.sections.includes('parking'));
assert(workspaces.exterior.layers.includes('road'));
assert(workspaces.exterior.layers.includes('parking'));
assert(!workspaces.field.layers.includes('road'));
assert(!workspaces.field.layers.includes('parking'));

const fixedSource = source('data/fixed-site-data.js');
assert(fixedSource.includes('sugiSiding: { xMax: 11.40 }'));
const materialSource = source('js/building-materials.js');
assert(materialSource.includes('function sugiPainter'));
assert(materialSource.includes('syncWallFlat'));
assert(materialSource.includes('wallFlat'));
const modelSource = source('js/building-model.js');
assert(modelSource.includes("const material = s.mat === 'sugi' ? m.sugi : m.wall"));
assert(modelSource.includes('m.wallFlat'));
assert(modelSource.includes('B.sugiSiding.xMax'));
const indexSource = source('index.html');
for (const file of ['./js/parking-model.js', './js/site-model.js']) assert(indexSource.includes(file));
for (const id of ['workspaceSeg', 'tgVertex', 'tgLength', 'tgBDim', 'tgCars', 'tgCarport']) assert(indexSource.includes(`id="${id}"`));

console.log('Phase 2c tests passed');
console.log('parking coordinates verified independently by formula, offset, and affine matrix');
