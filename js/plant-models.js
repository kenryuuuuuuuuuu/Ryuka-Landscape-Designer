(function exposePlantModels(global) {
  'use strict';

  const LEAF_GEOMETRIES = Object.freeze({
    deciduousLeafCluster: new THREE.SphereGeometry(1, 8, 5),
    citrusLeafCluster: new THREE.DodecahedronGeometry(1, 0),
    figLeafCluster: new THREE.SphereGeometry(1, 7, 3),
    blueberryLeafCluster: new THREE.TetrahedronGeometry(1, 0),
    layeredLeafCluster: new THREE.CylinderGeometry(1, 1, 0.22, 8, 1)
  });

  const DETAIL_GEOMETRIES = Object.freeze({
    fruit: new THREE.SphereGeometry(1, 6, 5),
    petal: new THREE.CircleGeometry(1, 5),
    bract: new THREE.PlaneGeometry(1, 1),
    flowerCore: new THREE.SphereGeometry(1, 5, 4),
    blueberryBell: new THREE.ConeGeometry(0.55, 1, 6, 1, true)
  });

  global.PLANT_GEOMETRIES = Object.freeze({ ...LEAF_GEOMETRIES, ...DETAIL_GEOMETRIES });

  const PROFILES = {
    'ウメ': { evergreen: false, stems: 1, branches: 6, leaves: 18, wide: 1.35, flat: 0.72, leaf: 'deciduous', geometry: 'deciduousLeafCluster', flower: 'ume' },
    'イチジク': { evergreen: false, stems: 3, branches: 4, leaves: 16, wide: 1.4, flat: 0.68, leaf: 'fig', geometry: 'figLeafCluster' },
    'ブルーベリー': { evergreen: false, stems: 7, branches: 3, leaves: 27, wide: 0.95, flat: 0.88, leaf: 'blueberry', geometry: 'blueberryLeafCluster', flower: 'blueberry' },
    'ユズ': { evergreen: true, stems: 1, branches: 5, leaves: 28, wide: 1.02, flat: 0.95, leaf: 'citrus', geometry: 'citrusLeafCluster' },
    'キンカン': { evergreen: true, stems: 1, branches: 4, leaves: 32, wide: 0.68, flat: 1.28, leaf: 'citrus', geometry: 'citrusLeafCluster' },
    '甘夏': { evergreen: true, stems: 1, branches: 6, leaves: 36, wide: 1.28, flat: 1.04, leaf: 'citrus', geometry: 'citrusLeafCluster' },
    'カキ': { evergreen: false, stems: 1, branches: 6, leaves: 20, wide: 1.25, flat: 0.83, leaf: 'deciduous', geometry: 'deciduousLeafCluster', openCrown: true },
    'ジューンベリー': { evergreen: false, stems: 4, branches: 4, leaves: 20, wide: 0.8, flat: 1.22, leaf: 'deciduous', geometry: 'deciduousLeafCluster', flower: 'juneberry' },
    'ヤマボウシ': { evergreen: false, stems: 1, branches: 6, leaves: 24, wide: 1.32, flat: 0.46, leaf: 'deciduous', geometry: 'layeredLeafCluster', flower: 'yamaboushi', layered: true }
  };

  const FRUIT_PROFILES = {
    'イチジク': { seasons: ['summer', 'autumn'], material: 'fruitPurple', countBase: 4, countGrowth: 0.35, size: 0.08, placement: 'branchNear', clusterSize: 1, verticalOffset: -0.08 },
    'ブルーベリー': { seasons: ['summer'], material: 'fruitBlue', countBase: 3, countGrowth: 0.24, size: 0.035, placement: 'cluster', clusterSize: 4, verticalOffset: -0.04 },
    'ユズ': { seasons: ['autumn', 'winter'], material: 'fruitYellow', countBase: 5, countGrowth: 0.38, size: 0.095, placement: 'irregular', clusterSize: 1, verticalOffset: -0.08 },
    'キンカン': { seasons: ['autumn', 'winter'], material: 'fruitOrange', countBase: 9, countGrowth: 0.65, size: 0.052, placement: 'outer', clusterSize: 1, verticalOffset: -0.04 },
    '甘夏': { seasons: ['summer', 'autumn'], material: 'fruitOrange', countBase: 3, countGrowth: 0.18, size: 0.14, placement: 'inner', clusterSize: 1, verticalOffset: -0.12 },
    'カキ': { seasons: ['autumn', 'winter'], material: 'fruitOrange', countBase: 4, countGrowth: 0.28, size: 0.105, placement: 'tip', clusterSize: 2, verticalOffset: -0.1 },
    'ジューンベリー': { seasons: ['summer'], material: 'fruitRed', countBase: 3, countGrowth: 0.2, size: 0.032, placement: 'cluster', clusterSize: 4, verticalOffset: -0.04 },
    'ヤマボウシ': { seasons: ['autumn'], material: 'fruitRed', countBase: 3, countGrowth: 0.16, size: 0.065, placement: 'outer', clusterSize: 1, verticalOffset: -0.05 }
  };

  function seeded(seed) {
    let value = seed >>> 0;
    return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function addBranch(group, start, end, radius, material) {
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.55, radius, direction.length(), 6),
      material
    );
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.castShadow = true;
    group.add(mesh);
  }

  function seasonalLeafMaterial(name, profile, state, materials) {
    if (profile.evergreen) return state.season === 'spring' ? materials.springCitrus : materials.citrus;
    if (state.season === 'spring') {
      if (name === 'イチジク') return materials.springFig;
      if (name === 'ブルーベリー') return materials.springBlueberry;
      return materials.springDeciduous;
    }
    if (state.season === 'autumn') {
      if (name === 'ブルーベリー' || name === 'ヤマボウシ') return materials.autumnRed;
      if (name === 'ジューンベリー') return materials.autumnOrange;
      if (name === 'カキ') return materials.autumnOrange;
      if (name === 'ウメ') return materials.autumnGold;
      return materials.autumnBrown;
    }
    if (state.season === 'winter') return name === 'ブルーベリー' ? materials.winterBlueberry : materials.winterDryLeaf;
    return materials[profile.leaf];
  }

  function leafScale(name, crown, random) {
    const jitter = 0.82 + random() * 0.36;
    if (name === 'イチジク') return new THREE.Vector3(0.95, 0.22, 0.72).multiplyScalar(crown * jitter);
    if (name === 'ブルーベリー') return new THREE.Vector3(0.23, 0.32, 0.2).multiplyScalar(crown * jitter);
    if (['ユズ', 'キンカン', '甘夏'].includes(name)) return new THREE.Vector3(0.32, 0.38, 0.3).multiplyScalar(crown * jitter);
    if (name === 'ヤマボウシ') return new THREE.Vector3(0.72, 0.3, 0.58).multiplyScalar(crown * jitter);
    return new THREE.Vector3(0.52, 0.32, 0.44).multiplyScalar(crown * jitter);
  }

  function addUmeFlower(group, position, materials, rotation) {
    const flower = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      const petal = new THREE.Mesh(DETAIL_GEOMETRIES.petal, materials.flowerPink);
      const angle = i * Math.PI * 2 / 5;
      petal.position.set(Math.cos(angle) * 0.055, Math.sin(angle) * 0.055, 0);
      petal.scale.set(0.055, 0.075, 1);
      flower.add(petal);
    }
    flower.rotation.set(rotation * 0.15, rotation, 0);
    flower.position.copy(position);
    group.add(flower);
  }

  function addYamaboushiFlower(group, position, materials, rotation) {
    const flower = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const bract = new THREE.Mesh(DETAIL_GEOMETRIES.bract, materials.flowerWhite);
      const angle = i * Math.PI / 2;
      bract.position.set(Math.cos(angle) * 0.08, 0, Math.sin(angle) * 0.08);
      bract.rotation.x = -Math.PI / 2;
      bract.rotation.z = angle;
      bract.scale.set(0.13, 0.07, 1);
      flower.add(bract);
    }
    const core = new THREE.Mesh(DETAIL_GEOMETRIES.flowerCore, materials.flowerCore);
    core.scale.setScalar(0.035);
    flower.add(core);
    flower.rotation.y = rotation;
    flower.position.copy(position);
    group.add(flower);
  }

  function addBlueberryFlower(group, position, materials, rotation) {
    const cluster = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const bell = new THREE.Mesh(DETAIL_GEOMETRIES.blueberryBell, materials.flowerWhite);
      bell.position.set((i - 1) * 0.035, -i * 0.025, 0);
      bell.rotation.z = Math.PI;
      bell.scale.setScalar(0.055);
      cluster.add(bell);
    }
    cluster.rotation.y = rotation;
    cluster.position.copy(position);
    group.add(cluster);
  }

  function addJuneberryFlower(group, position, materials, rotation) {
    const cluster = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const flower = new THREE.Mesh(DETAIL_GEOMETRIES.petal, materials.flowerWhite);
      flower.position.set((i - 1) * 0.055, (i % 2) * 0.04, 0);
      flower.scale.setScalar(0.055);
      cluster.add(flower);
    }
    cluster.rotation.set(rotation * 0.1, rotation, 0);
    cluster.position.copy(position);
    group.add(cluster);
  }

  function addFlowers(group, profile, tips, state, materials, random) {
    if (!state.showFlowers || state.season !== 'spring' || !profile.flower) return;
    const count = Math.min(16, 6 + Math.round(state.growthYear * 0.7));
    for (let i = 0; i < count; i += 1) {
      const position = tips[i % tips.length].clone().multiplyScalar(profile.flower === 'ume' ? 0.82 : 1);
      position.add(new THREE.Vector3((random() - 0.5) * 0.14, (random() - 0.5) * 0.1, (random() - 0.5) * 0.14));
      const rotation = random() * Math.PI * 2;
      if (profile.flower === 'ume') addUmeFlower(group, position, materials, rotation);
      if (profile.flower === 'yamaboushi') addYamaboushiFlower(group, position, materials, rotation);
      if (profile.flower === 'blueberry') addBlueberryFlower(group, position, materials, rotation);
      if (profile.flower === 'juneberry') addJuneberryFlower(group, position, materials, rotation);
    }
  }

  function fruitAnchor(config, tip, crown, random) {
    const point = tip.clone();
    if (config.placement === 'branchNear') point.multiplyScalar(0.52 + random() * 0.16);
    if (config.placement === 'inner') point.multiplyScalar(0.62 + random() * 0.12);
    if (config.placement === 'outer') point.multiplyScalar(1.02 + random() * 0.1);
    if (config.placement === 'irregular') point.multiplyScalar(0.7 + random() * 0.32);
    if (config.placement === 'cluster') point.multiplyScalar(0.86 + random() * 0.12);
    point.add(new THREE.Vector3((random() - 0.5) * crown * 0.12, config.verticalOffset, (random() - 0.5) * crown * 0.12));
    return point;
  }

  function addFruits(group, name, tips, crown, state, materials, random) {
    const config = FRUIT_PROFILES[name];
    if (!state.showFruit || !config || !config.seasons.includes(state.season)) return;
    const clusters = Math.min(16, Math.round(config.countBase + state.growthYear * config.countGrowth));
    for (let i = 0; i < clusters; i += 1) {
      const anchor = fruitAnchor(config, tips[i % tips.length], crown, random);
      for (let j = 0; j < config.clusterSize; j += 1) {
        const fruit = new THREE.Mesh(DETAIL_GEOMETRIES.fruit, materials[config.material]);
        const spread = config.size * 1.45;
        fruit.position.copy(anchor).add(new THREE.Vector3((j % 2 - 0.5) * spread, -Math.floor(j / 2) * spread, (random() - 0.5) * spread));
        fruit.scale.setScalar(config.size);
        group.add(fruit);
      }
    }
  }

  function createBranchTips(group, name, profile, baseHeight, crown, state, materials, random) {
    const tips = [];
    const count = Math.max(3, Math.round(profile.branches * (0.65 + state.growthYear * 0.05)));
    for (let i = 0; i < count; i += 1) {
      let angle = i / count * Math.PI * 2 + random() * 0.48;
      let layer = 0;
      if (name === 'ウメ') angle += i % 2 ? 0.34 : -0.2;
      if (profile.layered) layer = i % 3;
      const start = new THREE.Vector3((random() - 0.5) * 0.12, baseHeight * (0.3 + random() * 0.15), (random() - 0.5) * 0.12);
      const radial = crown * profile.wide * (0.48 + random() * 0.3);
      const height = profile.layered
        ? baseHeight + crown * (-0.15 + layer * 0.23)
        : baseHeight + (random() - 0.35) * crown * profile.flat;
      const tip = new THREE.Vector3(Math.cos(angle) * radial, height, Math.sin(angle) * radial / profile.wide);
      addBranch(group, start, tip, 0.045 * (0.58 + state.growthYear * 0.065), materials.twig);
      tips.push(tip);
    }
    return tips;
  }

  global.createPlantModel = function createPlantModel(tree, index, state, materials, tag) {
    const profile = PROFILES[tree.name];
    const group = new THREE.Group();
    const random = seeded(900 + index * 73);
    const growth = 0.58 + Math.min(10, state.growthYear) * 0.065;
    const baseHeight = Math.max(0.65, tree.h * growth);
    const crown = tree.r * growth;

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(crown * 0.65, 16), materials.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    group.add(shadow);

    if (state.mode === 'plan') {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8),
        profile.evergreen ? materials.planEvergreen : materials.planDeciduous
      );
      marker.position.y = 0.09;
      group.add(marker);
      group.position.set(tree.x, 0, tree.z);
      tag(group, {
        title: tree.name,
        body: `PLAN・${profile.evergreen ? '常緑樹' : '落葉樹'}`,
        meta: [['固定座標', `x ${tree.x} / z ${tree.z}`], ['基準樹高', `${tree.h}m`], ['基準樹冠半径', `${tree.r}m`]]
      });
      return group;
    }

    for (let stem = 0; stem < profile.stems; stem += 1) {
      const x = (stem - (profile.stems - 1) / 2) * 0.08;
      const z = (random() - 0.5) * 0.1;
      addBranch(
        group,
        new THREE.Vector3(x, 0, z),
        new THREE.Vector3(x + (random() - 0.5) * 0.12, baseHeight * 0.65, z + (random() - 0.5) * 0.12),
        (0.07 + (tree.bush ? 0.018 : 0.045)) * growth,
        materials.trunk
      );
    }

    const tips = createBranchTips(group, tree.name, profile, baseHeight, crown, state, materials, random);
    let leafCount = Math.round(profile.leaves * (0.55 + state.growthYear * 0.045));
    if (state.season === 'spring') leafCount *= 0.72;
    if (state.season === 'winter') leafCount *= profile.evergreen ? 1 : (tree.name === 'ブルーベリー' ? 0.22 : 0.08);
    leafCount = Math.min(45, Math.round(leafCount));

    const leafMaterial = seasonalLeafMaterial(tree.name, profile, state, materials);
    for (let i = 0; i < leafCount; i += 1) {
      const tip = tips[i % tips.length];
      const leaf = new THREE.Mesh(LEAF_GEOMETRIES[profile.geometry], leafMaterial);
      const layerJitter = profile.layered ? ((i % 3) - 1) * crown * 0.16 : (random() - 0.5) * crown * 0.34;
      const radialFactor = profile.openCrown ? 0.75 + random() * 0.3 : 1;
      leaf.position.copy(tip).multiplyScalar(radialFactor).add(new THREE.Vector3(
        (random() - 0.5) * crown * 0.58,
        layerJitter,
        (random() - 0.5) * crown * 0.58
      ));
      leaf.scale.copy(leafScale(tree.name, crown, random));
      leaf.rotation.y = random() * Math.PI;
      leaf.castShadow = i < 10;
      group.add(leaf);
    }

    addFlowers(group, profile, tips, state, materials, random);
    addFruits(group, tree.name, tips, crown, state, materials, random);

    group.position.set(tree.x, 0, tree.z);
    tag(group, {
      title: tree.name,
      body: `${profile.evergreen ? '常緑樹' : '落葉樹'}・${state.season}・${state.growthYear}年後`,
      meta: [
        ['固定座標', `x ${tree.x} / z ${tree.z}`],
        ['基準樹高', `${tree.h}m`],
        ['基準樹冠半径', `${tree.r}m`],
        ['性質', profile.evergreen ? '常緑' : '落葉']
      ]
    });
    return group;
  };

  global.isEvergreenSpecies = name => Boolean(PROFILES[name]?.evergreen);
})(window);
