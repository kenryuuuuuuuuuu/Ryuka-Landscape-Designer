(function exposeGroundFeatureModels(global) {
  'use strict';

  const EPSILON = 1e-8;
  const clonePoints = points => points.map(point => ({ x: Number(point.x), z: Number(point.z) }));
  const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

  function removeAdjacentDuplicatePoints(points, minimum = 1e-6) {
    const clean = [];
    (Array.isArray(points) ? points : []).forEach(point => {
      if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.z))) return;
      const next = { x: Number(point.x), z: Number(point.z) };
      if (!clean.length || distance(clean[clean.length - 1], next) >= minimum) clean.push(next);
    });
    if (clean.length > 1 && distance(clean[0], clean[clean.length - 1]) < minimum) clean.pop();
    return clean;
  }
  function removeAdjacentDuplicatePolylinePoints(points, minimum = 1e-6) {
    const clean = [];
    (Array.isArray(points) ? points : []).forEach(point => {
      if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.z))) return;
      const next = { x: Number(point.x), z: Number(point.z) };
      if (!clean.length || distance(clean[clean.length - 1], next) >= minimum) clean.push(next);
    });
    return clean;
  }
  function polylineLength(points) {
    const clean = removeAdjacentDuplicatePolylinePoints(points);
    let total = 0;
    for (let index = 1; index < clean.length; index += 1) total += distance(clean[index - 1], clean[index]);
    return total;
  }
  function polygonArea(points) {
    const clean = removeAdjacentDuplicatePoints(points);
    let sum = 0;
    for (let index = 0; index < clean.length; index += 1) {
      const next = clean[(index + 1) % clean.length];
      sum += clean[index].x * next.z - next.x * clean[index].z;
    }
    return Math.abs(sum) / 2;
  }
  function signedPolygonArea(points) {
    let sum = 0;
    for (let index = 0; index < points.length; index += 1) {
      const next = points[(index + 1) % points.length];
      sum += points[index].x * next.z - next.x * points[index].z;
    }
    return sum / 2;
  }
  function polygonPerimeter(points) {
    const clean = removeAdjacentDuplicatePoints(points);
    let total = 0;
    for (let index = 0; index < clean.length; index += 1) total += distance(clean[index], clean[(index + 1) % clean.length]);
    return total;
  }
  function orientation(a, b, c) {
    const value = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    return Math.abs(value) < EPSILON ? 0 : Math.sign(value);
  }
  function onSegment(a, b, point) {
    return point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON && point.z >= Math.min(a.z, b.z) - EPSILON && point.z <= Math.max(a.z, b.z) + EPSILON;
  }
  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && onSegment(a, b, c)) || (o2 === 0 && onSegment(a, b, d)) || (o3 === 0 && onSegment(c, d, a)) || (o4 === 0 && onSegment(c, d, b));
  }
  function isSimplePolygon(points) {
    const clean = removeAdjacentDuplicatePoints(points);
    if (clean.length < 3 || polygonArea(clean) < EPSILON) return false;
    for (let first = 0; first < clean.length; first += 1) {
      const firstNext = (first + 1) % clean.length;
      for (let second = first + 1; second < clean.length; second += 1) {
        const secondNext = (second + 1) % clean.length;
        if (first === second || firstNext === second || secondNext === first) continue;
        if (segmentsIntersect(clean[first], clean[firstNext], clean[second], clean[secondNext])) return false;
      }
    }
    return true;
  }
  function lineIntersection(a, directionA, b, directionB) {
    const cross = directionA.x * directionB.z - directionA.z * directionB.x;
    if (Math.abs(cross) < EPSILON) return null;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = (dx * directionB.z - dz * directionB.x) / cross;
    return { x: a.x + directionA.x * t, z: a.z + directionA.z * t };
  }
  function segmentIntersectionPoint(a, b, c, d) {
    const directionA = { x: b.x - a.x, z: b.z - a.z }, directionB = { x: d.x - c.x, z: d.z - c.z };
    const cross = directionA.x * directionB.z - directionA.z * directionB.x;
    if (Math.abs(cross) < EPSILON) return null;
    const dx = c.x - a.x, dz = c.z - a.z;
    const first = (dx * directionB.z - dz * directionB.x) / cross;
    const second = (dx * directionA.z - dz * directionA.x) / cross;
    if (first <= EPSILON || first >= 1 - EPSILON || second <= EPSILON || second >= 1 - EPSILON) return null;
    return { x: a.x + directionA.x * first, z: a.z + directionA.z * first };
  }
  function removePolygonLoops(points) {
    let clean = removeAdjacentDuplicatePoints(points);
    for (let pass = 0; pass < 12; pass += 1) {
      let repaired = false;
      for (let first = 0; first < clean.length && !repaired; first += 1) {
        const firstNext = (first + 1) % clean.length;
        for (let second = first + 2; second < clean.length; second += 1) {
          const secondNext = (second + 1) % clean.length;
          if (secondNext === first) continue;
          const crossing = segmentIntersectionPoint(clean[first], clean[firstNext], clean[second], clean[secondNext]);
          if (!crossing) continue;
          const firstLoop = [crossing, ...clean.slice(firstNext, second + 1)];
          const secondLoop = [crossing, ...clean.slice(secondNext), ...clean.slice(0, first + 1)];
          clean = removeAdjacentDuplicatePoints(polygonArea(firstLoop) >= polygonArea(secondLoop) ? firstLoop : secondLoop);
          repaired = true; break;
        }
      }
      if (!repaired) break;
    }
    return clean;
  }
  function pathRibbonResult(points, width, miterLimit = 3) {
    const clean = removeAdjacentDuplicatePolylinePoints(points);
    const safeWidth = Number(width);
    const failure = (code, message) => ({ points: [], code, message });
    if (clean.length < 2 || clean.length > 24 || !Number.isFinite(safeWidth) || safeWidth <= 0) {
      return failure('invalid-input', '園路の頂点または幅が不正です');
    }
    const half = safeWidth / 2;
    const directions = [], normals = [];
    for (let index = 0; index < clean.length - 1; index += 1) {
      const dx = clean[index + 1].x - clean[index].x, dz = clean[index + 1].z - clean[index].z;
      const length = Math.hypot(dx, dz);
      if (length < EPSILON) return failure('degenerate-segment', '園路に長さのない辺があります');
      directions.push({ x: dx / length, z: dz / length });
      normals.push({ x: -dz / length, z: dx / length });
    }
    for (let index = 1; index < directions.length; index += 1) {
      const dot = directions[index - 1].x * directions[index].x + directions[index - 1].z * directions[index].z;
      const cross = directions[index - 1].x * directions[index].z - directions[index - 1].z * directions[index].x;
      if (dot < -1 + 1e-7 && Math.abs(cross) < 5e-4) {
        return failure('path-reversal', '園路が鋭く折り返しすぎています');
      }
    }
    const sidePoints = sign => {
      const outline = [{ x: clean[0].x + normals[0].x * half * sign, z: clean[0].z + normals[0].z * half * sign }];
      for (let index = 1; index < clean.length - 1; index += 1) {
        const previous = normals[index - 1], next = normals[index];
        const previousDirection = directions[index - 1], nextDirection = directions[index];
        const dot = previousDirection.x * nextDirection.x + previousDirection.z * nextDirection.z;
        const cross = previousDirection.x * nextDirection.z - previousDirection.z * nextDirection.x;
        const first = { x: clean[index].x + previous.x * half * sign, z: clean[index].z + previous.z * half * sign };
        const second = { x: clean[index].x + next.x * half * sign, z: clean[index].z + next.z * half * sign };
        if (dot > 1 - 1e-7 && Math.abs(cross) < 5e-4) {
          outline.push(first);
          continue;
        }
        const intersection = lineIntersection(first, previousDirection, second, nextDirection);
        const miterLength = intersection ? distance(clean[index], intersection) : Infinity;
        if (intersection && Number.isFinite(miterLength) && miterLength <= half * miterLimit) outline.push(intersection);
        else if (intersection && Number.isFinite(miterLength) && cross * sign > 0) {
          const ratio = half * miterLimit / miterLength;
          outline.push({ x: clean[index].x + (intersection.x - clean[index].x) * ratio, z: clean[index].z + (intersection.z - clean[index].z) * ratio });
        } else outline.push(first, second);
      }
      const lastNormal = normals[normals.length - 1], last = clean[clean.length - 1];
      outline.push({ x: last.x + lastNormal.x * half * sign, z: last.z + lastNormal.z * half * sign });
      return outline;
    };
    const left = sidePoints(1), right = sidePoints(-1).reverse();
    let polygon = removeAdjacentDuplicatePoints(left.concat(right));
    if (polygon.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.z))) return failure('non-finite', '園路形状を計算できません');
    if (polygon.length < 4 || polygonArea(polygon) <= EPSILON) return failure('degenerate-ribbon', '園路の外周面積を確保できません');
    if (!isSimplePolygon(polygon)) polygon = removePolygonLoops(polygon);
    if (!isSimplePolygon(polygon)) return failure('self-intersection', '園路が鋭く折り返しすぎています');
    return { points: polygon, code: null, message: '' };
  }
  function buildPathRibbon(points, width, miterLimit = 3) {
    return pathRibbonResult(points, width, miterLimit).points;
  }
  function polylineMidpoint(points) {
    const clean = removeAdjacentDuplicatePolylinePoints(points);
    if (!clean.length) return { x: 0, z: 0 };
    const total = polylineLength(clean);
    if (total < EPSILON) return { ...clean[0] };
    let remaining = total / 2;
    for (let index = 1; index < clean.length; index += 1) {
      const segment = distance(clean[index - 1], clean[index]);
      if (remaining <= segment) {
        const ratio = remaining / segment;
        return { x: clean[index - 1].x + (clean[index].x - clean[index - 1].x) * ratio, z: clean[index - 1].z + (clean[index].z - clean[index - 1].z) * ratio };
      }
      remaining -= segment;
    }
    return { ...clean[clean.length - 1] };
  }
  function verticalPolygonIntervals(polygon, x) {
    const clean = removeAdjacentDuplicatePoints(polygon);
    if (clean.length < 3 || !isSimplePolygon(clean) || !Number.isFinite(x)) return [];
    const intersections = [];
    for (let index = 0; index < clean.length; index += 1) {
      const a = clean[index], b = clean[(index + 1) % clean.length];
      if (!((a.x <= x && b.x > x) || (b.x <= x && a.x > x))) continue;
      intersections.push(a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x));
    }
    intersections.sort((a, b) => a - b);
    const unique = intersections.filter((value, index) => !index || Math.abs(value - intersections[index - 1]) > 1e-7);
    const intervals = [];
    for (let index = 0; index + 1 < unique.length; index += 2) {
      if (unique[index + 1] - unique[index] > 1e-6) intervals.push({ minZ: unique[index], maxZ: unique[index + 1] });
    }
    return intervals;
  }
  function centroid(points) {
    const clean = removeAdjacentDuplicatePoints(points);
    if (!clean.length) return { x: 0, z: 0 };
    const area = signedPolygonArea(clean);
    if (Math.abs(area) < EPSILON) {
      const sum = clean.reduce((result, point) => ({ x: result.x + point.x, z: result.z + point.z }), { x: 0, z: 0 });
      return { x: sum.x / clean.length, z: sum.z / clean.length };
    }
    let x = 0, z = 0;
    for (let index = 0; index < clean.length; index += 1) {
      const next = clean[(index + 1) % clean.length], factor = clean[index].x * next.z - next.x * clean[index].z;
      x += (clean[index].x + next.x) * factor; z += (clean[index].z + next.z) * factor;
    }
    return { x: x / (6 * area), z: z / (6 * area) };
  }
  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if (((a.z > point.z) !== (b.z > point.z)) && point.x < (b.x - a.x) * (point.z - a.z) / ((b.z - a.z) || EPSILON) + a.x) inside = !inside;
    }
    return inside;
  }
  function polygonsOverlap(first, second) {
    for (let i = 0; i < first.length; i += 1) for (let j = 0; j < second.length; j += 1) {
      if (segmentsIntersect(first[i], first[(i + 1) % first.length], second[j], second[(j + 1) % second.length])) return true;
    }
    return first.some(point => pointInPolygon(point, second)) || second.some(point => pointInPolygon(point, first));
  }
  function shapeGeometry(THREE, polygon, origin) {
    const normalized = signedPolygonArea(polygon) < 0 ? [...polygon].reverse() : polygon;
    const shape = new THREE.Shape();
    normalized.forEach((point, index) => {
      const x = point.x - origin.x, y = -(point.z - origin.z);
      if (index) shape.lineTo(x, y); else shape.moveTo(x, y);
    });
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }

  let cachedMaterials = null;
  function createGroundFeatureMaterials(THREE, ground) {
    if (cachedMaterials) return cachedMaterials;
    const weed = new THREE.MeshStandardMaterial({ color: 0x3f4341, roughness: 0.96, metalness: 0 });
    const plan = {
      'path-gravel': ground.planPath, 'path-soil': ground.planSoil, 'path-stone': new THREE.MeshBasicMaterial({ color: 0xb6b0a1 }),
      'area-lawn': new THREE.MeshBasicMaterial({ color: 0x6f9f54 }), 'area-clover': ground.planClover,
      'area-gravel': ground.planGravel, 'area-flower-bed': new THREE.MeshBasicMaterial({ color: 0xa77568 }),
      'area-vegetable': ground.planSoil, 'area-herb': new THREE.MeshBasicMaterial({ color: 0x8176a6 }),
      'area-weed-control': new THREE.MeshBasicMaterial({ color: 0x555b59 }), 'area-yard-gravel': ground.planGravel
    };
    const real = {
      'path-gravel': ground.path, 'path-soil': ground.rotationSoil, 'path-stone': ground.pergolaGravel,
      'area-lawn': ground.clover, 'area-clover': ground.clover, 'area-gravel': ground.yardGravel,
      'area-flower-bed': ground.guestSoil, 'area-vegetable': ground.rotationSoil, 'area-herb': ground.guestSoil,
      'area-weed-control': weed, 'area-yard-gravel': ground.yardGravel
    };
    cachedMaterials = Object.freeze({ real: Object.freeze(real), plan: Object.freeze(plan), weed });
    return cachedMaterials;
  }
  function createGroundFeatureModel(item, options) {
    const { THREE, mode, materials } = options;
    const surface = item.kind === 'path' ? buildPathRibbon(item.points, item.width) : clonePoints(item.points);
    if (surface.length < 3) return null;
    const center = centroid(surface), root = new THREE.Group();
    root.position.set(center.x, 0, center.z);
    Object.assign(root.userData, { designId: item.designId, featureType: item.featureType, kind: item.kind, layer: item.layer, sourceType: item.sourceType });
    const material = materials[mode === 'plan' ? 'plan' : 'real'][item.materialId];
    const mesh = new THREE.Mesh(shapeGeometry(THREE, surface, center), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = item.y ?? 0.041; mesh.receiveShadow = true; mesh.userData.designId = item.designId;
    const linePoints = surface.map(point => new THREE.Vector3(point.x - center.x, (item.y ?? 0.041) + 0.012, point.z - center.z));
    linePoints.push(linePoints[0].clone());
    const status = options.status?.state || 'valid';
    const outlineColor = status === 'invalid' ? 0xe85d5d : status === 'warning' ? 0xe3ba52 : mode === 'plan' ? 0x3d4c4d : 0xe9ddbe;
    const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: mode === 'plan' ? 0.78 : 0.32 }));
    outline.visible = mode === 'plan' || !!options.editing || !!options.selected;
    outline.userData.designId = item.designId;
    root.add(mesh, outline);
    return { group: root, mesh, outline, item, modelType: item.kind, layer: item.layer, surface };
  }
  function groundTotals(features) {
    const totals = { pathLength: 0, pathArea: 0, areaByMaterial: {} };
    features.forEach(item => {
      if (item.kind === 'path') { totals.pathLength += item.length || 0; totals.pathArea += item.area || 0; }
      else totals.areaByMaterial[item.materialId] = (totals.areaByMaterial[item.materialId] || 0) + (item.area || 0);
    });
    return totals;
  }

  global.GROUND_GEOMETRY_UTILS = Object.freeze({ removeAdjacentDuplicatePoints, removeAdjacentDuplicatePolylinePoints, polylineLength, polylineMidpoint, polygonArea, polygonPerimeter, segmentsIntersect, isSimplePolygon, pathRibbonResult, buildPathRibbon, verticalPolygonIntervals, centroid, pointInPolygon, polygonsOverlap });
  global.createGroundFeatureMaterials = createGroundFeatureMaterials;
  global.createGroundFeatureModel = createGroundFeatureModel;
  global.groundFeatureTotals = groundTotals;
})(window);
