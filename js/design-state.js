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

  function sanitizeLayout(value) {
    const layout = emptyLayout();
    if (!value || typeof value !== 'object') return layout;
    if (value.overrides && typeof value.overrides === 'object') {
      Object.entries(value.overrides).forEach(([id, item]) => {
        if (!/^base-tree-\d+$/.test(id) || !item || !safeCoordinate(item.x) || !safeCoordinate(item.z)) return;
        layout.overrides[id] = {
          x: Number(item.x), z: Number(item.z), rotation: finite(item.rotation) ? Number(item.rotation) : 0
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
        rotation: finite(item.rotation) ? Number(item.rotation) : 0
      });
    });
    return layout;
  }

  function createDesignState({ baseTrees, defaults, storageKey = 'ryuka-v4-plans' }) {
    const base = baseTrees.map((tree, index) => Object.freeze({ ...tree, designId: `base-tree-${index}` }));
    const history = { A: { undo: [], redo: [] }, B: { undo: [], redo: [] } };
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
        plantLayout: sanitizeLayout(value.plantLayout)
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
      plans[key] = normalizePlan({ ...plans[key], ...values, plantLayout: plans[key].plantLayout }, defaults[key]);
      persist();
    }
    function replacePlans(value) {
      const source = value && typeof value === 'object' ? value : {};
      plans = { A: normalizePlan(source.A, defaults.A), B: normalizePlan(source.B, defaults.B) };
      history.A = { undo: [], redo: [] }; history.B = { undo: [], redo: [] };
      persist();
    }
    function cleanInvalid(validate) {
      let removed = 0;
      ['A', 'B'].forEach(key => {
        const layout = plans[key].plantLayout;
        Object.keys(layout.overrides).forEach(id => {
          const index = Number(id.slice('base-tree-'.length));
          const original = base[index], override = layout.overrides[id];
          if (!original || !validate({ ...original, ...override, sourceType: 'base', basePosition: { x: original?.x, z: original?.z } }, override.x, override.z)) { delete layout.overrides[id]; removed += 1; }
        });
        layout.additions = layout.additions.filter(item => {
          const valid = validate({ ...item, designId: item.id, sourceType: 'added', basePosition: null }, item.x, item.z);
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
      canUndo: key => history[key || activePlan].undo.length > 0,
      canRedo: key => history[key || activePlan].redo.length > 0,
      updatePlanSettings, replacePlans, cleanInvalid, persist, sanitizeLayout
    };
  }

  global.PLANT_CATALOG = CATALOG;
  global.createDesignState = createDesignState;
})(window);
