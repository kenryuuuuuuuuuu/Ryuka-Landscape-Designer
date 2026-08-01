(function exposeParkingModel(global) {
  'use strict';

  const deepFreezeData = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreezeData);
      Object.freeze(value);
    }
    return value;
  };

  const DATA = deepFreezeData({
    guestCars: [
      { x: -11.946, z: -9.454, color: 0x2255AA, rotY: 0 },
      { x: -9.146, z: -9.454, color: 0x2255AA, rotY: 0 }
    ],
    ownerLayouts: {
      A: [{ x: 13.954, z: -11.954, rotY: 0 }, { x: 15.154, z: -5.754, rotY: Math.PI / 2 }],
      B: [{ x: 14.554, z: -7.104, rotY: 0 }, { x: 17.354, z: -7.104, rotY: 0 }],
      C: [{ x: 16.254, z: -8.154, rotY: Math.PI / 2 }, { x: 16.254, z: -5.554, rotY: Math.PI / 2 }]
    },
    carportBounds: {
      A: { x0: 13.254, x1: 18.654, z0: -9.604, z1: -4.604 },
      B: { x0: 13.254, x1: 18.654, z0: -9.604, z1: -4.604 },
      C: { x0: 13.554, x1: 18.954, z0: -9.454, z1: -4.254 }
    },
    carportPostAxis: { A: 'ns', B: 'ew', C: 'ns' }
  });

  const MATERIALS = Object.freeze({
    guestBody: new THREE.MeshStandardMaterial({ color: 0x2255AA, roughness: .45, metalness: .35 }),
    ownerBody: new THREE.MeshStandardMaterial({ color: 0xC0392B, roughness: .45, metalness: .35 }),
    cabin: new THREE.MeshPhysicalMaterial({ color: 0x2a3338, roughness: .15, metalness: .1, transparent: true, opacity: .85 }),
    carportRoof: new THREE.MeshStandardMaterial({ color: 0x8FA3B0, transparent: true, opacity: .5, roughness: .4, metalness: .3 }),
    carportPost: new THREE.MeshStandardMaterial({ color: 0x6E7F8A, roughness: .5, metalness: .4 })
  });

  const GEOMETRIES = Object.freeze({
    carBody: new THREE.BoxGeometry(1.78, 1.43 * .62, 4.6),
    carCabin: new THREE.BoxGeometry(1.78 * .88, 1.43 * .42, 4.6 * .5),
    carportPost: new THREE.BoxGeometry(.14, 2.4, .14)
  });

  function addCar(group, item, material) {
    const body = new THREE.Mesh(GEOMETRIES.carBody, material);
    body.position.set(item.x, 1.43 * .31, item.z);
    body.rotation.y = item.rotY || 0;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(GEOMETRIES.carCabin, MATERIALS.cabin);
    cabin.position.set(item.x, 1.43 * .72, item.z);
    cabin.rotation.y = item.rotY || 0;
    cabin.castShadow = true;
    group.add(cabin);
  }

  function addCarport(group, bounds, axis) {
    const { x0, x1, z0, z1 } = bounds;
    const height = 2.4, thickness = .15;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, thickness, z1 - z0), MATERIALS.carportRoof);
    roof.position.set((x0 + x1) / 2, height + thickness / 2, (z0 + z1) / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    let posts;
    if (axis === 'ns') {
      const xs = [x0 + (x1 - x0) * .12, (x0 + x1) / 2, x1 - (x1 - x0) * .12];
      posts = xs.flatMap(x => [[x, z0], [x, z1]]);
    } else {
      const zs = [z0 + (z1 - z0) * .12, (z0 + z1) / 2, z1 - (z1 - z0) * .12];
      posts = zs.flatMap(z => [[x0, z], [x1, z]]);
    }
    posts.forEach(([x, z]) => {
      const post = new THREE.Mesh(GEOMETRIES.carportPost, MATERIALS.carportPost);
      post.position.set(x, height / 2, z);
      post.castShadow = true;
      group.add(post);
    });
  }

  global.createParkingModel = function createParkingModel(options = {}) {
    const layout = DATA.ownerLayouts[options.layout] ? options.layout : 'B';
    const root = new THREE.Group();
    const cars = new THREE.Group();
    const carport = new THREE.Group();
    cars.name = 'parking-cars';
    carport.name = 'parking-carport';
    root.add(cars, carport);

    if (options.showCars !== false) {
      DATA.guestCars.forEach(item => addCar(cars, item, MATERIALS.guestBody));
      DATA.ownerLayouts[layout].forEach(item => addCar(cars, { ...item, color: 0xC0392B }, MATERIALS.ownerBody));
    }
    if (options.showCarport !== false) addCarport(carport, DATA.carportBounds[layout], DATA.carportPostAxis[layout]);
    root.userData.layout = layout;
    root.userData.carCount = cars.children.length / 2;
    root.userData.carportPostCount = carport.children.length ? carport.children.length - 1 : 0;
    return root;
  };

  global.PARKING_DATA = DATA;
  global.PARKING_MATERIALS = MATERIALS;
  global.PARKING_GEOMETRIES = GEOMETRIES;
})(window);
