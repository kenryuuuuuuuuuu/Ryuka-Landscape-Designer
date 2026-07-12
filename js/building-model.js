(function exposeBuildingModel(global) {
  'use strict';

  function box(group, w, h, d, material, x, y, z, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = castShadow; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }

  function cylinder(group, radius, height, material, x, y, z, segments = 8, rotateZ = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
    mesh.position.set(x, y, z); if (rotateZ) mesh.rotation.z = Math.PI / 2; mesh.castShadow = false; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }

  function addWindow(group, options) {
    const { x, y, width, height, z, outward, materials, tag, title } = options;
    const frameDepth = .11, frame = .09, face = z + outward * .035;
    box(group, width + .18, height + .18, .07, materials.interior, x, y, z - outward * .025, false);
    const glass = box(group, width, height, .035, materials.glass, x, y, z + outward * .005, false);
    box(group, width - .18, height - .16, .018, materials.curtain, x, y, z - outward * .05, false);
    box(group, width + .18, frame, frameDepth, materials.metal, x, y + height / 2 + frame / 2, face, false);
    box(group, width + .18, frame, frameDepth, materials.metal, x, y - height / 2 - frame / 2, face, false);
    box(group, frame, height, frameDepth, materials.metal, x - width / 2 - frame / 2, y, face, false);
    box(group, frame, height, frameDepth, materials.metal, x + width / 2 + frame / 2, y, face, false);
    box(group, frame * .72, height, frameDepth, materials.metal, x, y, face, false);
    box(group, width + .3, .055, .19, materials.trim, x, y - height / 2 - .11, z + outward * .075, false);
    if (tag) tag(glass, { title, body: '奥まったガラス、金属サッシ、窓台、室内暗部で構成した外窓。', meta: [['中心', `x ${x.toFixed(1)}`], ['幅', `${width}m`]] });
  }

  function addPlanModel(group, B, materials, tag) {
    box(group, B.w, .35, B.d, materials.planFoundation, B.cx, .175, B.cz, false);
    const body = box(group, B.w, B.wallH - .35, B.d, materials.planWall, B.cx, (B.wallH + .35) / 2, B.cz, false);
    tag(body, { title: '住宅＋民泊 建物', body: '固定された建物外接寸法を確認するPLAN表示。', meta: [['中心', `x ${B.cx.toFixed(3)} / z ${B.cz.toFixed(3)}`], ['寸法', `${B.w} × ${B.d}m`], ['壁高', `${B.wallH}m`]] });
    const rise = B.ridgeH - B.wallH, slope = Math.hypot(B.d / 2, rise), angle = Math.atan2(rise, B.d / 2);
    const north = box(group, B.w, .12, slope, materials.planRoof, B.cx, B.wallH + rise / 2 - .05, B.cz - B.d / 4, false); north.rotation.x = -angle;
    const south = box(group, B.w, .12, slope, materials.planRoof, B.cx, B.wallH + rise / 2 - .05, B.cz + B.d / 4, false); south.rotation.x = angle;
    B.southWindows.forEach(w => box(group, w.w, 1.25, .04, materials.planOpening, w.x, 1.75, B.cz + B.d / 2 + .025, false));
    B.northWindows.forEach(x => box(group, 1.5, 1.05, .04, materials.planOpening, x, 2, B.cz - B.d / 2 - .025, false));
    box(group, 1.2, 2.2, .045, materials.planDoor, B.doorX, 1.5, B.cz - B.d / 2 - .03, false);
  }

  function addRealModel(group, B, materials, tag) {
    const baseH = .42, wallBottom = .48, wallCenter = (B.wallH + wallBottom) / 2, wallH = B.wallH - wallBottom;
    box(group, B.w - .2, .025, B.d - .18, materials.shadow, B.cx, .014, B.cz, false);
    box(group, B.w, baseH, B.d, materials.foundation, B.cx, baseH / 2, B.cz);
    box(group, B.w, .075, B.d, materials.metal, B.cx, baseH + .035, B.cz, false);

    const southWall = box(group, B.w - .18, wallH, .18, materials.wall, B.cx, wallCenter, B.cz + B.d / 2 - .09);
    const northWall = box(group, B.w - .18, wallH, .18, materials.wall, B.cx, wallCenter, B.cz - B.d / 2 + .09);
    box(group, .18, wallH, B.d - .36, materials.wall, B.cx - B.w / 2 + .09, wallCenter, B.cz);
    box(group, .18, wallH, B.d - .36, materials.wall, B.cx + B.w / 2 - .09, wallCenter, B.cz);
    tag(southWall, { title: '住宅＋民泊 建物', body: '基礎、水切り、分割外壁、見切り材を備えた住宅外観。', meta: [['中心', `x ${B.cx.toFixed(3)} / z ${B.cz.toFixed(3)}`], ['寸法', `${B.w} × ${B.d}m`], ['壁高', `${B.wallH}m`]] });

    for (const x of [B.cx - B.w / 2 + .07, B.cx + B.w / 2 - .07]) box(group, .095, wallH, .095, materials.trim, x, wallCenter, B.cz + B.d / 2 - .035, false);
    for (let y = 1.15; y < B.wallH - .3; y += 1.15) {
      box(group, B.w - .24, .018, .02, materials.trim, B.cx, y, B.cz + B.d / 2 + .012, false);
      box(group, B.w - .24, .018, .02, materials.trim, B.cx, y, B.cz - B.d / 2 - .012, false);
    }

    B.southWindows.forEach((w, index) => addWindow(group, { x: w.x, y: 1.75, width: w.w, height: 1.25, z: B.cz + B.d / 2, outward: 1, materials, tag: index === 0 ? tag : null, title: '民泊リビング 腰窓' }));
    B.northWindows.forEach(x => addWindow(group, { x, y: 2, width: 1.5, height: 1.05, z: B.cz - B.d / 2, outward: -1, materials, tag: null, title: '北側窓' }));

    const rise = B.ridgeH - B.wallH, slope = Math.hypot(B.d / 2, rise), angle = Math.atan2(rise, B.d / 2), roofY = B.wallH + rise / 2 - .08;
    box(group, B.w, .12, B.d - .18, materials.interior, B.cx, B.wallH - .045, B.cz, false);
    const northRoof = box(group, B.w, .18, slope, materials.roof, B.cx, roofY, B.cz - B.d / 4); northRoof.rotation.x = -angle;
    const southRoof = box(group, B.w, .18, slope, materials.roof, B.cx, roofY, B.cz + B.d / 4); southRoof.rotation.x = angle;
    tag(northRoof, { title: '切妻屋根', body: '厚み、屋根材の継ぎ目、棟包み、破風、雨樋を備えた固定棟高の屋根。', meta: [['棟高', `${B.ridgeH}m`], ['壁高', `${B.wallH}m`]] });
    for (let x = B.cx - B.w / 2 + .7; x < B.cx + B.w / 2; x += 1.25) {
      const n = box(group, .022, .028, slope - .12, materials.metal, x, roofY + .105, B.cz - B.d / 4, false); n.rotation.x = -angle;
      const s = box(group, .022, .028, slope - .12, materials.metal, x, roofY + .105, B.cz + B.d / 4, false); s.rotation.x = angle;
    }
    box(group, B.w, .16, .19, materials.metal, B.cx, B.ridgeH - .08, B.cz, false);
    for (const x of [B.cx - B.w / 2 + .07, B.cx + B.w / 2 - .07]) {
      const n = box(group, .11, .19, slope, materials.trim, x, roofY, B.cz - B.d / 4, false); n.rotation.x = -angle;
      const s = box(group, .11, .19, slope, materials.trim, x, roofY, B.cz + B.d / 4, false); s.rotation.x = angle;
    }

    const northZ = B.cz - B.d / 2 + .04, southZ = B.cz + B.d / 2 - .04;
    cylinder(group, .075, B.w - .18, materials.gutter, B.cx, B.wallH - .02, northZ, 8, true);
    cylinder(group, .075, B.w - .18, materials.gutter, B.cx, B.wallH - .02, southZ, 8, true);
    [[B.cx - B.w / 2 + .16, northZ], [B.cx + B.w / 2 - .16, northZ], [B.cx + B.w / 2 - .16, southZ]].forEach(p => cylinder(group, .055, B.wallH - .55, materials.gutter, p[0], (B.wallH - .55) / 2 + .42, p[1], 8));

    const doorZ = B.cz - B.d / 2 - .035, doorY = baseH + 1.1;
    box(group, 1.42, 2.42, .12, materials.interior, B.doorX, doorY, doorZ + .035, false);
    const door = box(group, 1.2, 2.2, .09, materials.wood, B.doorX, doorY, doorZ - .035);
    box(group, 1.46, .11, .15, materials.metal, B.doorX, doorY + 1.18, doorZ - .01, false);
    box(group, .11, 2.42, .15, materials.metal, B.doorX - .66, doorY, doorZ - .01, false);
    box(group, .11, 2.42, .15, materials.metal, B.doorX + .66, doorY, doorZ - .01, false);
    cylinder(group, .04, .15, materials.metal, B.doorX + .36, doorY, doorZ - .1, 8, true);
    box(group, 1.55, .12, .48, materials.foundation, B.doorX, .18, B.cz - B.d / 2 - .18, false);
    box(group, 1.8, .12, .82, materials.roof, B.doorX, doorY + 1.5, B.cz - B.d / 2 - .33, false);
    tag(door, { title: '北側玄関', body: '枠、取っ手、敷居、踏み台、庇を備えた道路側玄関。', meta: [['中心', `x ${B.doorX}`], ['高さ', '2.2m']] });

    box(group, .22, .14, .08, materials.metal, B.doorX - 1.05, doorY + 1.05, B.cz - B.d / 2 - .055, false);
    box(group, .38, .52, .12, materials.metal, B.cx + B.w / 2 - 1.1, 1.45, B.cz - B.d / 2 - .06, false);
    box(group, .24, .16, .1, materials.metal, B.cx - 2.2, 4.75, B.cz + B.d / 2 + .04, false);
    [B.cx + 3.9, B.cx + 6.0].forEach(x => {
      box(group, 1.05, .72, .38, materials.trim, x, .48, B.cz + B.d / 2 - .08, false);
      cylinder(group, .25, .08, materials.metal, x, .48, B.cz + B.d / 2 + .13, 8, true);
    });
  }

  global.createBuildingModel = function createBuildingModel(options) {
    const group = new THREE.Group();
    if (options.mode === 'plan') addPlanModel(group, options.data, options.materials, options.tag);
    else addRealModel(group, options.data, options.materials, options.tag);
    return group;
  };
})(window);
