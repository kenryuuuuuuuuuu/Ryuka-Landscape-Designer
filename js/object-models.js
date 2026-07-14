(function exposeObjectModels(global) {
  'use strict';

  const G = Object.freeze({
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    cylinder12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cylinder16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    leaf: new THREE.IcosahedronGeometry(0.5, 1),
    bedLeaf: new THREE.SphereGeometry(1, 7, 5),
    terrace: new THREE.CircleGeometry(0.5, 32)
  });
  const M = Object.freeze({
    storage: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.86 }),
    compost: new THREE.MeshStandardMaterial({ color: 0x40543b, roughness: 0.94 }),
    tank: new THREE.MeshStandardMaterial({ color: 0x657d6e, roughness: 0.72, metalness: 0.08 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xa8aaa5, roughness: 0.94 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x657279, roughness: 0.5, metalness: 0.5 }),
    basin: new THREE.MeshStandardMaterial({ color: 0x90999c, roughness: 0.72, metalness: 0.12 }),
    plan: new THREE.MeshBasicMaterial({ color: 0x8c9a91 }),
    planAccent: new THREE.MeshBasicMaterial({ color: 0x60766b }),
    green: new THREE.MeshStandardMaterial({ color: 0x668e48, roughness: 0.9 }),
    guestGreenA: new THREE.MeshStandardMaterial({ color: 0x598b48, roughness: 0.9 }),
    guestGreenB: new THREE.MeshStandardMaterial({ color: 0x6e9147, roughness: 0.9 }),
    herb: new THREE.MeshStandardMaterial({ color: 0x668854, roughness: 0.9 }),
    pergolaLeafA: new THREE.MeshStandardMaterial({ color: 0x638d43, roughness: 0.9 }),
    pergolaLeafB: new THREE.MeshStandardMaterial({ color: 0x557d3b, roughness: 0.9 })
  });

  function mesh(geometry, material, scale, position) {
    const value = new THREE.Mesh(geometry, material);
    value.scale.set(scale.x, scale.y, scale.z);
    value.position.set(position.x, position.y, position.z);
    value.castShadow = true;
    value.receiveShadow = true;
    return value;
  }
  function box(root, w, h, d, material, x = 0, z = 0, y = h / 2) {
    const value = mesh(G.unitBox, material, { x: w, y: h, z: d }, { x, y, z });
    root.add(value);
    return value;
  }
  function cylinder(root, diameter, height, material, x = 0, z = 0, y = height / 2, segments = 12) {
    const geometry = segments > 12 ? G.cylinder16 : G.cylinder12;
    const value = mesh(geometry, material, { x: diameter, y: height, z: diameter }, { x, y, z });
    root.add(value);
    return value;
  }
  function asset(root, object, options) {
    const profile = global.OBJECT_CATALOG_BY_TYPE.get(object.type);
    if (!profile?.assetId || options.mode !== 'real' || options.modelDetail === 'simple') return false;
    const variant = options.variant || 'low';
    const instance = options.assetManager?.createInstance(profile.assetId, {
      variant,
      targetSize: { x: object.width, y: object.height, z: object.depth }
    });
    if (!instance) return false;
    root.add(instance);
    return true;
  }
  function seeded(seed) {
    let value = seed >>> 0;
    return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function addPlantCluster(root, x, z, material, scale, seed) {
    const random = seeded(seed);
    const cluster = new THREE.Group();
    for (let index = 0; index < 5; index += 1) {
      const radius = scale * (0.6 + random() * 0.55);
      const leaf = mesh(G.bedLeaf, material, { x: radius, y: radius * 0.65, z: radius }, {
        x: (random() - 0.5) * scale * 2,
        y: 0.12 + random() * 0.12,
        z: (random() - 0.5) * scale * 2
      });
      cluster.add(leaf);
    }
    cluster.position.set(x, 0, z);
    root.add(cluster);
    return cluster;
  }
  function addBedPlants(root, object, options) {
    if (options.mode === 'plan') return;
    const guestIndex = Number(object.designId?.match(/guest-bed-(\d+)/)?.[1]);
    const material = object.bedKind === 'herb' ? M.herb : (Number.isFinite(guestIndex) && guestIndex % 2 ? M.guestGreenB : M.guestGreenA);
    const columns = Math.max(2, Math.floor(object.width / 0.42));
    const rows = Math.max(2, Math.floor(object.depth / 0.42));
    const seed = Number.isFinite(object.seed) ? object.seed : 500;
    const random = seeded(seed);
    let clusterCount = 0;
    for (let ix = 0; ix < columns; ix += 1) for (let iz = 0; iz < rows; iz += 1) {
      if (random() < 0.18) continue;
      addPlantCluster(root,
        -object.width / 2 + 0.28 + ix * (object.width - 0.56) / Math.max(1, columns - 1),
        -object.depth / 2 + 0.25 + iz * (object.depth - 0.5) / Math.max(1, rows - 1),
        material, 0.14, seed + ix * 31 + iz);
      clusterCount += 1;
    }
    root.userData.plantClusterCount = clusterCount;
    root.userData.plantLeafCount = clusterCount * 5;
  }
  function buildRaisedBed(root, object, options) {
    if (!asset(root, object, options)) box(root, object.width, 0.38, object.depth, options.wood, 0, 0, 0.19);
    box(root, object.width - 0.16, 0.08, object.depth - 0.16, options.soil, 0, 0, 0.42);
    addBedPlants(root, object, options);
  }
  function buildPergola(root, object, options) {
    const pad = new THREE.Mesh(G.terrace, options.gravel);
    pad.scale.set(object.width, object.depth, 1);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.05;
    pad.receiveShadow = true;
    root.add(pad);
    [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(p => box(root, 0.14, 2.3, 0.14, options.wood, p[0], p[1], 1.15));
    [-1.2, 1.2].forEach(z => box(root, 2.9, 0.12, 0.16, options.wood, 0, z, 2.36));
    for (let index = 0; index < 5; index += 1) box(root, 0.09, 0.09, 2.9, options.wood, -1.2 + index * 0.6, 0, 2.46);
    if (options.mode === 'real') {
      const random = seeded(801);
      for (let index = 0; index < 28; index += 1) {
        const radius = 0.32 + random() * 0.18;
        const diameterScale = radius / 0.5;
        const leaf = mesh(G.leaf, index % 3 === 0 ? M.pergolaLeafA : M.pergolaLeafB, { x: diameterScale, y: diameterScale * 0.45, z: diameterScale }, {
          x: -1.35 + random() * 2.7, y: 2.58 + random() * 0.15, z: -1.35 + random() * 2.7
        });
        root.add(leaf);
      }
      root.userData.pergolaLeafCount = 28;
    }
    box(root, 1.4, 0.07, 0.7, options.wood, 0, 0, 0.72);
    box(root, 0.12, 0.7, 0.6, options.wood, 0, 0, 0.36);
    box(root, 1.4, 0.06, 0.3, options.wood, 0, -0.62, 0.45);
    box(root, 1.4, 0.06, 0.3, options.wood, 0, 0.62, 0.45);
    root.userData.pergolaStructuralParts = 4 + 2 + 5 + 4;
  }
  function buildWaterStation(root, object, options) {
    const parts = object.parts;
    cylinder(root, 1.1, 0.6, options.mode === 'plan' ? M.plan : M.concrete, parts.well.x, parts.well.z);
    cylinder(root, 0.22, 1.0, options.mode === 'plan' ? M.planAccent : M.metal, parts.pump.x, parts.pump.z);
    box(root, 0.9, 0.55, 0.55, options.mode === 'plan' ? M.plan : M.basin, parts.basin.x, parts.basin.z);
  }
  function buildFallback(root, object, options) {
    const material = options.mode === 'plan' ? M.plan : M.storage;
    switch (object.type) {
      case 'tool-shed':
        box(root, 3.6, 2.3, 2.7, material, 0, 0, 1.15);
        box(root, 3.95, 0.14, 3.05, options.roof, 0, 0, 2.38);
        {
          const door = box(root, 0.9, 1.75, 0.08, options.wood, 0, Number.isFinite(object.doorOffsetZ) ? object.doorOffsetZ : 1.38, 0.88);
          door.name = 'shed-door';
        }
        break;
      case 'garden-bench':
        box(root, 1.6, 0.08, 0.45, options.wood, 0, 0, 0.45);
        [-0.6, 0.6].forEach(x => box(root, 0.15, 0.42, 0.4, options.wood, x, 0, 0.21));
        break;
      case 'raised-bed': buildRaisedBed(root, object, options); break;
      case 'storage-box': box(root, object.width, object.height, object.depth, material); break;
      case 'compost-bin': box(root, object.width, object.height, object.depth, options.mode === 'plan' ? M.planAccent : M.compost); break;
      case 'rainwater-tank': cylinder(root, object.width, object.height, options.mode === 'plan' ? M.planAccent : M.tank, 0, 0, object.height / 2, 16); break;
      case 'planter-box':
        box(root, object.width, object.height, object.depth, options.wood);
        box(root, object.width - 0.12, 0.06, object.depth - 0.12, options.soil, 0, 0, object.height + 0.03);
        break;
      case 'water-station': buildWaterStation(root, object, options); break;
      case 'pergola': buildPergola(root, object, options); break;
      default: box(root, object.width, object.height, object.depth, material);
    }
  }

  function createObjectModel(object, options) {
    const root = new THREE.Group();
    root.name = object.designId;
    if (object.type === 'raised-bed') buildRaisedBed(root, object, options);
    else if (!asset(root, object, options)) buildFallback(root, object, options);
    root.position.set(object.x, 0, object.z);
    root.rotation.y = object.rotation || 0;
    Object.assign(root.userData, {
      designId: object.designId,
      sourceType: object.sourceType,
      objectType: object.type,
      basePosition: object.basePosition,
      currentPosition: { x: object.x, z: object.z }
    });
    return root;
  }

  global.OBJECT_GEOMETRIES = G;
  global.OBJECT_MATERIALS = M;
  global.createObjectModel = createObjectModel;
})(window);
