// 天領住宅 Ver5 実施図面（2026年7月）に基づく建物モデル。
// 形状の根拠は docs/BUILDING-SPEC.md を参照すること。
(function exposeBuildingModel(global) {
  'use strict';

  // ---- 汎用ヘルパ（すべてワールド座標・単位m） ----
  function box(group, w, h, d, material, x, y, z, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  }
  function cylinder(group, radius, height, material, x, y, z, segments = 8, rotateZ = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
    mesh.position.set(x, y, z); if (rotateZ) mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = false; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  }
  // 局所座標(lx: 西端起点, lz: 北面起点) → ワールド
  function makeXf(B) {
    return {
      x: lx => B.origin.x + lx,
      z: lz => B.origin.z + lz,
      cx: (a, b) => B.origin.x + (a + b) / 2,
      cz: (a, b) => B.origin.z + (a + b) / 2
    };
  }
  // 矩形ボリューム: 局所範囲 [x0,x1] × [z0,z1] を y0→y1 で立ち上げる
  function mass(group, B, mat, x0, x1, z0, z1, y0, y1, cast = true) {
    const T = makeXf(B);
    return box(group, x1 - x0, y1 - y0, z1 - z0, mat, T.cx(x0, x1), (y0 + y1) / 2, T.cz(z0, z1), cast);
  }
  // 上端がz方向へ傾斜する壁ボリューム。下屋直下など、矩形壁では屋根と干渉する箇所に使う。
  function slopedMass(group, B, mat, x0, x1, z0, z1, y0, yA, yB, cast = true) {
    const T = makeXf(B);
    const xa = T.x(x0), xb = T.x(x1), za = T.z(z0), zb = T.z(z1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      xa, y0, za, xb, y0, za, xb, y0, zb, xa, y0, zb,
      xa, yA, za, xb, yA, za, xb, yB, zb, xa, yB, zb
    ], 3));
    geometry.setIndex([
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1,
      3, 2, 6, 3, 6, 7,
      0, 3, 7, 0, 7, 4,
      1, 5, 6, 1, 6, 2
    ]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  }
  // 傾斜屋根面: 局所[x0,x1]幅、lz=zA(高さyA)→lz=zB(高さyB) の板
  function slopeRoof(group, B, mat, x0, x1, zA, yA, zB, yB, thickness = 0.16) {
    const T = makeXf(B), run = zB - zA, rise = yB - yA;
    const len = Math.hypot(run, rise), angle = Math.atan2(rise, run);
    const mesh = box(group, x1 - x0, thickness, len, mat,
      T.cx(x0, x1), (yA + yB) / 2, T.cz(zA, zB));
    mesh.rotation.x = -angle;
    return mesh;
  }

  // ---- 開口部 ----
  // face: 'N'/'S' は局所x(lx)+階に応じた奥行きで位置決め、'E'/'W' は局所z(lz)+東西端で位置決め。
  function addOpening(group, B, o, materials, tag) {
    const T = makeXf(B);
    const isNS = o.face === 'N' || o.face === 'S';
    let x, z, outward;
    if (isNS) {
      // 2階の壁は z0=0・floor2.depth（6.370m）で一定。1階floor1区画は北面(z0)がA1→A2→A3で
      // 段状に後退し、南面(z1=z0+depth)はA1〜A3で共通、A4だけ南へ突き出す。
      const seg = o.level === 2 ? { z0: B.floor2.z0, depth: B.floor2.depth } : segmentAt(B, o.lx);
      outward = o.face === 'S' ? 1 : -1;
      const lz = o.face === 'S' ? seg.z0 + seg.depth : seg.z0;
      x = T.x(o.lx); z = T.z(lz) + outward * 0.09;
    } else {
      // 東西面: 東端=segment4(x=19.110)。西面は1階=segment1(x=0)、2階=floor2.x0。
      outward = o.face === 'E' ? 1 : -1;
      const lx = o.face === 'E'
        ? B.floor1[B.floor1.length - 1].x1
        : (o.level === 2 ? B.floor2.x0 : B.floor1[0].x0);
      x = T.x(lx) + outward * 0.09; z = T.z(o.lz);
    }
    const y = (o.level === 2 ? B.levels.fl2 : B.levels.fl1) + o.sill + o.h / 2;
    const face = isNS ? z + outward * 0.035 : x + outward * 0.035;
    const frameOuter = isNS
      ? [o.w + 0.18, o.h + 0.18, 0.07]
      : [0.07, o.h + 0.18, o.w + 0.18];
    const pFrame = isNS ? [x, y, z - outward * 0.025] : [x - outward * 0.025, y, z];
    box(group, ...frameOuter, materials.interior, ...pFrame, false);
    const glassSize = isNS ? [o.w, o.h, 0.035] : [0.035, o.h, o.w];
    const pGlass = isNS ? [x, y, z + outward * 0.005] : [x + outward * 0.005, y, z];
    const glass = box(group, ...glassSize, o.kind === 'door' ? materials.wood : materials.glass, ...pGlass, false);
    if (o.kind !== 'door') {
      const cSize = isNS ? [o.w - 0.18, o.h - 0.16, 0.018] : [0.018, o.h - 0.16, o.w - 0.18];
      const pC = isNS ? [x, y, z - outward * 0.05] : [x - outward * 0.05, y, z];
      box(group, ...cSize, materials.curtain, ...pC, false);
    }
    const f = 0.09;
    const barH = isNS ? [o.w + 0.18, f, 0.11] : [0.11, f, o.w + 0.18];
    const barV = isNS ? [f, o.h, 0.11] : [0.11, o.h, f];
    box(group, ...barH, materials.metal, isNS ? x : face, y + o.h / 2 + f / 2, isNS ? face : z, false);
    box(group, ...barH, materials.metal, isNS ? x : face, y - o.h / 2 - f / 2, isNS ? face : z, false);
    if (isNS) {
      box(group, ...barV, materials.metal, x - o.w / 2 - f / 2, y, face, false);
      box(group, ...barV, materials.metal, x + o.w / 2 + f / 2, y, face, false);
    } else {
      box(group, ...barV, materials.metal, face, y, z - o.w / 2 - f / 2, false);
      box(group, ...barV, materials.metal, face, y, z + o.w / 2 + f / 2, false);
    }
    if (o.kind !== 'door') {
      const sillSize = isNS ? [o.w + 0.30, 0.055, 0.19] : [0.19, 0.055, o.w + 0.30];
      const pSill = isNS ? [x, y - o.h / 2 - 0.11, z + outward * 0.075] : [x + outward * 0.075, y - o.h / 2 - 0.11, z];
      box(group, ...sillSize, materials.trim, ...pSill, false);
    }
    if (tag) {
      const faceName = { N: '北面（進入路側）', S: '南面（畑側）', E: '東面（畑への動線側）', W: '西面' }[o.face];
      tag(glass, {
        title: o.label,
        body: `${faceName}の${o.kind === 'door' ? '建具' : '窓'}。記号${o.id}。位置は立面図読み取りの暫定値で、建具表での確定待ち。`,
        meta: [['記号', o.id], ['寸法', `${o.w}×${o.h}m`], ['窓台', `FL+${o.sill}m`]]
      });
    }
    return glass;
  }
  function segmentAt(B, lx) {
    return B.floor1.find(s => lx >= s.x0 - 1e-6 && lx <= s.x1 + 1e-6) || B.floor1[0];
  }

  // ---- PLAN（設計図表示）----
  function addPlanModel(group, B, m, tag) {
    const L = B.levels;
    B.floor1.forEach((s, i) => {
      const body = mass(group, B, m.planWall, s.x0, s.x1, s.z0, s.z0 + s.depth, 0, L.eaveLow, false);
      tag(body, {
        title: `1階 区間${i + 1}｜${s.use}`,
        body: '1階床面積求積図の区画をそのまま立ち上げたPLAN表示。南面基準（A1〜A3共通）・北面が段状。',
        meta: [['幅', `${(s.x1 - s.x0).toFixed(3)}m`], ['奥行', `${s.depth.toFixed(3)}m`], ['面積', `${s.area}㎡`]]
      });
    });
    const f2 = B.floor2;
    const up = mass(group, B, m.planWall, f2.x0, f2.x1, f2.z0, f2.z0 + f2.depth, L.eaveLow, L.eave2, false);
    tag(up, {
      title: '2階（東棟）',
      body: '2階床面積求積図 A1（6.370×6.370）。建物東端に配置。',
      meta: [['寸法', '6.370 × 6.370m'], ['面積', `${f2.area}㎡`], ['2階軒高', `GL+${L.eave2}m`]]
    });
    slopeRoof(group, B, m.planRoof, f2.x0 - 0.2, f2.x1 + 0.2, -B.eave.main, L.eave2, f2.depth / 2, L.ridge, 0.1);
    slopeRoof(group, B, m.planRoof, f2.x0 - 0.2, f2.x1 + 0.2, f2.depth / 2, L.ridge, f2.depth + B.eave.main, L.eave2, 0.1);
    slopeRoof(group, B, m.planRoof, 0, f2.x0, -B.eave.north, L.eaveLow, B.hirayaEaveSouth, L.eaveHigh, 0.1);
    B.openings.forEach(o => {
      const T = makeXf(B);
      const isNS = o.face === 'N' || o.face === 'S';
      const base = (o.level === 2 ? B.levels.fl2 : B.levels.fl1);
      const y = base + o.sill + o.h / 2;
      if (isNS) {
        const seg = o.level === 2 ? { z0: B.floor2.z0, depth: B.floor2.depth } : segmentAt(B, o.lx);
        const outward = o.face === 'S' ? 1 : -1, lz = o.face === 'S' ? seg.z0 + seg.depth : seg.z0;
        box(group, o.w, o.h, 0.04, o.kind === 'door' ? m.planDoor : m.planOpening,
          T.x(o.lx), y, T.z(lz) + outward * 0.06, false);
      } else {
        const outward = o.face === 'E' ? 1 : -1;
        const lx = o.face === 'E'
          ? B.floor1[B.floor1.length - 1].x1
          : (o.level === 2 ? B.floor2.x0 : B.floor1[0].x0);
        box(group, 0.04, o.h, o.w, o.kind === 'door' ? m.planDoor : m.planOpening,
          T.x(lx) + outward * 0.06, y, T.z(o.lz), false);
      }
    });
  }

  // ---- REAL（実景表示）----
  function addRealModel(group, B, m, tag) {
    const L = B.levels, T = makeXf(B), f2 = B.floor2;

    // 接地影
    B.floor1.forEach(s => mass(group, B, m.shadow, s.x0 + 0.1, s.x1 - 0.1, s.z0 + 0.09, s.z0 + s.depth - 0.09, 0.002, 0.027, false));

    // 基礎（GL→1FL）
    B.floor1.forEach(s => mass(group, B, m.foundation, s.x0, s.x1, s.z0, s.z0 + s.depth, L.gl, L.fl1));
    B.floor1.forEach(s => mass(group, B, m.metal, s.x0, s.x1, s.z0 - 0.01, s.z0 + s.depth + 0.01, L.fl1 - 0.04, L.fl1 + 0.035, false));

    // 1階外壁（天領住宅Ver5）。A4南土間は2階壁より南へ張り出す。
    B.floor1.forEach((s, i) => {
      const twoStory = s.x0 >= f2.x0 - 1e-6;
      const top = twoStory ? L.fl2 : L.eaveLow;
      const south = s.z0 + s.depth;
      const floor2South = f2.z0 + f2.depth;
      let wall;
      if (twoStory && south > floor2South + 1e-6) {
        wall = mass(group, B, m.wall, s.x0, s.x1, s.z0, floor2South, L.fl1, top);
        mass(group, B, m.wall, s.x0, s.x1, floor2South, south, L.fl1, L.fl2);
      } else {
        wall = mass(group, B, m.wall, s.x0, s.x1, s.z0, south, L.fl1, top);
      }
      tag(wall, {
        title: `1階 区間${i + 1}｜${s.use}`,
        body: twoStory ? '2階が乗る東棟の1階部分。' : '平屋部。南面はA1〜A3共通で直線、北面が段状に後退する。',
        meta: [['幅', `${(s.x1 - s.x0).toFixed(3)}m`], ['奥行', `${s.depth.toFixed(3)}m`], ['面積', `${s.area}㎡`]]
      });
    });
    // 平屋部：片流れ屋根（南上がり）＋妻壁。南軒は目隠し壁の先端まで一律に延長する。
    const hiraSegments = B.floor1.filter(s => s.x0 < f2.x0 - 1e-6);
    const yAt = zAbs => L.eaveLow + (zAbs + B.eave.north) * B.pitch.hiraya;
    const screenMaxZ = Math.max(...(B.screenWalls || []).map(wall => wall.z1), 0);
    for (const s of hiraSegments) {
      const zEaveAbs = Math.max(s.z0 + s.depth + B.eave.south, screenMaxZ);
      const yN = yAt(s.z0), yS = yAt(s.z0 + s.depth), yEave = yAt(zEaveAbs);
      const shape = new THREE.Shape();
      shape.moveTo(0, L.eaveLow); shape.lineTo(s.depth, L.eaveLow);
      shape.lineTo(s.depth, yS); shape.lineTo(0, yN); shape.closePath();
      for (const [lx, dir] of [[s.x0, -1], [s.x1, 1]]) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), m.wall);
        mesh.rotation.y = -Math.PI / 2; mesh.position.set(T.x(lx) + dir * 0.002, 0, T.z(s.z0));
        mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      }
      mass(group, B, m.wall, s.x0, s.x1, s.z0, s.z0 + 0.16, L.eaveLow, yN, true);
      const southZ = s.z0 + s.depth;
      mass(group, B, m.wall, s.x0, s.x1, southZ - .16, southZ, L.eaveLow, yS, true);
      const seg = slopeRoof(group, B, m.roof, s.x0 - B.eave.gable, s.x1 + B.eave.gable,
        s.z0 - B.eave.north, yN - (B.eave.north) * B.pitch.hiraya, zEaveAbs, yEave, 0.18);
      tag(seg, {
        title: `平屋部 片流れ屋根（1.5寸）｜${s.use}`,
        body: '畑（南）に向かって上がる片流れ。南軒は目隠し壁先端まで延長する天領住宅Ver5形状。',
        meta: [['勾配', '10:1.5'], ['北軒高', `GL+${yN.toFixed(3)}m`], ['南軒高', `GL+${yEave.toFixed(3)}m`]]
      });
    }

    // 2階ボリューム
    const up = mass(group, B, m.wall, f2.x0, f2.x1, 0, f2.depth, L.fl2, L.eave2);
    tag(up, {
      title: '2階（東棟）',
      body: '2階床面積求積図A1（6.370×6.370）。切妻・3寸勾配、棟は東西方向。',
      meta: [['面積', `${f2.area}㎡`], ['2階軒高', `GL+${L.eave2}m`], ['最高高さ', `GL+${L.ridge}m`]]
    });
    // 2階の妻壁（東西）
    {
      const shape = new THREE.Shape();
      shape.moveTo(0, L.eave2); shape.lineTo(f2.depth, L.eave2);
      shape.lineTo(f2.depth / 2, L.ridge); shape.closePath();
      for (const [lx, dir] of [[f2.x0, -1], [f2.x1, 1]]) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), m.wall);
        mesh.rotation.y = -Math.PI / 2; mesh.position.set(T.x(lx) + dir * 0.002, 0, T.z(0));
        mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      }
    }

    // 屋根：2階部＝3寸切妻（棟は東西）。平屋部の屋根は区画ごとに上のループで生成済み。
    const rn = slopeRoof(group, B, m.roof, f2.x0 - B.eave.gable, f2.x1 + B.eave.gable,
      -B.eave.main, L.eave2, f2.depth / 2, L.ridge, 0.18);
    const rs = slopeRoof(group, B, m.roof, f2.x0 - B.eave.gable, f2.x1 + B.eave.gable,
      f2.depth / 2, L.ridge, f2.depth + B.eave.main, L.eave2, 0.18);
    const info = {
      title: '2階 切妻屋根（3寸）',
      body: '棟-軒差1,123mmを3寸勾配で割ると流れ3,743mm＝半奥行3,185＋軒の出558mmで図面と一致。',
      meta: [['勾配', '10:3'], ['最高軒高', `GL+${L.eave2}m`], ['最高高さ', `GL+${L.ridge}m`]]
    };
    tag(rn, info); tag(rs, info);
    // 棟包み
    mass(group, B, m.metal, f2.x0 - B.eave.gable, f2.x1 + B.eave.gable,
      f2.depth / 2 - 0.11, f2.depth / 2 + 0.11, L.ridge - 0.09, L.ridge + 0.07, false);

    // 南東の下屋（南土間 = 畑への動線）。南立面図実測値へ合わせる。
    const doma = B.floor1[B.floor1.length - 1];
    slopeRoof(group, B, m.roof, doma.x0 - B.eave.gable, doma.x1 + B.eave.gable,
      f2.depth, 3.78, doma.depth + B.eave.south, 3.50, 0.16);

    // 東面の壁上端と下屋下面の隙間を外壁で塞ぐ。
    {
      const zLength = doma.z0 + doma.depth - f2.depth;
      const roofSlope = (3.50 - 3.78) / (B.eave.south + zLength);
      const roofY = zAbs => 3.78 + roofSlope * (zAbs - f2.depth);
      const shape = new THREE.Shape();
      shape.moveTo(0, L.fl2); shape.lineTo(zLength, L.fl2);
      shape.lineTo(zLength, roofY(f2.depth + zLength)); shape.lineTo(0, roofY(f2.depth)); shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), m.wall);
      mesh.rotation.y = -Math.PI / 2;
      mesh.position.set(T.x(doma.x1) + .002, 0, T.z(f2.depth));
      mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }

    // 東面ルーバー戸上の庇。
    mass(group, B, m.roof, doma.x1 - .05, doma.x1 + .65, 7 - .675, 7 + .675, L.fl1 + 2.55, L.fl1 + 2.67, false);

    // 雨樋：平屋部は北側の低い軒先、2階部は南北軒に設置。
    for (const s of hiraSegments) {
      const northEdge = s.z0 - B.eave.north;
      cylinder(group, 0.075, s.x1 - s.x0 + .3, m.gutter, T.cx(s.x0, s.x1), yAt(northEdge) - .12, T.z(northEdge), 8, true);
    }
    cylinder(group, 0.075, f2.x1 - f2.x0 + 0.3, m.gutter, T.cx(f2.x0, f2.x1), L.eave2 - 0.12, T.z(-B.eave.main), 8, true);
    cylinder(group, 0.075, f2.x1 - f2.x0 + 0.3, m.gutter, T.cx(f2.x0, f2.x1), L.eave2 - 0.12, T.z(f2.depth + B.eave.main), 8, true);
    // 北面の平屋部に道南杉サイディングを重ねる（x=0〜11.40）。
    B.floor1.forEach(s => {
      if (s.x0 >= B.sugiSiding.xMax - 1e-6) return;
      const x1 = Math.min(s.x1, B.sugiSiding.xMax);
      mass(group, B, m.sugi, s.x0 - .012, x1 + .012, s.z0 - .055, s.z0 + .005, L.fl1, yAt(s.z0));
    });

    // 袖壁（自宅玄関・民泊玄関）。
    (B.sodekabe || []).forEach(s => {
      const centerZ = s.faceZ - s.offset;
      const material = s.mat === 'sugi' ? m.sugi : m.wall;
      const wall = mass(group, B, material, s.lx0, s.lx1, centerZ - 0.09, centerZ + 0.09, L.gl, s.top);
      mass(group, B, m.metal, s.lx0 - 0.03, s.lx1 + 0.03, centerZ - 0.13, centerZ + 0.13, s.top, s.top + 0.05, false);
      tag(wall, {
        title: `${s.note} 袖壁`,
        body: '天領住宅Ver5の北立面図から実測した玄関脇の目隠し壁。',
        meta: [['幅', `${(s.lx1 - s.lx0).toFixed(2)}m`], ['天端', `GL+${s.top.toFixed(2)}m`]]
      });
    });

    // 目隠し壁は単色壁材で色差を補正し、上端を片流れ屋根下面へ追従させる。
    (B.screenWalls || []).forEach(s => {
      const wall = mass(group, B, m.wallFlat, s.x0, s.x1, s.z0, s.z1, L.gl, yAt(s.faceZ), false);
      tag(wall, {
        title: `${s.note} 目隠し壁`,
        body: '天領住宅Ver5の立面図から実測した建物角部の目隠し壁。',
        meta: [['奥行', `${(s.z1 - s.z0).toFixed(2)}m`], ['厚さ', `${(s.x1 - s.x0).toFixed(2)}m`]]
      });
    });

    // 開口部は壁・サイディングより手前へ配置する。
    B.openings.forEach(o => addOpening(group, B, o, m, tag));

    // 玄関まわり（北面）。ポーチの北面基準は該当区画のz0（北面は区画ごとに段差があるため）。
    const porchX = B.doorX - B.origin.x;
    const porchSeg = segmentAt(B, porchX);
    const pz0 = porchSeg.z0;
    mass(group, B, m.foundation, porchX - 0.78, porchX + 0.78, pz0 - 0.95, pz0, L.gl, L.fl1 - 0.14, false);
    mass(group, B, m.roof, porchX - 0.95, porchX + 0.95, pz0 - 1.05, pz0 + 0.05, L.fl1 + 2.55, L.fl1 + 2.67, false);

    // 民泊玄関アプローチ階段。
    const guestSleeve = B.sodekabe[1], guestSegment = B.floor1[0];
    mass(group, B, m.foundation, guestSleeve.lx0, guestSleeve.lx1, guestSegment.z0 - .95, guestSegment.z0, L.gl, L.fl1 - .14, false);

    // A3〜A4の玄関アプローチ庇と2本の支柱。
    const ax0 = B.floor1[2].x0, ax1 = B.floor1[3].x1, az0 = B.floor1[2].z0;
    const canopyY0 = L.fl1 + 2.40, canopyY1 = L.fl1 + 2.52;
    mass(group, B, m.roof, ax0, ax1, az0 - 1.05, az0 + .05, canopyY0, canopyY1, false);
    [ax0 + .30, ax1 - .30].forEach(lx => {
      const postHeight = canopyY0 - L.gl;
      const post = new THREE.Mesh(new THREE.BoxGeometry(.12, postHeight, .12), m.trim);
      post.position.set(T.x(lx), L.gl + postHeight / 2, T.z(az0 - .93));
      post.castShadow = true; post.receiveShadow = true; group.add(post);
    });
  }

  global.createBuildingModel = function createBuildingModel(options) {
    const group = new THREE.Group();
    const B = options.data;
    if (options.mode === 'plan') addPlanModel(group, B, options.materials, options.tag);
    else addRealModel(group, B, options.materials, options.tag);
    options.tag(group, {
      title: '住宅＋民泊 建物（天領住宅Ver5）',
      body: '1階は北面基準の4区間・階段状。東端6.370m角が2階建、西側12.740mが平屋。',
      meta: [
        ['建築面積', `${B.areas.kenchiku}㎡`],
        ['1階/2階', `${B.areas.floor1}㎡ / ${B.areas.floor2}㎡`],
        ['延床', `${B.areas.nobeyuka}㎡`],
        ['最高高さ', `GL+${B.levels.ridge}m`]
      ]
    });
    return group;
  };
})(window);
