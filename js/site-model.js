(function exposeExteriorSiteModel(global) {
  'use strict';

  const deepFreezeData = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreezeData);
      Object.freeze(value);
    }
    return value;
  };

  const ROAD_DATA = deepFreezeData({
    frontRoad: [{ x: -15.346, z: -18.954 }, { x: 21.854, z: -18.954 }, { x: 21.854, z: -15.054 }, { x: -15.346, z: -15.054 }],
    eastLane: [{ x: -15.346, z: -34.454 }, { x: -11.346, z: -34.454 }, { x: -11.346, z: -18.854 }, { x: -15.346, z: -18.854 }],
    eastRoad: [{ x: 19.454, z: -15.054 }, { x: 21.854, z: -15.054 }, { x: 21.854, z: -3.954 }, { x: 19.454, z: -3.954 }],
    turnaround: [{ x: 14.264, z: -14.954 }, { x: 19.454, z: -15.054 }, { x: 19.454, z: -9.664 }, { x: 16.614, z: -9.664 }]
  });

  const ROAD_MATERIALS = Object.freeze({
    road: new THREE.MeshBasicMaterial({ color: 0x9AA0A6, side: THREE.DoubleSide }),
    turnaround: new THREE.MeshBasicMaterial({ color: 0xE0954A, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false })
  });

  function quad(points, material, y) {
    const vertices = [];
    points.forEach(point => vertices.push(point.x, y, point.z));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  function sprite(group, draw, width, height, sx, sy, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const item = new THREE.Sprite(material);
    item.scale.set(sx, sy, 1);
    item.position.set(x, y, z);
    group.add(item);
  }

  function dimensionLine(group, p1, p2, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1), new THREE.Vector3(...p2)]);
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, dashSize: .12, gapSize: .08 }));
    line.computeLineDistances();
    group.add(line);
  }

  function dimensionLabel(group, text, x, y, z, color) {
    sprite(group, ctx => {
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(0, 0, 200, 66);
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 197, 63);
      ctx.fillStyle = '#222'; ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 100, 34);
    }, 200, 66, 1.15, .38, x, y, z);
  }

  global.createRoadModel = function createRoadModel() {
    const group = new THREE.Group();
    group.add(quad(ROAD_DATA.frontRoad, ROAD_MATERIALS.road, -.01));
    group.add(quad(ROAD_DATA.eastLane, ROAD_MATERIALS.road, -.01));
    group.add(quad(ROAD_DATA.eastRoad, ROAD_MATERIALS.road, -.01));
    group.add(quad(ROAD_DATA.turnaround, ROAD_MATERIALS.turnaround, -.008));
    return group;
  };

  global.createExteriorGuideModel = function createExteriorGuideModel(data) {
    const root = new THREE.Group();
    const vertices = new THREE.Group();
    const lengths = new THREE.Group();
    const buildingDimensions = new THREE.Group();
    root.add(vertices, lengths, buildingDimensions);

    data.site.forEach((point, index) => {
      sprite(vertices, ctx => {
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(64, 64, 44, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3B6D11'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#1f3d0a'; ctx.font = 'bold 58px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(point.n || String(index + 1), 64, 68);
      }, 128, 128, .9, .9, point.x, 1.5, point.z);

      const next = data.site[(index + 1) % data.site.length];
      const distance = Math.hypot(next.x - point.x, next.z - point.z).toFixed(2) + 'm';
      sprite(lengths, ctx => {
        ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(0, 0, 160, 64);
        ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 158, 62);
        ctx.fillStyle = '#333'; ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(distance, 80, 34);
      }, 160, 64, 1, .4, (point.x + next.x) / 2, .8, (point.z + next.z) / 2);
    });

    const B = data.building;
    const tx = value => B.origin.x + value;
    const tz = value => B.origin.z + value;
    dimensionLine(buildingDimensions, [tx(0), .05, tz(-1.2)], [tx(19.11), .05, tz(-1.2)], 0x2E6DD9);
    dimensionLabel(buildingDimensions, '全幅 19.11m', tx(9.555), .05, tz(-1.8), '#2E6DD9');
    dimensionLine(buildingDimensions, [tx(-.6), 0, tz(3.5)], [tx(-.6), 7.423, tz(3.5)], 0xC0392B);
    dimensionLabel(buildingDimensions, '全高 7.423m', tx(-1.9), 7.423, tz(3.5), '#C0392B');
    dimensionLine(buildingDimensions, [tx(-.6), 0, tz(3.5)], [tx(-.6), 3.4, tz(3.5)], 0xC0392B);
    dimensionLabel(buildingDimensions, '1階軒高 3.40m', tx(-1.9), 3.4, tz(3.5), '#C0392B');
    dimensionLabel(buildingDimensions, '2階軒高 6.30m', tx(-1.9), 6.3, tz(3.5), '#C0392B');
    dimensionLine(buildingDimensions, [tx(19.9), .05, tz(1.365)], [tx(19.9), .05, tz(9.1)], 0xE8A33D);
    dimensionLabel(buildingDimensions, '奥行 7.735m', tx(21.3), .05, tz(5.23), '#E8A33D');

    vertices.visible = false;
    lengths.visible = false;
    buildingDimensions.visible = false;
    return { root, vertices, lengths, buildingDimensions };
  };

  global.ROAD_DATA = ROAD_DATA;
  global.ROAD_MATERIALS = ROAD_MATERIALS;
})(window);
