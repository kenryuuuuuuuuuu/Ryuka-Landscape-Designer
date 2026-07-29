// 固定データを変更する場合は、測量・設計資料などの根拠を記録すること。
(function exposeFixedSiteData(global) {
  'use strict';

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  global.DATA = deepFreeze({
    site: [
      { n: 'A', x: -19.906, z: 5.284 }, { n: 'B', x: -13.730, z: -14.345 },
      { n: 'C', x: 19.636, z: -14.127 }, { n: 'D', x: 21.559, z: 5.755 },
      { n: 'E', x: -7.559, z: 17.433 }
    ],
    edgeLengths: [20.579, 33.366, 19.974, 31.374, 17.322],
    building: {
      // === 外接直方体（衝突判定・環境モデル・互換用）===
      cx: 2.209, cz: -9.2215, w: 19.110, d: 7.735,
      wallH: 6.300, ridgeH: 7.423,

      // === 天領住宅 Ver5 実施図面（2026年7月）に基づく正式形状 ===
      // 建物北西角のワールド座標。北面は19.110m全長にわたり直線。
      origin: { x: -7.346, z: -13.089 },
      // 高さは全てGL基準(m)。基礎高0.500 / 1階軒高2.900 / 2階軒高2.900 / 棟+1.123
      levels: { gl: 0, fl1: 0.500, fl2: 3.232, eaveLow: 3.400, eaveHigh: 4.567, eave2: 6.300, ridge: 7.423 },
      pitch: { hiraya: 0.15, main: 0.30 },
      eave: { north: 0.500, south: 0.500, gable: 0.220, main: 0.558 },

      // 1階外壁footprint（北面基準・西→東）: 1階床面積求積図 A1〜A4
      floor1: [
        { x0: 0.000,  x1: 9.100,  depth: 5.460, area: 49.686, use: '民泊棟（玄関・洋室・LDK15.73・水回り）' },
        { x0: 9.100,  x1: 12.740, depth: 5.915, area: 21.531, use: 'ヌック・自宅玄関・北土間' },
        { x0: 12.740, x1: 16.380, depth: 6.370, area: 23.187, use: '自宅LDK32.09・階段' },
        { x0: 16.380, x1: 19.110, depth: 7.735, area: 21.117, use: '水回り・南土間（畑動線）' }
      ],
      // 2階: 2階床面積求積図 A1 (6.370 × 6.370) を東端に配置
      floor2: { x0: 12.740, x1: 19.110, depth: 6.370, area: 40.577 },
      // 平屋部の南に張り出す屋根の軒先ライン（建築面積求積図から逆算）
      hirayaEaveSouth: 7.280,

      areas: { kenchiku: 139.08, floor1: 115.51, floor2: 40.57, nobeyuka: 156.08, roofedNonFloor: 23.57 },
      appliedSiteArea: 319.67,

      // 開口部（lx=建物西端からの局所座標、sillは1FL基準）
      // ※位置は平面図の建具記号からの読み取り。寸法は呼称からの推定で、建具表での確定待ち。
      openings: [
        { face: 'N', lx: 1.820, w: 0.90, h: 2.30, sill: 0,     kind: 'door',   id: 'AD0923',  label: '民泊 玄関' },
        { face: 'N', lx: 5.000, w: 1.65, h: 0.90, sill: 1.100, kind: 'window', id: 'AW16509', label: '民泊 北窓' },
        { face: 'N', lx: 10.000, w: 0.90, h: 2.30, sill: 0,    kind: 'door',   id: 'AD0923',  label: '自宅 玄関' },
        { face: 'N', lx: 11.400, w: 0.69, h: 0.90, sill: 1.100, kind: 'window', id: 'AW06903', label: '北土間 窓' },
        { face: 'S', lx: 2.000, w: 0.65, h: 2.00, sill: 0.050, kind: 'window', id: 'AW06520', label: '民泊 縦すべり' },
        { face: 'S', lx: 4.550, w: 2.25, h: 0.90, sill: 0.900, kind: 'window', id: 'AW22509', label: '民泊リビング 腰窓（畑向き）' },
        { face: 'S', lx: 8.500, w: 1.60, h: 2.20, sill: 0.050, kind: 'window', id: 'AW16022', label: '掃き出し窓' },
        { face: 'S', lx: 13.500, w: 1.60, h: 2.20, sill: 0.050, kind: 'window', id: 'AW16022', label: '自宅LDK 掃き出し' },
        { face: 'S', lx: 17.800, w: 0.60, h: 0.90, sill: 1.100, kind: 'window', id: 'AW06009', label: '南土間 窓' },
        { face: 'N', lx: 14.300, w: 1.60, h: 0.90, sill: 1.100, level: 2, kind: 'window', id: 'AW16009', label: '2階 北窓' },
        { face: 'N', lx: 17.400, w: 1.60, h: 0.90, sill: 1.100, level: 2, kind: 'window', id: 'AW16009', label: '2階 北窓' },
        { face: 'S', lx: 15.000, w: 1.60, h: 0.90, sill: 1.100, level: 2, kind: 'window', id: 'AW16009', label: '2階 洋室13.25 南窓' },
        { face: 'S', lx: 18.000, w: 1.60, h: 0.90, sill: 1.100, level: 2, kind: 'window', id: 'AW16009', label: '2階 洋室 南窓' },
        // 東面（東側立面図より）。土間から畑へ出るドアと、2階洋室の東窓。
        // lzは北端からの奥行き局所座標。位置・寸法は立面図読み取りの暫定値、建具表未確定。
        { face: 'E', lz: 6.200, w: 0.90, h: 2.00, sill: 0,     level: 1, kind: 'door',   id: '未確定', label: '南土間 東ドア（畑への動線）' },
        { face: 'E', lz: 2.200, w: 0.60, h: 0.90, sill: 1.100, level: 1, kind: 'window', id: '未確定', label: '1階 東窓（洗面まわり）' },
        { face: 'E', lz: 2.000, w: 1.60, h: 0.90, sill: 1.100, level: 2, kind: 'window', id: 'AW16009', label: '2階 洋室7.45 東窓' },
        { face: 'E', lz: 4.500, w: 1.60, h: 0.90, sill: 1.100, level: 2, kind: 'window', id: 'AW16009', label: '2階 洋室7.45 東窓' }
      ],
      doorX: 2.654,
    },
    siteArea: 988.87,
    takuchiArea: 319,
    lat: 33.32,
    lon: 130.94,
    paths: [
      [{ x: 19.5, z: -3.8 }, { x: 19.5, z: -1.8 }, { x: -16, z: -1.8 }, { x: -16, z: -3.8 }],
      [{ x: 15, z: -5.1 }, { x: 19.5, z: -5.1 }, { x: 19.5, z: -3.8 }, { x: 15, z: -3.8 }],
      [{ x: -0.2, z: -1.8 }, { x: 1.4, z: -1.8 }, { x: 1.4, z: 10.4 }, { x: -0.2, z: 10.4 }],
      [{ x: -6.2, z: 10.4 }, { x: 1.4, z: 10.4 }, { x: 1.4, z: 12 }, { x: -6.2, z: 12 }]
    ],
    rotations: [
      { name: '輪作A', cx: 4.9, cz: 1.6, w: 6, d: 5 }, { name: '輪作B', cx: 11.2, cz: 1.6, w: 6, d: 5 },
      { name: '輪作C', cx: 4.7, cz: 7.2, w: 6, d: 5 }, { name: '輪作D', cx: 10.5, cz: 6.7, w: 4.4, d: 4 }
    ],
    trees: [
      { x: -16.6, z: -1.8, r: 1.3, h: 1.6, name: 'ウメ' }, { x: -17.7, z: 2.6, r: 1.2, h: 1.5, name: 'イチジク' },
      { x: -6.5, z: 6.2, r: .75, h: 0, name: 'ブルーベリー', bush: true }, { x: -3.8, z: 6.4, r: .75, h: 0, name: 'ブルーベリー', bush: true },
      { x: 15.8, z: 1.5, r: 1.1, h: 1.4, name: 'ユズ' }, { x: 17.9, z: 2.9, r: .9, h: 1.2, name: 'キンカン' },
      { x: 19.6, z: 4.3, r: 1.2, h: 1.5, name: '甘夏' }, { x: -9, z: 15, r: 1.4, h: 1.7, name: 'カキ' },
      { x: -9.5, z: 11.5, r: 1, h: 1.4, name: 'ジューンベリー' }, { x: -10.5, z: 8.2, r: 1.1, h: 1.6, name: 'ヤマボウシ' }
    ],
    facilities: {
      yard: [{ x: 14.5, z: -4.5 }, { x: 20, z: -4.5 }, { x: 20.4, z: .5 }, { x: 14.5, z: .5 }],
      shed: { x: 17, z: -2.4 }, shedDoor: { x: 17, z: -1.02 }, storage: [{ x: 14.4, z: -.2 }, { x: 15.5, z: -.2 }],
      well: { x: 3, z: -.9 }, pump: { x: 3, z: .1 }, basin: { x: 4, z: .1 }
    },
    guestGarden: {
      beds: [{ x: -6.2, z: .8 }, { x: -2.8, z: .8 }, { x: -6.2, z: 3.8 }, { x: -2.8, z: 3.8 }],
      bench: { x: -9.2, z: 2.3 }, benchLegs: [{ x: -9.8, z: 2.3 }, { x: -8.6, z: 2.3 }]
    },
    herbs: {
      ground: [{ x: -17.2, z: 0 }, { x: -11, z: 0 }, { x: -11, z: 6.5 }, { x: -16.5, z: 6.5 }],
      beds: [{ x: -13.5, z: 1 }, { x: -13.5, z: 3.2 }, { x: -13.5, z: 5.4 }],
      clusters: [{ x: -11.8, z: .5 }, { x: -11.8, z: 2.7 }, { x: -11.8, z: 4.9 }], accent: { x: -15.7, z: 0 }
    },
    lawn: {
      west: [{ x: -10, z: 8.8 }, { x: 0, z: 10.3 }, { x: 0, z: 12 }, { x: -9, z: 11.5 }],
      east: [{ x: 3, z: 9.5 }, { x: 9, z: 9.7 }, { x: 4.6, z: 11.7 }],
      pergola: { x: -6.5, z: 13.4, diameter: 4.4 }
    },
    labels: [
      ['作業ヤード', 17, -4.2, 2.0], ['浅井戸・洗い場', 3, -2.8, 1.8], ['ゲスト収穫ガーデン', -4.5, 2.4, 2.1],
      ['ハーブの帯', -13.8, 3.2, 1.9], ['輪作A', 4.9, 1.6, 1.6], ['輪作B', 11.2, 1.6, 1.6],
      ['輪作C', 4.7, 7.2, 1.6], ['輪作D', 10.5, 6.7, 1.6], ['柑橘の東列', 17.5, 3.2, 1.8],
      ['クローバー広場', -4.5, 9.8, 1.9], ['パーゴラテラス', -6.5, 13.4, 1.9], ['民泊リビング腰窓', -4, -6.2, 1.8]
    ]
  });
})(window);
