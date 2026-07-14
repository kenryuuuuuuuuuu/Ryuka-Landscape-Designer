(function exposeObjectEditor(global) {
  'use strict';

  const COLORS = { valid: 0x5ad5a0, warning: 0xf2c94c, invalid: 0xe2534a };

  function pointInPolygon(x, z, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  }
  function corners(item, x = item.x, z = item.z, rotation = item.rotation || 0, padding = 0) {
    const hx = item.width / 2 + padding, hz = item.depth / 2 + padding;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([px, pz]) => ({ x: x + px * c + pz * s, z: z - px * s + pz * c }));
  }
  function project(poly, axis) {
    const values = poly.map(point => point.x * axis.x + point.z * axis.z);
    return [Math.min(...values), Math.max(...values)];
  }
  function polygonsOverlap(a, b) {
    const axes = [];
    [a, b].forEach(poly => poly.forEach((point, index) => {
      const next = poly[(index + 1) % poly.length], dx = next.x - point.x, dz = next.z - point.z;
      const length = Math.hypot(dx, dz) || 1;
      axes.push({ x: -dz / length, z: dx / length });
    }));
    return axes.every(axis => {
      const pa = project(a, axis), pb = project(b, axis);
      return pa[1] > pb[0] && pb[1] > pa[0];
    });
  }
  function circleBoxOverlap(circle, boxItem, boxX, boxZ, boxRotation, padding = 0) {
    const c = Math.cos(-boxRotation), s = Math.sin(-boxRotation);
    const dx = circle.x - boxX, dz = circle.z - boxZ;
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    const hx = boxItem.width / 2 + padding, hz = boxItem.depth / 2 + padding;
    const qx = Math.max(-hx, Math.min(hx, lx)), qz = Math.max(-hz, Math.min(hz, lz));
    return Math.hypot(lx - qx, lz - qz) < circle.radius;
  }

  function createObjectEditor(options) {
    const { THREE, scene, renderer, data, designState, getCamera, getObjects, getPlants, rebuild, toast, showInfo, beforeBegin } = options;
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    let editing = false, selectedId = null, drag = null, snap = 0.25;

    const overlay = new THREE.Group();
    overlay.name = 'object-editor-overlay';
    const boxGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const boxMaterial = new THREE.LineBasicMaterial({ color: COLORS.valid, transparent: true, opacity: 0.95, depthTest: false });
    const outline = new THREE.LineSegments(boxGeometry, boxMaterial); overlay.add(outline);
    const arrowGeometry = new THREE.ConeGeometry(0.16, 0.45, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: COLORS.valid, depthTest: false });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial); arrow.rotation.x = Math.PI / 2; overlay.add(arrow);
    overlay.visible = false; scene.add(overlay);

    function objectById(id) { return designState.resolveObjects().find(item => item.designId === id) || null; }
    function snapValue(value, amount = snap) { return amount ? Math.round(value / amount) * amount : value; }
    function setColor(state) { const color = COLORS[state] || COLORS.valid; boxMaterial.color.setHex(color); arrowMaterial.color.setHex(color); }
    function setPreviewPosition(entry, item, x, z, rotation = item.rotation || 0) {
      if (entry?.group) { entry.group.position.set(x, 0, z); entry.group.rotation.y = rotation; }
      if (entry?.label) { entry.label.position.x = x; entry.label.position.z = z; }
      overlay.position.set(x, 0, z); overlay.rotation.y = rotation;
    }
    function validation(item, x, z, rotation = item.rotation || 0) {
      if (item.sourceType === 'base' && item.basePosition && Math.hypot(x - item.basePosition.x, z - item.basePosition.z) < 1e-6 && Math.abs(rotation - (item.rotation || 0)) < 1e-6) return { state: 'valid', message: '' };
      const footprint = corners(item, x, z, rotation, 0.05);
      if (!pointInPolygon(x, z, data.site) || footprint.some(point => !pointInPolygon(point.x, point.z, data.site))) return { state: 'invalid', message: '敷地外には配置できません' };
      const building = { width: data.building.w, depth: data.building.d };
      if (polygonsOverlap(corners(item, x, z, rotation, item.clearance || 0.2), corners(building, data.building.cx, data.building.cz, 0, 0.4))) return { state: 'invalid', message: '建物との安全距離を確保してください' };
      for (const other of designState.resolveObjects()) {
        if (other.designId === item.designId) continue;
        const padding = Math.max(item.clearance || 0.2, other.clearance || 0.2) * 0.5;
        let overlap;
        if (item.footprint === 'circle') overlap = circleBoxOverlap({ x, z, radius: item.width / 2 + padding }, other, other.x, other.z, other.rotation || 0, padding);
        else if (other.footprint === 'circle') overlap = circleBoxOverlap({ x: other.x, z: other.z, radius: other.width / 2 + padding }, item, x, z, rotation, padding);
        else overlap = polygonsOverlap(corners(item, x, z, rotation, padding), corners(other, other.x, other.z, other.rotation || 0, padding));
        if (overlap) return { state: 'invalid', message: `${other.label}と重なっています` };
      }
      let warning = '';
      if (data.paths.some(path => pointInPolygon(x, z, path) || footprint.some(point => pointInPolygon(point.x, point.z, path)))) warning = '園路と重なっています';
      if (!warning) for (const plant of getPlants()) {
        if (circleBoxOverlap({ x: plant.x, z: plant.z, radius: Math.max(0.35, plant.r * 0.72) }, item, x, z, rotation)) { warning = '樹冠と重なる可能性があります'; break; }
      }
      return { state: warning ? 'warning' : 'valid', message: warning };
    }
    function updateInfo(status = null) {
      const item = objectById(selectedId), entry = getObjects().get(selectedId), box = document.getElementById('objectSelectedInfo');
      if (!item || !entry) { if (box) box.innerHTML = '<span>設備・家具を選択してください</span>'; return; }
      const current = entry.group.position;
      const moved = item.basePosition ? Math.hypot(current.x - item.basePosition.x, current.z - item.basePosition.z) : 0;
      if (box) box.innerHTML = `<strong>${item.label}</strong><span>${item.sourceType === 'base' ? '既存設備' : '追加設備'}・${item.width.toFixed(2)} × ${item.depth.toFixed(2)}m</span><span>x ${current.x.toFixed(2)} / z ${current.z.toFixed(2)}・回転 ${Math.round(entry.group.rotation.y * 180 / Math.PI)}°</span><span>元位置から ${moved.toFixed(2)}m</span>${status?.message ? `<em>${status.message}</em>` : ''}`;
      showInfo?.(item, current, entry.group.rotation.y, status);
    }
    function syncOverlay() {
      const item = objectById(selectedId), entry = getObjects().get(selectedId);
      if (!editing || !item || !entry) { overlay.visible = false; return; }
      overlay.visible = true;
      overlay.position.copy(entry.group.position); overlay.rotation.y = entry.group.rotation.y;
      outline.scale.set(item.width + 0.12, Math.max(0.35, item.height) + 0.12, item.depth + 0.12); outline.position.y = Math.max(0.35, item.height) / 2;
      arrow.position.set(0, Math.max(0.5, item.height) + 0.3, -item.depth / 2 - 0.25);
      const status = validation(item, entry.group.position.x, entry.group.position.z, entry.group.rotation.y); setColor(status.state); updateInfo(status);
    }
    function select(id) { if (!editing || !getObjects().has(id)) return false; selectedId = id; document.body.classList.add('object-selected'); syncOverlay(); return true; }
    function deselect() { selectedId = null; drag = null; overlay.visible = false; document.body.classList.remove('object-selected'); updateInfo(); }
    function begin() {
      if (editing) return true;
      if (beforeBegin?.() === false) return false;
      editing = true; document.body.classList.add('object-editing'); document.getElementById('objectEditToggle')?.classList.add('on');
      options.onBegin?.();
      const button = document.getElementById('objectEditToggle'); if (button) button.textContent = '外構編集を終了';
      toast('外構設備・家具の編集を開始しました'); return true;
    }
    function end() {
      if (!editing) return;
      editing = false; deselect(); document.body.classList.remove('object-editing'); document.getElementById('objectEditToggle')?.classList.remove('on');
      options.onEnd?.();
      const button = document.getElementById('objectEditToggle'); if (button) button.textContent = '外構編集を開始';
      toast('外構編集を終了しました');
    }
    function refresh(id = selectedId) { rebuild(); if (id && getObjects().has(id)) select(id); else deselect(); updateButtons(); }
    function commit(id, x, z, rotation, message = '配置を更新しました') {
      const item = objectById(id), status = validation(item, x, z, rotation);
      if (status.state === 'invalid') { toast(status.message); syncOverlay(); return false; }
      designState.updateObject(id, { x, z, rotation }); refresh(id); toast(status.message || message); return true;
    }
    function move(dx, dz, amount = 0.25) { const item = objectById(selectedId); if (item) commit(selectedId, snapValue(item.x + dx * amount, 0.25), snapValue(item.z + dz * amount, 0.25), item.rotation || 0); }
    function rotate(delta) { const item = objectById(selectedId); if (item) commit(selectedId, item.x, item.z, (item.rotation || 0) + delta, '設備を回転しました'); }
    function remove() { const item = objectById(selectedId); if (!item) return; if (item.sourceType !== 'added') { toast('既存設備は削除できません'); return; } designState.removeObject(selectedId); refresh(null); toast('追加設備を削除しました'); }
    function resetSelected() { const item = objectById(selectedId); if (!item) return; if (item.sourceType !== 'base') { toast('追加設備には元位置がありません'); return; } designState.resetObject(selectedId); refresh(selectedId); toast('元位置へ戻しました'); }
    function findNearby(candidate, x, z, origin = null) {
      const first = { x: snapValue(x), z: snapValue(z) };
      const tests = [first];
      for (let radius = 0.5; radius <= 6; radius += 0.5) for (let index = 0; index < 16; index += 1) tests.push({ x: snapValue(x + Math.cos(index / 16 * Math.PI * 2) * radius), z: snapValue(z + Math.sin(index / 16 * Math.PI * 2) * radius) });
      return tests.find(point => (!origin || Math.hypot(point.x - origin.x, point.z - origin.z) >= 0.5) && validation(candidate, point.x, point.z, candidate.rotation || 0).state !== 'invalid') || null;
    }
    function duplicate() {
      const item = objectById(selectedId); if (!item) return;
      const candidate = { ...item, designId: `candidate-${Date.now()}`, sourceType: 'added', basePosition: null };
      const target = findNearby(candidate, item.x + 1, item.z, item);
      if (!target) { toast('複製できる場所が見つかりません'); return; }
      const id = designState.addObject(item.type, target, undefined, item); refresh(id); toast('設備を複製しました');
    }
    function addType(type) {
      const profile = global.OBJECT_CATALOG_BY_TYPE.get(type); if (!profile) return;
      if (!editing && !begin()) return;
      const center = options.getViewCenter?.() || { x: 0, z: 8 };
      const candidate = { ...profile, designId: `candidate-${Date.now()}`, sourceType: 'added', basePosition: null, rotation: 0, x: center.x, z: center.z };
      const target = findNearby(candidate, center.x, center.z);
      if (!target) { toast('追加できる場所が見つかりません'); return; }
      const id = designState.addObject(type, target); refresh(id); toast(`${profile.label}を追加しました`);
    }
    function history(redo = false) { if ((redo ? designState.redoObject() : designState.undoObject())) { refresh(selectedId); toast(redo ? 'やり直しました' : '元に戻しました'); } }
    function resetPlan() { if (!global.confirm('現在プランの外構設備・家具配置を初期化しますか？')) return; designState.resetObjectLayout(); refresh(null); toast('外構配置を初期化しました'); }
    function updateButtons() { document.getElementById('objectUndoBtn')?.toggleAttribute('disabled', !designState.canUndoObject()); document.getElementById('objectRedoBtn')?.toggleAttribute('disabled', !designState.canRedoObject()); }
    function ray(event) { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, getCamera()); }
    function idFrom(object) { let current = object; while (current && !current.userData?.designId) current = current.parent; return current?.userData?.designId || null; }
    function onPointerDown(event) {
      if (!editing || event.button !== 0) return;
      ray(event); const picked = raycaster.intersectObjects(Array.from(getObjects().values(), entry => entry.group), true)[0]; const id = picked ? idFrom(picked.object) : null;
      if (!id) { deselect(); return; }
      select(id); ray(event); if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const entry = getObjects().get(id), item = objectById(id);
      drag = { id, pointerId: event.pointerId, start: { x: entry.group.position.x, z: entry.group.position.z, rotation: item.rotation || 0 }, offset: { x: entry.group.position.x - hit.x, z: entry.group.position.z - hit.z }, lastValid: { x: entry.group.position.x, z: entry.group.position.z } };
      renderer.domElement.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopPropagation();
    }
    function onPointerMove(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      ray(event); if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const entry = getObjects().get(drag.id), item = objectById(drag.id); if (!entry || !item) return;
      const x = snapValue(hit.x + drag.offset.x), z = snapValue(hit.z + drag.offset.z), status = validation(item, x, z, item.rotation || 0);
      setPreviewPosition(entry, item, x, z, item.rotation || 0); if (status.state !== 'invalid') drag.lastValid = { x, z }; setColor(status.state); updateInfo(status); event.preventDefault(); event.stopPropagation();
    }
    function finishDrag(cancelled) {
      if (!drag) return;
      const active = drag, entry = getObjects().get(active.id), item = objectById(active.id), target = cancelled ? active.start : active.lastValid;
      setPreviewPosition(entry, item, target.x, target.z, active.start.rotation);
      try { if (renderer.domElement.hasPointerCapture?.(active.pointerId)) renderer.domElement.releasePointerCapture(active.pointerId); } catch (_) {}
      const changed = !cancelled && Math.hypot(target.x - active.start.x, target.z - active.start.z) > 1e-6; drag = null;
      if (changed) commit(active.id, target.x, target.z, active.start.rotation); else syncOverlay();
    }
    function formFocused() { const element = document.activeElement; return ['INPUT', 'SELECT', 'TEXTAREA'].includes(element?.tagName) || element?.isContentEditable; }
    function onKeyDown(event) {
      if (!editing || formFocused()) return;
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { history(event.shiftKey); event.preventDefault(); return; }
      if (event.code === 'Escape') { if (drag) finishDrag(true); else deselect(); event.preventDefault(); return; }
      if (!selectedId) return;
      const amount = event.shiftKey ? 1 : 0.25, moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[event.code]) { move(moves[event.code][0], moves[event.code][1], amount); event.preventDefault(); }
      if (event.code === 'KeyR') { rotate((event.shiftKey ? -15 : 15) * Math.PI / 180); event.preventDefault(); }
      if (event.code === 'Delete' || event.code === 'Backspace') { remove(); event.preventDefault(); }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { capture: true });
    renderer.domElement.addEventListener('pointerup', event => { if (drag && event.pointerId === drag.pointerId) finishDrag(false); }, { capture: true });
    renderer.domElement.addEventListener('pointercancel', event => { if (drag && event.pointerId === drag.pointerId) finishDrag(true); }, { capture: true });
    renderer.domElement.addEventListener('mousedown', event => { if (editing) event.stopImmediatePropagation(); }, { capture: true });
    renderer.domElement.addEventListener('touchstart', event => { if (editing) event.stopImmediatePropagation(); }, { capture: true });
    renderer.domElement.addEventListener('touchmove', event => { if (editing) event.stopImmediatePropagation(); }, { capture: true });
    global.addEventListener('keydown', onKeyDown, { capture: true });

    return {
      isEditing: () => editing, get selectedId() { return selectedId; }, begin, end, select, deselect, move, rotate, remove, duplicate, resetSelected, addType,
      undo: () => history(false), redo: () => history(true), resetPlan, setSnap(value) { snap = Number(value) || 0; },
      isValid: (item, x, z, rotation) => validation(item, x, z, rotation).state !== 'invalid',
      beforeRebuild() { overlay.visible = false; }, afterRebuild() { if (selectedId && getObjects().has(selectedId)) syncOverlay(); else deselect(); updateButtons(); }, refresh: syncOverlay
    };
  }

  global.createObjectEditor = createObjectEditor;
})(window);
