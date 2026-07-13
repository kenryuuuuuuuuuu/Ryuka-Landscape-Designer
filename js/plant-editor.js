(function exposePlantEditor(global) {
  'use strict';

  const COLORS = { valid: 0x66d59a, warning: 0xf2c94c, invalid: 0xe2534a };

  function pointInPolygon(x, z, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if (((a.z > z) !== (b.z > z)) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  }

  function createPlantEditor(options) {
    const { THREE, scene, renderer, data, designState, getCamera, getObjects, rebuild, toast, showInfo } = options;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let editing = false, selectedId = null, drag = null, snap = 0.25;

    const overlay = new THREE.Group();
    overlay.name = 'plant-editor-overlay';
    const ringGeometry = new THREE.RingGeometry(0.96, 1, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: COLORS.valid, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.18; overlay.add(ring);
    const markerGeometry = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: COLORS.valid, transparent: true, opacity: 0.72, depthTest: false });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial); marker.position.y = 0.5; overlay.add(marker);
    const origin = new THREE.Group();
    const originMaterial = new THREE.LineDashedMaterial({ color: 0xdde9d7, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.55, depthTest: false });
    const points = [];
    for (let i = 0; i <= 48; i += 1) { const a = i / 48 * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a), 0.12, Math.sin(a))); }
    const originRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), originMaterial); originRing.computeLineDistances(); origin.add(originRing);
    const crossPoints = [new THREE.Vector3(-0.35, 0.13, 0), new THREE.Vector3(0.35, 0.13, 0), new THREE.Vector3(0, 0.13, -0.35), new THREE.Vector3(0, 0.13, 0.35)];
    const cross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crossPoints), originMaterial); cross.computeLineDistances(); origin.add(cross); scene.add(origin);
    overlay.visible = origin.visible = false; scene.add(overlay);

    function plantById(id) { return designState.resolve().find(plant => plant.designId === id) || null; }
    function setColor(state) {
      const color = COLORS[state] || COLORS.valid;
      ringMaterial.color.setHex(color); markerMaterial.color.setHex(color);
    }
    function snapValue(value, amount = snap) { return amount ? Math.round(value / amount) * amount : value; }
    function validation(plant, x, z) {
      if (plant.sourceType === 'base' && plant.basePosition && Math.hypot(x - plant.basePosition.x, z - plant.basePosition.z) < 1e-6) return { state: 'valid', message: '' };
      if (!pointInPolygon(x, z, data.site)) return { state: 'invalid', message: '敷地外には配置できません' };
      const b = data.building, margin = plant.r + 0.4;
      if (x > b.cx - b.w / 2 - margin && x < b.cx + b.w / 2 + margin && z > b.cz - b.d / 2 - margin && z < b.cz + b.d / 2 + margin) {
        return { state: 'invalid', message: '建物から安全距離を確保してください' };
      }
      let warning = '';
      for (const other of designState.resolve()) {
        if (other.designId === plant.designId) continue;
        const distance = Math.hypot(x - other.x, z - other.z);
        if (distance < (plant.r + other.r) * 0.72) { warning = '樹冠が大きく重なっています'; break; }
      }
      if (!warning && data.paths.some(path => pointInPolygon(x, z, path))) warning = '園路と重なっています';
      return { state: warning ? 'warning' : 'valid', message: warning };
    }
    function syncOverlay() {
      const plant = plantById(selectedId), entry = getObjects().get(selectedId);
      if (!editing || !plant || !entry) { overlay.visible = origin.visible = false; return; }
      const x = entry.group.position.x, z = entry.group.position.z;
      overlay.visible = true; overlay.position.set(x, 0, z); ring.scale.setScalar(Math.max(0.35, plant.r)); marker.scale.y = Math.max(1, plant.h + plant.r); marker.position.y = marker.scale.y / 2;
      origin.visible = plant.sourceType === 'base' && Math.hypot(x - plant.basePosition.x, z - plant.basePosition.z) > 0.01;
      if (origin.visible) { origin.position.set(plant.basePosition.x, 0, plant.basePosition.z); origin.scale.setScalar(Math.max(0.45, plant.r)); }
      const status = validation(plant, x, z); setColor(status.state); updateInfo(status);
    }
    function updateInfo(status = null) {
      const plant = plantById(selectedId), entry = getObjects().get(selectedId);
      const box = document.getElementById('plantSelectedInfo');
      if (!box) return;
      if (!plant || !entry) { box.innerHTML = '<span>植物を選択してください</span>'; return; }
      const current = entry.group.position;
      const moved = plant.basePosition ? Math.hypot(current.x - plant.basePosition.x, current.z - plant.basePosition.z) : 0;
      box.innerHTML = `<strong>${plant.name}</strong><span>${plant.sourceType === 'base' ? '既存植栽' : '追加植栽'}・${isEvergreenSpecies(plant.name) ? '常緑' : '落葉'}</span><span>x ${current.x.toFixed(2)} / z ${current.z.toFixed(2)}　移動 ${moved.toFixed(2)}m</span>${status?.message ? `<em>${status.message}</em>` : ''}`;
      showInfo?.(plant, current);
    }
    function select(id) {
      if (!editing || !getObjects().has(id)) return false;
      selectedId = id; syncOverlay(); document.body.classList.add('plant-selected'); return true;
    }
    function deselect() { selectedId = null; drag = null; overlay.visible = origin.visible = false; document.body.classList.remove('plant-selected'); updateInfo(); }
    function begin() {
      editing = true; document.body.classList.add('plant-editing'); document.getElementById('plantEditToggle')?.classList.add('on');
      const button = document.getElementById('plantEditToggle'); if (button) button.textContent = '編集モードを終了';
      toast('植栽編集モードを開始');
    }
    function end() {
      editing = false; deselect(); document.body.classList.remove('plant-editing'); document.getElementById('plantEditToggle')?.classList.remove('on');
      const button = document.getElementById('plantEditToggle'); if (button) button.textContent = '編集モードを開始';
      toast('植栽編集を終了');
    }
    function refreshAfterMutation(id = selectedId) { rebuild(); if (id && getObjects().has(id)) select(id); else deselect(); updateButtons(); }
    function commitPosition(id, x, z, rotation, message = '植栽を移動しました') {
      const plant = plantById(id), check = validation(plant, x, z);
      if (check.state === 'invalid') { toast(check.message); syncOverlay(); return false; }
      designState.updatePlant(id, { x, z, rotation }); refreshAfterMutation(id); if (check.message) toast(check.message); else toast(message); return true;
    }
    function move(dx, dz, amount = 0.25) {
      const plant = plantById(selectedId); if (!plant) return;
      commitPosition(selectedId, snapValue(plant.x + dx * amount, 0.25), snapValue(plant.z + dz * amount, 0.25), plant.rotation || 0);
    }
    function rotate(delta) { const plant = plantById(selectedId); if (plant) commitPosition(selectedId, plant.x, plant.z, (plant.rotation || 0) + delta, '植栽を回転しました'); }
    function remove() { const plant = plantById(selectedId); if (!plant) return; if (plant.sourceType !== 'added') { toast('既存植栽は削除できません'); return; } const id = selectedId; designState.remove(id); refreshAfterMutation(null); toast('追加植栽を削除しました'); }
    function resetSelected() { const plant = plantById(selectedId); if (!plant) return; if (plant.sourceType !== 'base') { toast('追加植栽には元位置がありません'); return; } designState.resetPlant(selectedId); refreshAfterMutation(selectedId); toast('元位置へ戻しました'); }
    function findNearby(plant, x, z) {
      for (let radius = 1; radius <= 5; radius += 0.5) for (let i = 0; i < 16; i += 1) { const a = i / 16 * Math.PI * 2, px = snapValue(x + Math.cos(a) * radius), pz = snapValue(z + Math.sin(a) * radius); if (validation(plant, px, pz).state !== 'invalid') return { x: px, z: pz }; }
      return null;
    }
    function duplicate() {
      const plant = plantById(selectedId); if (!plant) return;
      const target = findNearby(plant, plant.x + 1, plant.z); if (!target) { toast('複製できる場所が見つかりません'); return; }
      const id = designState.add(plant.name, target, undefined, plant); refreshAfterMutation(id); toast('植栽を複製しました');
    }
    function addSpecies(name) {
      const profile = PLANT_CATALOG.find(item => item.name === name); if (!profile) return;
      const center = options.getViewCenter?.() || { x: 0, z: 8 };
      const target = findNearby({ ...profile, designId: '' }, center.x, center.z); if (!target) { toast('追加できる場所が見つかりません'); return; }
      if (!editing) begin();
      const id = designState.add(name, target); refreshAfterMutation(id); toast(`${name}を追加しました`);
    }
    function performUndo(redo = false) { if ((redo ? designState.redo() : designState.undo())) { refreshAfterMutation(selectedId); toast(redo ? 'やり直しました' : '元に戻しました'); } }
    function resetPlan() { if (!global.confirm('現在プランの植栽配置を固定配置へ戻しますか？')) return; designState.resetLayout(); refreshAfterMutation(null); toast('現在プランの植栽を初期化しました'); }
    function updateButtons() { document.getElementById('plantUndoBtn')?.toggleAttribute('disabled', !designState.canUndo()); document.getElementById('plantRedoBtn')?.toggleAttribute('disabled', !designState.canRedo()); }

    function rayFromEvent(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, getCamera());
    }
    function idFromObject(object) { let current = object; while (current && !current.userData?.designId) current = current.parent; return current?.userData?.designId || null; }
    function onPointerDown(event) {
      if (!editing || event.button !== 0) return;
      rayFromEvent(event);
      const targets = Array.from(getObjects().values(), entry => entry.group);
      const picked = raycaster.intersectObjects(targets, true)[0];
      const id = picked ? idFromObject(picked.object) : null;
      if (!id) { deselect(); return; }
      select(id); rayFromEvent(event); if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const entry = getObjects().get(id), plant = plantById(id);
      drag = { id, pointerId: event.pointerId, start: { x: entry.group.position.x, z: entry.group.position.z, rotation: plant.rotation || 0 }, offset: { x: entry.group.position.x - hit.x, z: entry.group.position.z - hit.z }, lastValid: { x: entry.group.position.x, z: entry.group.position.z } };
      renderer.domElement.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopPropagation();
    }
    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      rayFromEvent(event); if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const entry = getObjects().get(drag.id), plant = plantById(drag.id); if (!entry || !plant) return;
      const x = snapValue(hit.x + drag.offset.x), z = snapValue(hit.z + drag.offset.z), check = validation(plant, x, z);
      entry.group.position.x = x; entry.group.position.z = z; entry.crown && entry.crown.position.set(x, entry.crown.position.y, z); entry.label && entry.label.position.set(x, entry.label.position.y, z);
      if (check.state !== 'invalid') drag.lastValid = { x, z };
      overlay.position.set(x, 0, z); setColor(check.state); updateInfo(check); event.preventDefault(); event.stopPropagation();
    }
    function finishDrag(cancelled) {
      if (!drag) return;
      const entry = getObjects().get(drag.id), plant = plantById(drag.id), target = cancelled ? drag.start : drag.lastValid;
      if (entry) entry.group.position.set(target.x, entry.group.position.y, target.z);
      const changed = !cancelled && Math.hypot(target.x - drag.start.x, target.z - drag.start.z) > 1e-6;
      const id = drag.id, rotation = plant?.rotation || drag.start.rotation; drag = null;
      if (changed) commitPosition(id, target.x, target.z, rotation); else syncOverlay();
    }
    function onPointerUp(event) { if (drag && event.pointerId === drag.pointerId) { finishDrag(false); event.preventDefault(); event.stopPropagation(); } }
    function formFocused() { const tag = document.activeElement?.tagName; return ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || document.activeElement?.isContentEditable; }
    function onKeyDown(event) {
      if (!editing || formFocused()) return;
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { performUndo(event.shiftKey); event.preventDefault(); return; }
      if (event.code === 'Escape') { if (drag) finishDrag(true); else deselect(); event.preventDefault(); return; }
      if (!selectedId) return;
      const amount = event.shiftKey ? 1 : 0.25;
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[event.code]) { move(moves[event.code][0], moves[event.code][1], amount); event.preventDefault(); }
      if (event.code === 'KeyR') { rotate((event.shiftKey ? -15 : 15) * Math.PI / 180); event.preventDefault(); }
      if (event.code === 'Delete' || event.code === 'Backspace') { remove(); event.preventDefault(); }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { capture: true });
    renderer.domElement.addEventListener('pointerup', onPointerUp, { capture: true });
    renderer.domElement.addEventListener('pointercancel', () => finishDrag(true), { capture: true });
    global.addEventListener('keydown', onKeyDown, { capture: true });

    return { isEditing: () => editing, get selectedId() { return selectedId; }, begin, end, select, deselect, move, rotate, remove, duplicate, resetSelected, addSpecies, undo: () => performUndo(false), redo: () => performUndo(true), resetPlan, isValid: (plant, x, z) => validation(plant, x, z).state !== 'invalid', setSnap(value) { snap = Number(value) || 0; }, refresh() { syncOverlay(); updateButtons(); }, beforeRebuild() { overlay.visible = origin.visible = false; }, afterRebuild() { if (selectedId && getObjects().has(selectedId)) syncOverlay(); else deselect(); updateButtons(); } };
  }

  global.createPlantEditor = createPlantEditor;
})(window);
