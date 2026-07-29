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
      // 2階の壁は floor2.depth（6.370m）で一定。1階floor1区画は南面が段状で
      // depthが区画ごとに異なる（南土間側は7.735m）ため、階を混同すると
      // 2階窓が実際の壁面より外側（南）へ飛び出す。必ず該当階のdepthを使う。
      const depth = o.level === 2 ? B.floor2.depth : segmentAt(B, o.lx).depth;
      outward = o.face === 'S' ? 1 : -1;
      const lz = o.face === 'S' ? depth : 0;
      x = T.x(o.lx); z = T.z(lz) + outward * 0.09;
    } else {
      // 東西面: 東端=segment4(x=19.110)、西端=segment1(x=0)。lzは北端からの奥行き。
      outward = o.face === 'E' ? 1 : -1;
      const lx = o.face === 'E' ? B.floor1[B.floor1.length - 1].x1 : 0;
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
      const body = mass(group, B, m.planWall, s.x0, s.x1, 0, s.depth, 0, L.eaveLow, false);
      tag(body, {
        title: `1階 区間${i + 1}｜${s.use}`,
        body: '1階床面積求積図の区画をそのまま立ち上げたPLAN表示。北面基準・南面が段状。',
        meta: [['幅', `${(s.x1 - s.x0).toFixed(3)}m`], ['奥行', `${s.depth.toFixed(3)}m`], ['面積', `${s.area}㎡`]]
      });
    });
    const f2 = B.floor2;
    const up = mass(group, B, m.planWall, f2.x0, f2.x1, 0, f2.depth, L.eaveLow, L.eave2, false);
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
        const depth = o.level === 2 ? B.floor2.depth : segmentAt(B, o.lx).depth;
        const outward = o.face === 'S' ? 1 : -1, lz = o.face === 'S' ? depth : 0;
        box(group, o.w, o.h, 0.04, o.kind === 'door' ? m.planDoor : m.planOpening,
          T.x(o.lx), y, T.z(lz) + outward * 0.06, false);
      } else {
        const outward = o.face === 'E' ? 1 : -1;
        const lx = o.face === 'E' ? B.floor1[B.floor1.length - 1].x1 : 0;
        box(group, 0.04, o.h, o.w, o.kind === 'door' ? m.planDoor : m.planOpening,
          T.x(lx) + outward * 0.06, y, T.z(o.lz), false);
      }
    });
  }

  // ---- REAL（実景表示）----
  function addRealModel(group, B, m, tag) {
    const L = B.levels, T = makeXf(B), f2 = B.floor2;

    // 接地影
    B.floor1.forEach(s => mass(group, B, m.shadow, s.x0 + 0.1, s.x1 - 0.1, 0.09, s.depth - 0.09, 0.002, 0.027, false));

    // 基礎（GL→1FL）
    B.floor1.forEach(s => mass(group, B, m.foundation, s.x0, s.x1, 0, s.depth, L.gl, L.fl1));
    B.floor1.forEach(s => mass(group, B, m.metal, s.x0, s.x1, -0.01, s.depth + 0.01, L.fl1 - 0.04, L.fl1 + 0.035, false));

    // 1階壁（平屋部は片流れのため南高・北低、2階部の下は2階軒高まで別途）
    B.floor1.forEach((s, i) => {
      const twoStory = s.x0 >= f2.x0 - 1e-6;
      const top = twoStory ? L.fl2 : L.eaveLow;
      const wall = mass(group, B, m.wall, s.x0, s.x1, 0, s.depth, L.fl1, top);
      tag(wall, {
        title: `1階 区間${i + 1}｜${s.use}`,
        body: twoStory ? '2階が乗る東棟の1階部分。' : '平屋部。北面は直線、南面が段状に深くなる。',
        meta: [['幅', `${(s.x1 - s.x0).toFixed(3)}m`], ['奥行', `${s.depth.toFixed(3)}m`], ['面積', `${s.area}㎡`]]
      });
    });
    // 平屋部の妻壁＋片流れ屋根（区画ごと）。
    // 単一平面で全区画を南7.280mまで一律に延ばすと、奥行きの浅い区画（segment1: 5.460m）で
    // 1.8m超の不自然なカンチレバーになるため、各区画は「自分の壁＋控えめな軒の出0.5m」で止める。
    // 勾配の式(y)は区画をまたいで共通なので、屋根の傾き自体は連続している。
    const hiraSegments = B.floor1.filter(s => s.x0 < f2.x0 - 1e-6);
    const y = lz => L.eaveLow + (lz + B.eave.north) * B.pitch.hiraya;
    for (const s of hiraSegments) {
      const zEave = s.depth + B.eave.south;
      const yN = y(0), yS = y(s.depth), yEave = y(zEave);
      const shape = new THREE.Shape();
      shape.moveTo(0, L.eaveLow); shape.lineTo(s.depth, L.eaveLow);
      shape.lineTo(s.depth, yS); shape.lineTo(0, yN); shape.closePath();
      for (const [lx, dir] of [[s.x0, -1], [s.x1, 1]]) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), m.wall);
        mesh.rotation.y = -Math.PI / 2; mesh.position.set(T.x(lx) + dir * 0.002, 0, T.z(0));
        mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      }
      mass(group, B, m.wall, s.x0, s.x1, 0, 0.16, L.eaveLow, yN, true);
      const seg = slopeRoof(group, B, m.roof, s.x0 - B.eave.gable, s.x1 + B.eave.gable,
        -B.eave.north, L.eaveLow, zEave, yEave, 0.18);
      tag(seg, {
        title: `平屋部 片流れ屋根（1.5寸）｜${s.use}`,
        body: '畑（南）に向かって上がる片流れ。区画ごとに壁＋軒の出0.5mで止め、奥の区画ほど深く張り出す段状の軒先になる。',
        meta: [['勾配', '10:1.5'], ['北軒高', `GL+${L.eaveLow}m`], ['南軒高', `GL+${yEave.toFixed(3)}m`]]
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

    // 南東の下屋（南土間 = 畑からの動線）。2階の南面(z=f2.depth)から、
    // 2階に覆われない南側の張り出し部分（doma.depth+南軒 まで）を覆う小庇。
    const doma = B.floor1[B.floor1.length - 1];
    const domaRun = doma.depth + B.eave.south - f2.depth;
    // 南軒の屋根下面が直下の1階ボリューム上端（FL2）へ接する高さまで下げる。
    // 北側は片流れ勾配分だけ高くし、2階南壁へ自然に取り付ける。
    const domaEndY = L.fl2 + 0.08;
    const domaStartY = domaEndY + domaRun * B.pitch.hiraya;
    slopeRoof(group, B, m.roof, doma.x0 - B.eave.gable, doma.x1 + B.eave.gable,
      f2.depth, domaStartY, doma.depth + B.eave.south, domaEndY, 0.14);

    // 雨樋：平屋部は区画ごとの軒先に沿って設置、2階部は南北軒に設置
    for (const s of hiraSegments) {
      const zEave = s.depth + B.eave.south, yEave = y(zEave);
      cylinder(group, 0.075, s.x1 - s.x0 + 0.3, m.gutter, T.cx(s.x0, s.x1), yEave - 0.12, T.z(zEave), 8, true);
    }
    cylinder(group, 0.075, f2.x1 - f2.x0 + 0.3, m.gutter, T.cx(f2.x0, f2.x1), L.eave2 - 0.12, T.z(-B.eave.main), 8, true);
    cylinder(group, 0.075, f2.x1 - f2.x0 + 0.3, m.gutter, T.cx(f2.x0, f2.x1), L.eave2 - 0.12, T.z(f2.depth + B.eave.main), 8, true);
    // 縦樋（竪樋）：平屋各区画の南東角のみ。2階北面は図面に竪樋の記載がないため設置しない。
    hiraSegments.forEach(s => {
      const zEave = s.depth + B.eave.south, yEave = y(zEave);
      cylinder(group, 0.055, yEave - 0.5, m.gutter, T.x(s.x1 - 0.25), (yEave - 0.5) / 2 + 0.4, T.z(zEave), 8);
    });

    // 開口部
    B.openings.forEach(o => addOpening(group, B, o, m, tag));

    // 玄関まわり（北面）
    const porchX = B.doorX - B.origin.x;
    mass(group, B, m.foundation, porchX - 0.78, porchX + 0.78, -0.95, 0, L.gl, L.fl1 - 0.14, false);
    mass(group, B, m.roof, porchX - 0.95, porchX + 0.95, -1.05, 0.05, L.fl1 + 2.55, L.fl1 + 2.67, false);
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
