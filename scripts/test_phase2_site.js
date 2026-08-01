const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('data/fixed-site-data.js', 'utf8'), context);
const DATA = context.window.DATA;

function area(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function onSegment(point, a, b) {
  if (Math.abs(orientation(a, b, point)) > 1e-8) return false;
  return point.x >= Math.min(a.x, b.x) - 1e-8 && point.x <= Math.max(a.x, b.x) + 1e-8
    && point.z >= Math.min(a.z, b.z) - 1e-8 && point.z <= Math.max(a.z, b.z) + 1e-8;
}

function segmentsCross(a, b, c, d) {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  return o1 * o2 < -1e-10 && o3 * o4 < -1e-10;
}

function isSimple(poly) {
  for (let i = 0; i < poly.length; i += 1) {
    for (let j = i + 1; j < poly.length; j += 1) {
      if (j === i || j === (i + 1) % poly.length || i === (j + 1) % poly.length) continue;
      if (segmentsCross(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length])) return false;
    }
  }
  return true;
}

function contains(poly, point) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[j], b = poly[i];
    if (onSegment(point, a, b)) return true;
    if ((b.z > point.z) !== (a.z > point.z)
      && point.x < ((a.x - b.x) * (point.z - b.z)) / (a.z - b.z) + b.x) inside = !inside;
  }
  return inside;
}

assert.strictEqual(DATA.site.length, 14);
assert.strictEqual(DATA.takuchiSite.length, 11);
assert.strictEqual(DATA.fieldSite.length, 7);
assert(isSimple(DATA.site));
assert(isSimple(DATA.takuchiSite));
assert(isSimple(DATA.fieldSite));
assert(Math.abs(area(DATA.site) - 971.0246) < 0.001);
assert(Math.abs(area(DATA.takuchiSite) - 320.9453) < 0.001);
assert(Math.abs(area(DATA.fieldSite) - 650.0793) < 0.001);
assert(Math.abs(area(DATA.takuchiSite) + area(DATA.fieldSite) - area(DATA.site)) < 0.001);

const v5Site = [
  [-5.400, -0.500], [21.610, -0.500], [23.960, 1.690], [23.960, 4.790],
  [27.300, 4.790], [27.300, 10.600], [20.510, 10.600], [20.510, 9.600],
  [-5.025, 9.600], [-6.000, 5.727], [-6.253, 2.275]
];
const converted = v5Site.map(([x, z]) => ({ x: DATA.building.origin.x + x, z: DATA.building.origin.z + z - 1.365 }));
converted.forEach((point, index) => {
  assert(Math.abs(point.x - DATA.takuchiSite[index].x) < 1e-9);
  assert(Math.abs(point.z - DATA.takuchiSite[index].z) < 1e-9);
});

const B = DATA.building;
[
  { x: B.origin.x, z: B.origin.z },
  { x: B.origin.x + B.w, z: B.origin.z },
  { x: B.origin.x, z: B.origin.z + B.d },
  { x: B.origin.x + B.w, z: B.origin.z + B.d }
].forEach(point => assert(contains(DATA.takuchiSite, point), `building corner outside: ${JSON.stringify(point)}`));

const points = [];
const add = (name, point) => points.push({ name, point });
DATA.paths.forEach((poly, i) => poly.forEach((point, j) => add(`paths[${i}][${j}]`, point)));
DATA.rotations.forEach((item, i) => {
  for (const dx of [-item.w / 2, item.w / 2]) for (const dz of [-item.d / 2, item.d / 2]) {
    add(`rotations[${i}] corner`, { x: item.cx + dx, z: item.cz + dz });
  }
});
DATA.trees.forEach((point, i) => add(`trees[${i}] ${point.name}`, point));
DATA.facilities.yard.forEach((point, i) => add(`facilities.yard[${i}]`, point));
['shed', 'shedDoor', 'well', 'pump', 'basin'].forEach(key => add(`facilities.${key}`, DATA.facilities[key]));
DATA.facilities.storage.forEach((point, i) => add(`facilities.storage[${i}]`, point));
DATA.guestGarden.beds.forEach((point, i) => add(`guestGarden.beds[${i}]`, point));
add('guestGarden.bench', DATA.guestGarden.bench);
DATA.guestGarden.benchLegs.forEach((point, i) => add(`guestGarden.benchLegs[${i}]`, point));
DATA.herbs.ground.forEach((point, i) => add(`herbs.ground[${i}]`, point));
DATA.herbs.beds.forEach((point, i) => add(`herbs.beds[${i}]`, point));
DATA.herbs.clusters.forEach((point, i) => add(`herbs.clusters[${i}]`, point));
add('herbs.accent', DATA.herbs.accent);
DATA.lawn.west.forEach((point, i) => add(`lawn.west[${i}]`, point));
DATA.lawn.east.forEach((point, i) => add(`lawn.east[${i}]`, point));
add('lawn.pergola', DATA.lawn.pergola);

const outside = points.filter(({ point }) => !contains(DATA.takuchiSite, point) && !contains(DATA.fieldSite, point));
assert.deepStrictEqual(outside.map(item => item.name), ['facilities.yard[1]']);
assert.strictEqual(DATA.building.openings.length, 18);
assert.strictEqual(DATA.building.sodekabe.length, 2);
assert.strictEqual(DATA.building.screenWalls.length, 2);

console.log('Phase 2a/2b site tests passed');
console.log(`areas: total=${area(DATA.site).toFixed(4)} takuchi=${area(DATA.takuchiSite).toFixed(4)} field=${area(DATA.fieldSite).toFixed(4)}`);
console.log(`fixed points checked: ${points.length}; outside: ${outside.map(item => `${item.name} (${item.point.x}, ${item.point.z})`).join(', ')}`);
