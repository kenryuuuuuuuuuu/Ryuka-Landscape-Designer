(function exposeGroundFeatureEditor(global) {
  'use strict';

  function createGroundFeatureEditor(options) {
    const { THREE, scene, renderer, data, designState, getCamera, getObjects, getFeatures, toast, beforeBegin } = options;
    const utils = global.GROUND_GEOMETRY_UTILS;
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const overlay = new THREE.Group(); overlay.visible = false; scene.add(overlay);
    const handleGeometry = new THREE.SphereGeometry(0.19, 10, 7);
    const handleMaterials = {
      normal: new THREE.MeshBasicMaterial({ color: 0x66d7b0, depthTest: false }),
      selected: new THREE.MeshBasicMaterial({ color: 0xffd26a, depthTest: false }),
      invalid: new THREE.MeshBasicMaterial({ color: 0xe85d5d, depthTest: false })
    };
    const handles = Array.from({ length: 24 }, (_, index) => {
      const mesh = new THREE.Mesh(handleGeometry, handleMaterials.normal); mesh.visible = false; mesh.renderOrder = 50; mesh.userData.vertexIndex = index; overlay.add(mesh); return mesh;
    });
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0x62a8ff, depthTest: false }));
    center.renderOrder = 51; center.userData.centerHandle = true; overlay.add(center);
    const origin = new THREE.Group(); origin.visible = false; scene.add(origin);
    const originMaterial = new THREE.LineDashedMaterial({ color: 0xc9b88d, dashSize: 0.35, gapSize: 0.22, transparent: true, opacity: 0.7, depthTest: false });
    let editing = false, selectedId = null, selectedVertex = -1, drag = null;
    let snap = Number(localStorage.getItem('ryuka-ground-snap') || 0.25);

    function entryVisible(entry) {
      let object = entry?.group;
      while (object) { if (object.visible === false) return false; object = object.parent; }
      return !!entry;
    }
    function featureById(id = selectedId) { return getFeatures().find(item => item.designId === id) || null; }
    function snapValue(value) { return snap ? Math.round(value / snap) * snap : value; }
    function surface(item) { return item.kind === 'path' ? utils.buildPathRibbon(item.points, item.width) : item.points; }
    function sameBase(item) {
      return item.sourceType === 'base' && JSON.stringify(item.points) === JSON.stringify(item.basePoints) && Math.abs((item.width || 0) - (item.baseWidth || 0)) < 1e-6 && item.materialId === item.baseMaterialId;
    }
    function buildingPolygon() {
      const building = data.building;
      return [
        { x: building.cx - building.w / 2, z: building.cz - building.d / 2 }, { x: building.cx + building.w / 2, z: building.cz - building.d / 2 },
        { x: building.cx + building.w / 2, z: building.cz + building.d / 2 }, { x: building.cx - building.w / 2, z: building.cz + building.d / 2 }
      ];
    }
    function pointSetEqual(first, second) {
      if (first.length !== second.length) return false;
      return first.every(point => second.some(other => Math.hypot(point.x - other.x, point.z - other.z) < 1e-5));
    }
    function validation(item, context = getFeatures()) {
      if (!item) return { state: 'invalid', message: '地表要素がありません' };
      if (sameBase(item)) return { state: 'valid', message: '' };
      const minimum = item.kind === 'path' ? 2 : 3;
      if (!Array.isArray(item.points) || item.points.length < minimum || item.points.length > 24) return { state: 'invalid', message: '頂点数が範囲外です' };
      if (item.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.z))) return { state: 'invalid', message: '座標が不正です' };
      for (let index = 0; index < item.points.length - (item.kind === 'path' ? 1 : 0); index += 1) {
        const next = item.points[(index + 1) % item.points.length];
        if (Math.hypot(item.points[index].x - next.x, item.points[index].z - next.z) < 0.25) return { state: 'invalid', message: '頂点間隔は0.25m以上必要です' };
      }
      if (item.kind === 'area' && (!utils.isSimplePolygon(item.points) || utils.polygonArea(item.points) < 0.5)) return { state: 'invalid', message: '単純な0.5㎡以上の区画にしてください' };
      if (item.kind === 'path' && (item.width < 0.4 || item.width > 4 || utils.polylineLength(item.points) < 0.5)) return { state: 'invalid', message: '園路幅または延長が範囲外です' };
      const polygon = surface(item);
      if (polygon.length < 3 || !utils.isSimplePolygon(polygon)) return { state: 'invalid', message: '有効な地表形状を生成できません' };
      if (polygon.some(point => !utils.pointInPolygon(point, data.site))) return { state: 'invalid', message: '地表形状を敷地内へ配置してください' };
      if (utils.polygonsOverlap(polygon, buildingPolygon())) return { state: 'invalid', message: '建物と重なっています' };
      let warning = '';
      for (const other of context) {
        if (other.designId === item.designId) continue;
        const otherSurface = surface(other);
        if (!otherSurface.length || !utils.polygonsOverlap(polygon, otherSurface)) continue;
        if (item.kind === other.kind && pointSetEqual(polygon, otherSurface)) return { state: 'invalid', message: '同じ地表要素と完全に重なっています' };
        if (item.kind === other.kind) warning = item.kind === 'path' ? '園路が交差しています' : '他の区画と重なっています';
      }
      const objects = options.getResolvedObjects?.() || [];
      if (!warning && objects.some(object => utils.pointInPolygon({ x: object.x, z: object.z }, polygon))) warning = '設備と重なっています';
      const plants = options.getResolvedPlants?.() || [];
      if (!warning && plants.some(plant => utils.pointInPolygon({ x: plant.x, z: plant.z }, polygon))) warning = '植栽位置と重なっています';
      return { state: warning ? 'warning' : 'valid', message: warning };
    }
    function releaseCapture(active = drag) {
      if (!active) return;
      try { if (renderer.domElement.hasPointerCapture?.(active.pointerId)) renderer.domElement.releasePointerCapture(active.pointerId); } catch (_) {}
    }
    function clearOrigin() {
      origin.children.forEach(child => child.geometry?.dispose?.()); origin.clear(); origin.visible = false;
    }
    function syncOrigin(item) {
      clearOrigin();
      if (!editing || item?.sourceType !== 'base' || sameBase(item)) return;
      const points = item.kind === 'path' ? utils.buildPathRibbon(item.basePoints, item.baseWidth) : item.basePoints;
      if (!points.length) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(points.concat([points[0]]).map(point => new THREE.Vector3(point.x, 0.095, point.z)));
      const line = new THREE.Line(geometry, originMaterial); line.computeLineDistances(); line.renderOrder = 45; origin.add(line); origin.visible = true;
    }
    function setStateColor(state) {
      handles.forEach((handle, index) => { handle.material = state === 'invalid' ? handleMaterials.invalid : index === selectedVertex ? handleMaterials.selected : handleMaterials.normal; });
      center.material.color.setHex(state === 'invalid' ? 0xe85d5d : state === 'warning' ? 0xe3ba52 : 0x62a8ff);
    }
    function syncOverlay(item = featureById()) {
      if (!editing || !item || !entryVisible(getObjects().get(item.designId))) { overlay.visible = false; clearOrigin(); options.onSelectionChange?.(null); return; }
      overlay.visible = true;
      handles.forEach((handle, index) => {
        handle.visible = index < item.points.length;
        if (handle.visible) handle.position.set(item.points[index].x, 0.22, item.points[index].z);
      });
      center.position.set(item.centroid.x, 0.1, item.centroid.z);
      const status = validation(item); setStateColor(status.state); syncOrigin(item);
      options.showInfo?.(item, status, selectedVertex); options.onSelectionChange?.(item, status, selectedVertex); updateButtons();
    }
    function select(id) {
      const entry = getObjects().get(id);
      if (!editing || !entryVisible(entry)) return false;
      selectedId = id; selectedVertex = -1; document.body.classList.add('ground-selected'); syncOverlay(); return true;
    }
    function selectVertex(index) {
      const item = featureById();
      if (item && Number(index) === -1) { selectedVertex = -1; syncOverlay(); return true; }
      if (!item || index < 0 || index >= item.points.length) return false;
      selectedVertex = index; syncOverlay(); return true;
    }
    function deselect() {
      releaseCapture(); drag = null; selectedId = null; selectedVertex = -1; overlay.visible = false; clearOrigin();
      document.body.classList.remove('ground-selected'); options.onSelectionChange?.(null); updateButtons();
    }
    function begin() {
      if (editing) return true;
      if (beforeBegin?.() === false) return false;
      editing = true; document.body.classList.add('ground-editing'); document.getElementById('groundEditToggle')?.classList.add('on');
      const button = document.getElementById('groundEditToggle'); if (button) button.textContent = '編集モードを終了';
      options.onBegin?.(); toast('園路・区画編集を開始しました'); return true;
    }
    function end() {
      if (!editing) return;
      editing = false; deselect(); document.body.classList.remove('ground-editing'); document.getElementById('groundEditToggle')?.classList.remove('on');
      const button = document.getElementById('groundEditToggle'); if (button) button.textContent = '編集モードを開始';
      options.onEnd?.(); toast('園路・区画編集を終了しました');
    }
    function refresh(id = selectedId) {
      options.rebuild?.();
      if (id && select(id)) {} else deselect();
      options.updateTotals?.();
    }
    function commit(item, message) {
      const status = validation(item);
      if (status.state === 'invalid') { toast(status.message); syncOverlay(); return false; }
      designState.updateGroundFeature(item.designId, { points: item.points, width: item.width, materialId: item.materialId });
      refresh(item.designId); toast(status.message || message); return true;
    }
    function movedItem(dx, dz, forceAll = false) {
      const item = featureById(); if (!item) return null;
      const points = item.points.map((point, index) => (!forceAll && selectedVertex >= 0 && index !== selectedVertex) ? { ...point } : ({ x: snapValue(point.x + dx), z: snapValue(point.z + dz) }));
      return { ...item, points };
    }
    function move(dx, dz, amount = 0.25) { const item = movedItem(dx * amount, dz * amount, false); if (item) commit(item, '地表形状を更新しました'); }
    function moveAll(dx, dz, amount = 0.25) { const item = movedItem(dx * amount, dz * amount, true); if (item) commit(item, '地表要素を移動しました'); }
    function addVertex(segmentIndex = selectedVertex >= 0 ? selectedVertex : 0) {
      const item = featureById(); if (!item || item.points.length >= 24) { toast('頂点は24点までです'); return false; }
      const limit = item.kind === 'path' ? item.points.length - 1 : item.points.length;
      const index = Math.max(0, Math.min(limit - 1, Number(segmentIndex) || 0)), next = (index + 1) % item.points.length;
      const midpoint = { x: snapValue((item.points[index].x + item.points[next].x) / 2), z: snapValue((item.points[index].z + item.points[next].z) / 2) };
      const points = item.points.map(point => ({ ...point })); points.splice(index + 1, 0, midpoint);
      if (commit({ ...item, points }, '頂点を追加しました')) { selectedVertex = index + 1; syncOverlay(); return true; }
      return false;
    }
    function removeVertex() {
      const item = featureById(); if (!item || selectedVertex < 0) return false;
      const minimum = item.kind === 'path' ? 2 : 3;
      if (item.points.length <= minimum) { toast(`${item.kind === 'path' ? '園路' : '区画'}は${minimum}点未満にできません`); return false; }
      const points = item.points.filter((_, index) => index !== selectedVertex);
      if (commit({ ...item, points }, '頂点を削除しました')) { selectedVertex = Math.min(selectedVertex, points.length - 1); syncOverlay(); return true; }
      return false;
    }
    function setWidth(width) {
      const item = featureById(); if (!item || item.kind !== 'path') return false;
      return commit({ ...item, width: Math.max(0.4, Math.min(4, Number(width) || item.width)) }, '園路幅を変更しました');
    }
    function setMaterial(materialId) {
      const item = featureById(), material = global.GROUND_FEATURE_MATERIALS[materialId];
      if (!item || material?.kind !== item.kind) return false;
      return commit({ ...item, materialId }, '素材を変更しました');
    }
    function findPosition(item, preferred) {
      const offsets = [{ x: 0, z: 0 }];
      for (let radius = 0.5; radius <= 8; radius += 0.5) for (let index = 0; index < 16; index += 1) offsets.push({ x: Math.cos(index / 16 * Math.PI * 2) * radius, z: Math.sin(index / 16 * Math.PI * 2) * radius });
      for (const offset of offsets) {
        const points = item.points.map(point => ({ x: snapValue(point.x + preferred.x + offset.x), z: snapValue(point.z + preferred.z + offset.z) }));
        const candidate = { ...item, points, designId: `candidate-ground-${Date.now()}` };
        if (validation(candidate).state !== 'invalid') return points;
      }
      return null;
    }
    function add(featureType) {
      const profile = global.GROUND_FEATURE_CATALOG_BY_TYPE.get(featureType); if (!profile) return null;
      if (!editing && !begin()) return null;
      const view = options.getViewCenter?.() || { x: 0, z: 6 };
      const seed = profile.kind === 'path'
        ? [{ x: -1.5, z: 0 }, { x: 1.5, z: 0 }]
        : [{ x: -1.5, z: -1 }, { x: 1.5, z: -1 }, { x: 1.5, z: 1 }, { x: -1.5, z: 1 }];
      const template = { ...profile, designId: 'candidate-ground-add', points: seed, width: profile.defaultWidth, materialId: profile.materialId, layer: profile.defaultLayer, sourceType: 'added' };
      const points = findPosition(template, view);
      if (!points) { toast('追加できる位置が見つかりません'); return null; }
      const id = designState.addGroundFeature(featureType, { points, width: profile.defaultWidth, materialId: profile.materialId });
      refresh(id); toast(`${profile.label}を追加しました`); return id;
    }
    function bounds(points) {
      const xs = points.map(point => point.x), zs = points.map(point => point.z);
      return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
    }
    function duplicate() {
      const item = featureById(); if (!item) return null;
      const shift = bounds(surface(item)).width + 0.5;
      const template = { ...item, designId: 'candidate-ground-copy', sourceType: 'added' };
      const points = findPosition({ ...template, points: item.points.map(point => ({ x: point.x - item.centroid.x, z: point.z - item.centroid.z })) }, { x: item.centroid.x + shift, z: item.centroid.z });
      if (!points) { toast('複製できる位置が見つかりません'); return null; }
      const id = designState.addGroundFeature(item.featureType, { points, width: item.width, materialId: item.materialId });
      refresh(id); toast('地表要素を複製しました'); return id;
    }
    function remove() {
      const item = featureById(); if (!item) return false;
      if (item.sourceType !== 'added') { toast('固定地表要素は削除できません'); return false; }
      const removed = designState.removeGroundFeature(item.designId); if (removed) { refresh(null); toast('地表要素を削除しました'); } return removed;
    }
    function resetSelected() {
      const item = featureById(); if (!item || item.sourceType !== 'base') return false;
      designState.resetGroundFeature(item.designId); refresh(item.designId); toast('元形状へ戻しました'); return true;
    }
    function resetPlan() {
      if (!global.confirm('現在プランの園路・区画を初期化しますか？')) return false;
      designState.resetGroundLayout(); refresh(null); toast('地表配置を初期化しました'); return true;
    }
    function history(redo = false) {
      const changed = redo ? designState.redoGround() : designState.undoGround();
      if (changed) { refresh(selectedId); toast(redo ? 'やり直しました' : '元に戻しました'); } return changed;
    }
    function updateButtons() {
      document.getElementById('groundUndoBtn')?.toggleAttribute('disabled', !designState.canUndoGround());
      document.getElementById('groundRedoBtn')?.toggleAttribute('disabled', !designState.canRedoGround());
    }
    function ray(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, getCamera());
    }
    function rootId(object) { let current = object; while (current && !current.userData?.designId) current = current.parent; return current?.userData?.designId || null; }
    function onPointerDown(event) {
      if (!editing || event.button !== 0) return;
      ray(event);
      const handleHit = raycaster.intersectObjects([...handles.filter(handle => handle.visible), center], false)[0];
      if (handleHit) {
        if (handleHit.object.userData.vertexIndex !== undefined) selectedVertex = handleHit.object.userData.vertexIndex;
        else selectedVertex = -1;
      } else {
        const roots = Array.from(getObjects().values()).filter(entryVisible).map(entry => entry.group);
        const picked = raycaster.intersectObjects(roots, true)[0], id = picked ? rootId(picked.object) : null;
        if (!id) { deselect(); return; }
        select(id);
      }
      const item = featureById(); if (!item) return;
      ray(event); if (!raycaster.ray.intersectPlane(plane, hit)) return;
      drag = { pointerId: event.pointerId, id: item.designId, vertex: selectedVertex, startHit: { x: hit.x, z: hit.z }, startPoints: item.points.map(point => ({ ...point })), lastValid: item };
      renderer.domElement.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopPropagation(); syncOverlay();
    }
    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      ray(event); if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const current = featureById(drag.id); if (!current) return;
      const dx = snapValue(hit.x - drag.startHit.x), dz = snapValue(hit.z - drag.startHit.z);
      const points = drag.startPoints.map((point, index) => drag.vertex >= 0 && index !== drag.vertex ? { ...point } : ({ x: point.x + dx, z: point.z + dz }));
      const candidateSurface = current.kind === 'path' ? utils.buildPathRibbon(points, current.width) : points;
      const candidate = { ...current, points, centroid: utils.centroid(candidateSurface.length ? candidateSurface : points), area: utils.polygonArea(candidateSurface), perimeter: utils.polygonPerimeter(candidateSurface), length: current.kind === 'path' ? utils.polylineLength(points) : 0 };
      const status = validation(candidate);
      if (status.state !== 'invalid') drag.lastValid = candidate;
      options.preview?.(candidate, status);handles.forEach((handle,index)=>{if(index<points.length)handle.position.set(points[index].x,.22,points[index].z)});center.position.set(candidate.centroid.x,.1,candidate.centroid.z);options.showInfo?.(candidate, status, selectedVertex); setStateColor(status.state);
      event.preventDefault(); event.stopPropagation();
    }
    function finishDrag(cancelled) {
      if (!drag) return;
      const active = drag, original = featureById(active.id), target = cancelled ? original : active.lastValid;
      releaseCapture(active); drag = null;
      if (!cancelled && target && JSON.stringify(target.points) !== JSON.stringify(active.startPoints)) commit(target, '地表形状を更新しました');
      else { options.preview?.(original, validation(original)); syncOverlay(original); }
    }
    function handleLayerVisibility(layer, visible) {
      if (visible || !selectedId) { options.onVisibilityChange?.(); return; }
      const item = featureById(); if (item?.layer !== layer) { options.onVisibilityChange?.(); return; }
      if (drag) finishDrag(true); deselect(); options.onVisibilityChange?.();
    }
    function formFocused() { const element = document.activeElement; return ['INPUT', 'SELECT', 'TEXTAREA'].includes(element?.tagName) || element?.isContentEditable; }
    function onKeyDown(event) {
      if (!editing || formFocused()) return;
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { history(event.shiftKey); event.preventDefault(); return; }
      if (event.code === 'Escape') { if (drag) finishDrag(true); else if (selectedVertex >= 0) { selectedVertex = -1; syncOverlay(); } else deselect(); event.preventDefault(); return; }
      if (!selectedId) return;
      if (event.code === 'Tab') { const item = featureById(); selectedVertex = (selectedVertex + (event.shiftKey ? -1 : 1) + item.points.length) % item.points.length; syncOverlay(); event.preventDefault(); return; }
      const amount = event.shiftKey ? 1 : 0.25;
      if (event.code === 'ArrowLeft') move(-1, 0, amount);
      else if (event.code === 'ArrowRight') move(1, 0, amount);
      else if (event.code === 'ArrowUp') move(0, -1, amount);
      else if (event.code === 'ArrowDown') move(0, 1, amount);
      else if (event.code === 'Insert' || event.code === 'KeyA') addVertex();
      else if (event.code === 'BracketLeft') setWidth((featureById()?.width || 0.5) - 0.1);
      else if (event.code === 'BracketRight') setWidth((featureById()?.width || 0.5) + 0.1);
      else if (event.code === 'Delete' || event.code === 'Backspace') { if (selectedVertex >= 0) removeVertex(); else remove(); }
      else return;
      event.preventDefault();
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { capture: true });
    renderer.domElement.addEventListener('pointerup', event => { if (drag && event.pointerId === drag.pointerId) finishDrag(false); }, { capture: true });
    renderer.domElement.addEventListener('pointercancel', event => { if (drag && event.pointerId === drag.pointerId) finishDrag(true); }, { capture: true });
    global.addEventListener('keydown', onKeyDown, { capture: true });

    return {
      isEditing: () => editing, get selectedId() { return selectedId; }, get selectedVertex() { return selectedVertex; },
      begin, end, select, selectVertex, deselect, move, moveAll, addVertex, removeVertex, setWidth, setMaterial,
      add, duplicate, remove, resetSelected, resetPlan, undo: () => history(false), redo: () => history(true),
      list: () => getFeatures().map(item => ({ ...item, points: item.points.map(point => ({ ...point })) })),
      totals: () => global.groundFeatureTotals(getFeatures()), validation, isValid: (item, context) => validation(item, context).state !== 'invalid',
      handleLayerVisibility, setSnap(value) { snap = Number(value) || 0; localStorage.setItem('ryuka-ground-snap', String(snap)); },
      beforeRebuild() { if (drag) finishDrag(true); overlay.visible = false; },
      afterRebuild() { if (selectedId && select(selectedId)) {} else deselect(); updateButtons(); }, refresh: syncOverlay
    };
  }

  global.createGroundFeatureEditor = createGroundFeatureEditor;
})(window);
