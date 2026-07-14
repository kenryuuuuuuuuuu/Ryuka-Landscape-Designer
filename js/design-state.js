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

  function createDesignState({ baseTrees, baseObjects = [], defaults, storageKey = 'ryuka-v4-plans' }) {
    const base = baseTrees.map((tree, index) => Object.freeze({ ...tree, designId: `base-tree-${index}` }));
    const objectBase = baseObjects.map(object => Object.freeze({ ...object, designId: object.designId || object.id, baseRotation: normalizeRotation(object.baseRotation ?? object.rotation) }));
    const objectBaseIds = new Set(objectBase.map(object => object.designId));
    const history = { A: { undo: [], redo: [] }, B: { undo: [], redo: [] } };
    const objectHistory = { A: { undo: [], redo: [] }, B: { undo: [], redo: [] } };
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
        objectLayout: sanitizeObjectLayout(value.objectLayout, objectBaseIds)
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
      plans[key] = normalizePlan({ ...plans[key], ...values, plantLayout: plans[key].plantLayout, objectLayout: plans[key].objectLayout }, defaults[key]);
      persist();
    }
    function replacePlans(value) {
      const source = value && typeof value === 'object' ? value : {};
      plans = { A: normalizePlan(source.A, defaults.A), B: normalizePlan(source.B, defaults.B) };
      history.A = { undo: [], redo: [] }; history.B = { undo: [], redo: [] };
      objectHistory.A = { undo: [], redo: [] }; objectHistory.B = { undo: [], redo: [] };
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

    persist();
    return {
      get plans() { return plans; }, get activePlan() { return activePlan; },
      setActivePlan(key) { activePlan = key === 'B' ? 'B' : 'A'; },
      resolve, updatePlant, add, remove, resetPlant, resetLayout, undo, redo,
      resolveObjects, updateObject, addObject, removeObject, resetObject, resetObjectLayout, undoObject, redoObject,
      canUndo: key => history[key || activePlan].undo.length > 0,
      canRedo: key => history[key || activePlan].redo.length > 0,
      canUndoObject: key => objectHistory[key || activePlan].undo.length > 0,
      canRedoObject: key => objectHistory[key || activePlan].redo.length > 0,
      updatePlanSettings, replacePlans, cleanInvalid, cleanInvalidObjects, persist, sanitizeLayout,
      sanitizeObjectLayout: value => sanitizeObjectLayout(value, objectBaseIds)
    };
  }

  global.PLANT_CATALOG = CATALOG;
  global.normalizeDesignRotation = normalizeRotation;
  global.createDesignState = createDesignState;
})(window);
