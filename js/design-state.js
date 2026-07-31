(function exposeDesignState(global) {
  'use strict';

  const CATALOG = Object.freeze([
    { name: 'ウメ', r: 1.3, h: 1.6, bush: false, evergreen: false, spacing: 3.0 },
    { name: 'イチジク', r: 1.2, h: 1.5, bush: false, evergreen: false, spacing: 3.0 },
    { name: 'ブルーベリー', r: 0.75, h: 1.5, bush: true, evergreen: false, spacing: 1.5 },
    { name: 'ユズ', r: 1.1, h: 1.4, bush: false, evergreen: true, spacing: 3.0 },
    { name: 'キンカン', r: 0.9, h: 1.2, bush: false, evergreen: true, spacing: 2.5 },
    { name: '甘夏', r: 1.2, h: 1.5, bush: false, evergreen: true, spacing: 3.5 },
    { name: 'カキ', r: 1.4, h: 1.7, bush: false, evergreen: false, spacing: 3.5 },
    { name: 'ジューンベリー', r: 1.0, h: 1.4, bush: false, evergreen: false, spacing: 2.5 },
    { name: 'ヤマボウシ', r: 1.1, h: 1.6, bush: false, evergreen: false, spacing: 3.0 }
  ]);
  const CATALOG_BY_NAME = new Map(CATALOG.map(item => [item.name, item]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = value => Number.isFinite(Number(value));
  const safeCoordinate = value => finite(value) && Math.abs(Number(value)) <= 1000;
  const OBJECT_LAYERS = new Set(global.OBJECT_ALLOWED_LAYERS || ['facilities', 'guestBeds', 'herbs', 'lawn']);

  function normalizeRotation(value) {
    const twoPi = Math.PI * 2;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return ((numeric + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  }

  function allowedSize(profile, item = {}) {
    const presets = profile.sizePresets || { 'catalog-default': [profile.width, profile.depth, profile.height] };
    let preset = typeof item.sizePreset === 'string' && presets[item.sizePreset] ? item.sizePreset : null;
    if (!preset && finite(item.width) && finite(item.depth) && finite(item.height)) {
      preset = Object.keys(presets).find(key => {
        const size = presets[key];
        return Math.abs(Number(item.width) - size[0]) < 1e-6 && Math.abs(Number(item.depth) - size[1]) < 1e-6 && Math.abs(Number(item.height) - size[2]) < 1e-6;
      }) || null;
    }
    preset ||= 'catalog-default';
    const size = presets[preset] || [profile.width, profile.depth, profile.height];
    return { sizePreset: preset, width: size[0], depth: size[1], height: size[2] };
  }

  function uuid() {
    if (global.crypto?.randomUUID) return `added-${global.crypto.randomUUID()}`;
    const bytes = new Uint32Array(4);
    global.crypto?.getRandomValues?.(bytes);
    const entropy = Array.from(bytes, value => value.toString(16)).join('') || `${Date.now()}-${Math.random()}`;
    return `added-${entropy}`;
  }

  function emptyLayout() {
    return { overrides: {}, additions: [] };
  }

  function objectUuid() {
    if (global.crypto?.randomUUID) return `added-object-${global.crypto.randomUUID()}`;
    return `added-object-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function emptyObjectLayout() {
    return { overrides: {}, additions: [] };
  }

  function groundUuid() {
    if (global.crypto?.randomUUID) return `added-ground-${global.crypto.randomUUID()}`;
    return `added-ground-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function emptyGroundLayout() {
    return { overrides: {}, additions: [] };
  }

  function validGroundPoints(points, kind) {
    const utils = global.GROUND_GEOMETRY_UTILS;
    if (!utils || !Array.isArray(points)) return null;
    const clean = utils.removeAdjacentDuplicatePoints(points, 0.25);
    const minimum = kind === 'path' ? 2 : 3;
    if (clean.length < minimum || clean.length > 24 || clean.some(point => !safeCoordinate(point.x) || !safeCoordinate(point.z))) return null;
    if (kind === 'path') {
      if (utils.polylineLength(clean) < 0.5) return null;
    } else if (!utils.isSimplePolygon(clean) || utils.polygonArea(clean) < 0.5) return null;
    return clean;
  }

  function sanitizeGroundLayout(value, baseById = new Map()) {
    const layout = emptyGroundLayout();
    if (!value || typeof value !== 'object') return layout;
    const materials = global.GROUND_FEATURE_MATERIALS || {};
    if (value.overrides && typeof value.overrides === 'object') {
      Object.entries(value.overrides).forEach(([id, patch]) => {
        const original = baseById.get(id);
        if (!original || !patch || typeof patch !== 'object') return;
        const points = validGroundPoints(patch.points, original.kind);
        if (!points) return;
        const width = original.kind === 'path' ? Math.max(0.4, Math.min(4, finite(patch.width) ? Number(patch.width) : original.width)) : 0;
        const materialId = materials[patch.materialId]?.kind === original.kind ? patch.materialId : original.materialId;
        layout.overrides[id] = { points, width, materialId };
      });
    }
    const ids = new Set();
    (Array.isArray(value.additions) ? value.additions : []).forEach(source => {
      const profile = global.GROUND_FEATURE_CATALOG_BY_TYPE?.get(source?.featureType);
      if (!profile) return;
      const points = validGroundPoints(source.points, profile.kind);
      if (!points) return;
      let id = typeof source.id === 'string' && source.id.startsWith('added-ground-') ? source.id : groundUuid();
      if (ids.has(id)) id = groundUuid();
      ids.add(id);
      const materialId = materials[source.materialId]?.kind === profile.kind ? source.materialId : profile.materialId;
      layout.additions.push({
        id, kind: profile.kind, featureType: profile.featureType, points,
        width: profile.kind === 'path' ? Math.max(0.4, Math.min(4, finite(source.width) ? Number(source.width) : profile.defaultWidth)) : 0,
        materialId, layer: profile.defaultLayer
      });
    });
    return layout;
  }

  function sanitizeObjectLayout(value, baseIds) {
    const layout = emptyObjectLayout();
    if (!value || typeof value !== 'object') return layout;
    if (value.overrides && typeof value.overrides === 'object') {
      Object.entries(value.overrides).forEach(([id, item]) => {
        if (!baseIds.has(id) || !item || !safeCoordinate(item.x) || !safeCoordinate(item.z)) return;
        layout.overrides[id] = {
          x: Number(item.x), z: Number(item.z), rotation: normalizeRotation(item.rotation)
        };
      });
    }
    const ids = new Set();
    (Array.isArray(value.additions) ? value.additions : []).forEach(item => {
      const profile = global.OBJECT_CATALOG_BY_TYPE?.get(item?.type);
      if (!profile || !safeCoordinate(item.x) || !safeCoordinate(item.z)) return;
      let id = typeof item.id === 'string' && item.id.startsWith('added-object-') ? item.id : objectUuid();
      if (ids.has(id)) id = objectUuid();
      ids.add(id);
      const size = allowedSize(profile, item);
      layout.additions.push({
        id, type: profile.type, label: profile.label, x: Number(item.x), z: Number(item.z),
        rotation: normalizeRotation(item.rotation), layer: OBJECT_LAYERS.has(item.layer) ? item.layer : profile.defaultLayer,
        category: profile.category, ...size,
        clearance: profile.clearance, footprint: profile.footprint || 'box',
        bedKind: profile.type === 'raised-bed' ? (size.sizePreset === 'herb-bed' ? 'herb' : 'guest') : undefined,
        seed: profile.type === 'raised-bed' && finite(item.seed) ? Number(item.seed) : undefined,
        doorOffsetZ: profile.type === 'tool-shed' && finite(item.doorOffsetZ) ? Number(item.doorOffsetZ) : profile.doorOffsetZ
      });
    });
    return layout;
  }

  function sanitizeLayout(value) {
    const layout = emptyLayout();
    if (!value || typeof value !== 'object') return layout;
    if (value.overrides && typeof value.overrides === 'object') {
      Object.entries(value.overrides).forEach(([id, item]) => {
        if (!/^base-tree-\d+$/.test(id) || !item || !safeCoordinate(item.x) || !safeCoordinate(item.z)) return;
        layout.overrides[id] = {
          x: Number(item.x), z: Number(item.z), rotation: normalizeRotation(item.rotation)
        };
      });
    }
    const ids = new Set();
    (Array.isArray(value.additions) ? value.additions : []).forEach(item => {
      const profile = CATALOG_BY_NAME.get(item?.name);
      if (!profile || !safeCoordinate(item.x) || !safeCoordinate(item.z)) return;
      let id = typeof item.id === 'string' && item.id.startsWith('added-') ? item.id : uuid();
      if (ids.has(id)) id = uuid();
      ids.add(id);
      layout.additions.push({
        id, name: profile.name, x: Number(item.x), z: Number(item.z),
        r: finite(item.r) && Number(item.r) > 0 && Number(item.r) < 20 ? Number(item.r) : profile.r,
        h: finite(item.h) && Number(item.h) >= 0 && Number(item.h) < 50 ? Number(item.h) : profile.h,
        bush: typeof item.bush === 'boolean' ? item.bush : profile.bush,
        rotation: normalizeRotation(item.rotation)
      });
    });
    return layout;
  }

  function createDesignState({ baseTrees, baseObjects = [], baseGroundFeatures = [], defaults, storageKey = 'ryuka-v4-plans' }) {
    const base = baseTrees.map((tree, index) => Object.freeze({ ...tree, designId: `base-tree-${index}` }));
    const objectBase = baseObjects.map(object => Object.freeze({ ...object, designId: object.designId || object.id, baseRotation: normalizeRotation(object.baseRotation ?? object.rotation) }));
    const objectBaseIds = new Set(objectBase.map(object => object.designId));
    const groundBase = baseGroundFeatures.map(item => Object.freeze({ ...item, points: clone(item.points), basePoints: clone(item.points), baseWidth: item.width || 0, baseMaterialId: item.materialId }));
    const groundBaseById = new Map(groundBase.map(item => [item.designId, item]));
    const history = { A: { undo: [], redo: [] }, B: { undo: [], redo: [] } };
    const objectHistory = { A: { undo: [], redo: [] }, B: { undo: [], redo: [] } };
    const groundHistory = { A: { undo: [], redo: [] }, B: { undo: [], redo: [] } };
    let activePlan = 'A';

    function normalizePlan(source, fallback) {
      const value = source && typeof source === 'object' ? source : {};
      return {
        ...clone(fallback),
        season: ['spring', 'summer', 'autumn', 'winter'].includes(value.season) ? value.season : fallback.season,
        growthYear: finite(value.growthYear) ? Math.max(0, Math.min(10, Number(value.growthYear))) : fallback.growthYear,
        density: ['low', 'standard', 'lush'].includes(value.density) ? value.density : fallback.density,
        cropPattern: ['A', 'B'].includes(value.cropPattern) ? value.cropPattern : fallback.cropPattern,
        showFlowers: typeof value.showFlowers === 'boolean' ? value.showFlowers : fallback.showFlowers,
        showFruit: typeof value.showFruit === 'boolean' ? value.showFruit : fallback.showFruit,
        plantLayout: sanitizeLayout(value.plantLayout),
        objectLayout: sanitizeObjectLayout(value.objectLayout, objectBaseIds),
        groundLayout: sanitizeGroundLayout(value.groundLayout, groundBaseById)
      };
    }

    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (error) { console.warn('[Ryuka] 保存済みプランを初期化しました', error); }
    let plans = {
      A: normalizePlan(stored?.A, defaults.A),
      B: normalizePlan(stored?.B, defaults.B)
    };

    function persist() {
      localStorage.setItem(storageKey, JSON.stringify(plans));
    }
    function snapshot(key = activePlan) {
      return clone(plans[key].plantLayout);
    }
    function objectSnapshot(key = activePlan) {
      return clone(plans[key].objectLayout);
    }
    function groundSnapshot(key = activePlan) {
      return clone(plans[key].groundLayout);
    }
    function pushHistory(key = activePlan) {
      const stack = history[key];
      stack.undo.push(snapshot(key));
      if (stack.undo.length > 50) stack.undo.shift();
      stack.redo.length = 0;
    }
    function resolve(key = activePlan) {
      const layout = plans[key].plantLayout;
      const existing = base.map(tree => {
        const override = layout.overrides[tree.designId] || {};
        return {
          ...tree,
          x: finite(override.x) ? Number(override.x) : tree.x,
          z: finite(override.z) ? Number(override.z) : tree.z,
          rotation: finite(override.rotation) ? Number(override.rotation) : 0,
          sourceType: 'base', species: tree.name,
          basePosition: { x: tree.x, z: tree.z }, currentPosition: { x: finite(override.x) ? Number(override.x) : tree.x, z: finite(override.z) ? Number(override.z) : tree.z }
        };
      });
      const additions = layout.additions.map(item => ({
        ...item, designId: item.id, sourceType: 'added', species: item.name,
        basePosition: null, currentPosition: { x: item.x, z: item.z }
      }));
      return existing.concat(additions);
    }
    function resolveObjects(key = activePlan) {
      const layout = plans[key].objectLayout;
      const existing = objectBase.map(object => {
        const override = layout.overrides[object.designId] || {};
        const x = finite(override.x) ? Number(override.x) : object.x;
        const z = finite(override.z) ? Number(override.z) : object.z;
        return {
          ...object, x, z, rotation: override.rotation === undefined ? object.baseRotation : normalizeRotation(override.rotation),
          sourceType: 'base', baseRotation: object.baseRotation, basePosition: { x: object.x, z: object.z }, currentPosition: { x, z }
        };
      });
      return existing.concat(layout.additions.map(object => ({
        ...object, designId: object.id, sourceType: 'added', baseRotation: null,
        basePosition: null, currentPosition: { x: object.x, z: object.z }
      })));
    }
    function resolvedGroundItem(item) {
      const utils = global.GROUND_GEOMETRY_UTILS;
      const points = clone(item.points);
      const surface = item.kind === 'path' ? utils.buildPathRibbon(points, item.width) : points;
      return {
        ...item, points, basePoints: clone(item.basePoints || points),
        area: utils.polygonArea(surface), perimeter: utils.polygonPerimeter(surface),
        length: item.kind === 'path' ? utils.polylineLength(points) : 0,
        centroid: utils.centroid(surface.length ? surface : points)
      };
    }
    function resolveGroundFeatures(key = activePlan) {
      const layout = plans[key].groundLayout;
      const existing = groundBase.map(original => {
        const override = layout.overrides[original.designId] || {};
        return resolvedGroundItem({
          ...original, points: clone(override.points || original.points),
          width: override.width === undefined ? original.width : Number(override.width),
          materialId: override.materialId || original.materialId, sourceType: 'base'
        });
      });
      const additions = layout.additions.map(source => {
        const profile = global.GROUND_FEATURE_CATALOG_BY_TYPE.get(source.featureType);
        return resolvedGroundItem({
          ...profile, ...source, designId: source.id, label: profile.label, category: profile.category,
          sourceType: 'added', basePoints: [], baseWidth: 0, baseMaterialId: null, y: 0.046
        });
      });
      return existing.concat(additions);
    }
    function mutate(fn, key = activePlan) {
      pushHistory(key);
      fn(plans[key].plantLayout);
      persist();
    }
    function updatePlant(id, patch, key = activePlan) {
      const baseIndex = base.findIndex(tree => tree.designId === id);
      mutate(layout => {
        if (baseIndex >= 0) {
          const original = base[baseIndex];
          const next = { ...(layout.overrides[id] || {}), ...patch };
          if (Math.hypot(Number(next.x) - original.x, Number(next.z) - original.z) < 1e-6 && Math.abs(Number(next.rotation || 0)) < 1e-6) delete layout.overrides[id];
          else layout.overrides[id] = next;
        } else {
          const plant = layout.additions.find(item => item.id === id);
          if (plant) Object.assign(plant, patch);
        }
      }, key);
    }
    function pushObjectHistory(key = activePlan) {
      const stack = objectHistory[key];
      stack.undo.push(objectSnapshot(key));
      if (stack.undo.length > 50) stack.undo.shift();
      stack.redo.length = 0;
    }
    function mutateObject(fn, key = activePlan) {
      pushObjectHistory(key);
      fn(plans[key].objectLayout);
      persist();
    }
    function updateObject(id, patch, key = activePlan) {
      const original = objectBase.find(object => object.designId === id);
      const safePatch = { ...patch };
      if ('rotation' in safePatch) safePatch.rotation = normalizeRotation(safePatch.rotation);
      mutateObject(layout => {
        if (original) {
          const next = { ...(layout.overrides[id] || {}), ...safePatch };
          if (Math.hypot(Number(next.x) - original.x, Number(next.z) - original.z) < 1e-6 && Math.abs(normalizeRotation(next.rotation) - original.baseRotation) < 1e-6) delete layout.overrides[id];
          else layout.overrides[id] = next;
        } else {
          const object = layout.additions.find(item => item.id === id);
          if (object) Object.assign(object, safePatch);
        }
      }, key);
    }
    function addObject(type, position, key = activePlan, source = null) {
      const profile = global.OBJECT_CATALOG_BY_TYPE?.get(type);
      if (!profile) return null;
      const size = allowedSize(profile, source || {});
      const item = {
        id: objectUuid(), type, label: source?.label || profile.label, x: Number(position.x), z: Number(position.z),
        rotation: normalizeRotation(source?.rotation), layer: OBJECT_LAYERS.has(source?.layer) ? source.layer : profile.defaultLayer,
        category: profile.category, ...size,
        clearance: profile.clearance, footprint: profile.footprint || 'box',
        bedKind: type === 'raised-bed' ? (size.sizePreset === 'herb-bed' ? 'herb' : (source?.bedKind || 'guest')) : undefined,
        seed: type === 'raised-bed' ? (finite(source?.seed) ? Number(source.seed) : 500) : undefined,
        doorOffsetZ: type === 'tool-shed' ? (finite(source?.doorOffsetZ) ? Number(source.doorOffsetZ) : profile.doorOffsetZ) : undefined
      };
      mutateObject(layout => layout.additions.push(item), key);
      return item.id;
    }
    function removeObject(id, key = activePlan) {
      if (!id.startsWith('added-object-')) return false;
      let removed = false;
      mutateObject(layout => {
        const index = layout.additions.findIndex(item => item.id === id);
        if (index >= 0) { layout.additions.splice(index, 1); removed = true; }
      }, key);
      return removed;
    }
    function resetObject(id, key = activePlan) {
      if (!objectBaseIds.has(id)) return false;
      mutateObject(layout => delete layout.overrides[id], key);
      return true;
    }
    function resetObjectLayout(key = activePlan) {
      mutateObject(layout => { layout.overrides = {}; layout.additions = []; }, key);
    }
    function undoObject(key = activePlan) {
      const stack = objectHistory[key];
      if (!stack.undo.length) return false;
      stack.redo.push(objectSnapshot(key));
      plans[key].objectLayout = stack.undo.pop(); persist(); return true;
    }
    function redoObject(key = activePlan) {
      const stack = objectHistory[key];
      if (!stack.redo.length) return false;
      stack.undo.push(objectSnapshot(key));
      plans[key].objectLayout = stack.redo.pop(); persist(); return true;
    }
    function pushGroundHistory(key = activePlan) {
      const stack = groundHistory[key];
      stack.undo.push(groundSnapshot(key));
      if (stack.undo.length > 50) stack.undo.shift();
      stack.redo.length = 0;
    }
    function mutateGround(fn, key = activePlan) {
      pushGroundHistory(key);
      fn(plans[key].groundLayout);
      persist();
    }
    function updateGroundFeature(id, patch, key = activePlan) {
      const original = groundBaseById.get(id);
      mutateGround(layout => {
        if (original) {
          const current = layout.overrides[id] || { points: clone(original.points), width: original.width, materialId: original.materialId };
          const next = { ...current, ...clone(patch) };
          const unchanged = JSON.stringify(next.points) === JSON.stringify(original.points) && Math.abs(Number(next.width || 0) - Number(original.width || 0)) < 1e-6 && next.materialId === original.materialId;
          if (unchanged) delete layout.overrides[id]; else layout.overrides[id] = next;
        } else {
          const addition = layout.additions.find(item => item.id === id);
          if (addition) Object.assign(addition, clone(patch));
        }
      }, key);
    }
    function addGroundFeature(featureType, values, key = activePlan) {
      const profile = global.GROUND_FEATURE_CATALOG_BY_TYPE?.get(featureType);
      if (!profile) return null;
      const item = {
        id: groundUuid(), kind: profile.kind, featureType, points: clone(values.points),
        width: profile.kind === 'path' ? Number(values.width ?? profile.defaultWidth) : 0,
        materialId: values.materialId || profile.materialId, layer: profile.defaultLayer
      };
      const sanitized = sanitizeGroundLayout({ additions: [item] }, groundBaseById).additions[0];
      if (!sanitized) return null;
      mutateGround(layout => layout.additions.push(sanitized), key);
      return sanitized.id;
    }
    function removeGroundFeature(id, key = activePlan) {
      if (!id.startsWith('added-ground-')) return false;
      let removed = false;
      mutateGround(layout => {
        const index = layout.additions.findIndex(item => item.id === id);
        if (index >= 0) { layout.additions.splice(index, 1); removed = true; }
      }, key);
      return removed;
    }
    function resetGroundFeature(id, key = activePlan) {
      if (!groundBaseById.has(id)) return false;
      mutateGround(layout => delete layout.overrides[id], key);
      return true;
    }
    function resetGroundLayout(key = activePlan) {
      mutateGround(layout => { layout.overrides = {}; layout.additions = []; }, key);
    }
    function undoGround(key = activePlan) {
      const stack = groundHistory[key];
      if (!stack.undo.length) return false;
      stack.redo.push(groundSnapshot(key)); plans[key].groundLayout = stack.undo.pop(); persist(); return true;
    }
    function redoGround(key = activePlan) {
      const stack = groundHistory[key];
      if (!stack.redo.length) return false;
      stack.undo.push(groundSnapshot(key)); plans[key].groundLayout = stack.redo.pop(); persist(); return true;
    }
    function add(species, position, key = activePlan, source = null) {
      const profile = CATALOG_BY_NAME.get(species);
      if (!profile) return null;
      const item = {
        id: uuid(), name: profile.name, x: Number(position.x), z: Number(position.z),
        r: source?.r || profile.r, h: source?.h ?? profile.h,
        bush: source?.bush ?? profile.bush, rotation: source?.rotation || 0
      };
      mutate(layout => layout.additions.push(item), key);
      return item.id;
    }
    function remove(id, key = activePlan) {
      if (!id.startsWith('added-')) return false;
      let removed = false;
      mutate(layout => {
        const index = layout.additions.findIndex(item => item.id === id);
        if (index >= 0) { layout.additions.splice(index, 1); removed = true; }
      }, key);
      return removed;
    }
    function resetPlant(id, key = activePlan) {
      if (!id.startsWith('base-tree-')) return false;
      mutate(layout => delete layout.overrides[id], key);
      return true;
    }
    function resetLayout(key = activePlan) {
      mutate(layout => { layout.overrides = {}; layout.additions = []; }, key);
    }
    function undo(key = activePlan) {
      const stack = history[key];
      if (!stack.undo.length) return false;
      stack.redo.push(snapshot(key));
      plans[key].plantLayout = stack.undo.pop(); persist(); return true;
    }
    function redo(key = activePlan) {
      const stack = history[key];
      if (!stack.redo.length) return false;
      stack.undo.push(snapshot(key));
      plans[key].plantLayout = stack.redo.pop(); persist(); return true;
    }
    function updatePlanSettings(key, values) {
      plans[key] = normalizePlan({ ...plans[key], ...values, plantLayout: plans[key].plantLayout, objectLayout: plans[key].objectLayout, groundLayout: plans[key].groundLayout }, defaults[key]);
      persist();
    }
    function replacePlans(value) {
      const source = value && typeof value === 'object' ? value : {};
      plans = { A: normalizePlan(source.A, defaults.A), B: normalizePlan(source.B, defaults.B) };
      history.A = { undo: [], redo: [] }; history.B = { undo: [], redo: [] };
      objectHistory.A = { undo: [], redo: [] }; objectHistory.B = { undo: [], redo: [] };
      groundHistory.A = { undo: [], redo: [] }; groundHistory.B = { undo: [], redo: [] };
      persist();
    }
    function cleanInvalid(validate) {
      let removed = 0;
      ['A', 'B'].forEach(key => {
        const layout = plans[key].plantLayout;
        Object.keys(layout.overrides).forEach(id => {
          const index = Number(id.slice('base-tree-'.length));
          const original = base[index], override = layout.overrides[id];
          if (!original || !validate({ ...original, ...override, sourceType: 'base', basePosition: { x: original?.x, z: original?.z } }, override.x, override.z, key)) { delete layout.overrides[id]; removed += 1; }
        });
        layout.additions = layout.additions.filter(item => {
          const valid = validate({ ...item, designId: item.id, sourceType: 'added', basePosition: null }, item.x, item.z, key);
          if (!valid) removed += 1;
          return valid;
        });
      });
      persist();
      return removed;
    }
    function cleanInvalidObjects(validate) {
      let removed = 0;
      const contexts = {
        A: { objects: resolveObjects('A'), plants: resolve('A') },
        B: { objects: resolveObjects('B'), plants: resolve('B') }
      };
      ['A', 'B'].forEach(key => {
        const layout = plans[key].objectLayout;
        Object.keys(layout.overrides).forEach(id => {
          const original = objectBase.find(object => object.designId === id), override = layout.overrides[id];
          if (!original || !validate({ ...original, ...override, sourceType: 'base', basePosition: { x: original?.x, z: original?.z }, baseRotation: original?.baseRotation }, override.x, override.z, normalizeRotation(override.rotation), key, contexts[key])) { delete layout.overrides[id]; removed += 1; }
        });
        layout.additions = layout.additions.filter(item => {
          const valid = validate({ ...item, designId: item.id, sourceType: 'added', basePosition: null, baseRotation: null }, item.x, item.z, normalizeRotation(item.rotation), key, contexts[key]);
          if (!valid) removed += 1;
          return valid;
        });
      });
      persist();
      return removed;
    }
    function cleanInvalidGroundFeatures(validate) {
      let removed = 0;
      ['A', 'B'].forEach(key => {
        const layout = plans[key].groundLayout;
        Object.keys(layout.overrides).forEach(id => {
          const item = resolveGroundFeatures(key).find(feature => feature.designId === id);
          if (!item || !validate(item, key, resolveGroundFeatures(key))) { delete layout.overrides[id]; removed += 1; }
        });
        layout.additions = layout.additions.filter(source => {
          const item = resolveGroundFeatures(key).find(feature => feature.designId === source.id);
          const valid = !!item && validate(item, key, resolveGroundFeatures(key));
          if (!valid) removed += 1;
          return valid;
        });
      });
      persist();
      return removed;
    }

    persist();
    return {
      get plans() { return plans; }, get activePlan() { return activePlan; },
      setActivePlan(key) { activePlan = key === 'B' ? 'B' : 'A'; },
      resolve, updatePlant, add, remove, resetPlant, resetLayout, undo, redo,
      resolveObjects, updateObject, addObject, removeObject, resetObject, resetObjectLayout, undoObject, redoObject,
      resolveGroundFeatures, updateGroundFeature, addGroundFeature, removeGroundFeature, resetGroundFeature, resetGroundLayout, undoGround, redoGround,
      canUndo: key => history[key || activePlan].undo.length > 0,
      canRedo: key => history[key || activePlan].redo.length > 0,
      canUndoObject: key => objectHistory[key || activePlan].undo.length > 0,
      canRedoObject: key => objectHistory[key || activePlan].redo.length > 0,
      canUndoGround: key => groundHistory[key || activePlan].undo.length > 0,
      canRedoGround: key => groundHistory[key || activePlan].redo.length > 0,
      updatePlanSettings, replacePlans, cleanInvalid, cleanInvalidObjects, cleanInvalidGroundFeatures, persist, sanitizeLayout,
      sanitizeObjectLayout: value => sanitizeObjectLayout(value, objectBaseIds),
      sanitizeGroundLayout: value => sanitizeGroundLayout(value, groundBaseById)
    };
  }

  global.PLANT_CATALOG = CATALOG;
  global.normalizeDesignRotation = normalizeRotation;
  global.sanitizeGroundLayout = sanitizeGroundLayout;
  global.createDesignState = createDesignState;
})(window);
