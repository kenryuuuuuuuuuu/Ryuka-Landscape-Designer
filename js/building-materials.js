(function exposeBuildingMaterials(global) {
  'use strict';

  const SIZE = 256;

  function random(seed) {
    let state = seed >>> 0;
    return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function texture(renderer, painter, repeatX, repeatY, colorData) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    painter(canvas.getContext('2d'), random(painter.seed || 1), SIZE);
    const result = new THREE.CanvasTexture(canvas);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.repeat.set(repeatX, repeatY);
    result.encoding = colorData ? THREE.sRGBEncoding : THREE.LinearEncoding;
    result.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    result.minFilter = THREE.LinearMipmapLinearFilter;
    result.magFilter = THREE.LinearFilter;
    result.generateMipmaps = true;
    return result;
  }

  function wallPainter(height) {
    const painter = (ctx, rand, size) => {
      ctx.fillStyle = height ? '#777' : '#ddd8ca'; ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 24) {
        ctx.fillStyle = height ? '#6b6b6b' : 'rgba(118,111,99,.10)'; ctx.fillRect(0, y, size, 1);
        if (!height) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, y + 1, size, 1); }
      }
      for (let i = 0; i < 180; i++) {
        const value = height ? 108 + Math.floor(rand() * 28) : 135 + Math.floor(rand() * 35);
        ctx.fillStyle = height ? `rgb(${value},${value},${value})` : `rgba(${value},${value - 5},${value - 12},.055)`;
        ctx.fillRect(rand() * size, rand() * size, 1, 2 + rand() * 5);
      }
    };
    painter.seed = height ? 511 : 509;
    return painter;
  }

  function concretePainter(height) {
    const painter = (ctx, rand, size) => {
      ctx.fillStyle = height ? '#777' : '#8d8c87'; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 900; i++) {
        const value = 95 + Math.floor(rand() * 55);
        ctx.fillStyle = height ? `rgb(${value},${value},${value})` : `rgba(${value},${value},${value - 3},.13)`;
        const s = .4 + rand() * 1.2; ctx.fillRect(rand() * size, rand() * size, s, s);
      }
    };
    painter.seed = height ? 521 : 519;
    return painter;
  }

  function roofPainter(height) {
    const painter = (ctx, rand, size) => {
      ctx.fillStyle = height ? '#777' : '#333b3d'; ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 18) {
        ctx.fillStyle = height ? '#686868' : 'rgba(8,13,14,.22)'; ctx.fillRect(x, 0, 1, size);
        if (!height) { ctx.fillStyle = 'rgba(190,205,205,.055)'; ctx.fillRect(x + 1, 0, 1, size); }
      }
      for (let i = 0; i < 160; i++) {
        const value = 80 + Math.floor(rand() * 22);
        ctx.fillStyle = height ? `rgb(${value + 25},${value + 25},${value + 25})` : `rgba(${value},${value + 5},${value + 7},.07)`;
        ctx.fillRect(rand() * size, rand() * size, 1, 3 + rand() * 6);
      }
    };
    painter.seed = height ? 531 : 529;
    return painter;
  }

  function woodPainter(ctx, rand, size) {
    ctx.fillStyle = '#66503d'; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) { ctx.fillStyle = 'rgba(35,22,14,.12)'; ctx.fillRect(x, 0, 1, size); }
    for (let i = 0; i < 90; i++) { ctx.fillStyle = 'rgba(205,169,122,.06)'; ctx.fillRect(rand() * size, 0, .7, size); }
  }
  woodPainter.seed = 541;

  global.createBuildingMaterials = function createBuildingMaterials(renderer) {
    const maps = {
      wall: texture(renderer, wallPainter(false), 5, 2, true),
      wallHeight: texture(renderer, wallPainter(true), 5, 2, false),
      concrete: texture(renderer, concretePainter(false), 6, 2, true),
      concreteHeight: texture(renderer, concretePainter(true), 6, 2, false),
      roof: texture(renderer, roofPainter(false), 8, 2, true),
      roofHeight: texture(renderer, roofPainter(true), 8, 2, false),
      wood: texture(renderer, woodPainter, 3, 1, true)
    };
    const materials = {
      wall: new THREE.MeshStandardMaterial({ color: 0xf1ecdf, map: maps.wall, bumpMap: maps.wallHeight, bumpScale: .018, roughness: .88 }),
      foundation: new THREE.MeshStandardMaterial({ color: 0xb0aea7, map: maps.concrete, bumpMap: maps.concreteHeight, bumpScale: .035, roughness: .96 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xffffff, map: maps.roof, bumpMap: maps.roofHeight, bumpScale: .025, roughness: .72, metalness: .08 }),
      wood: new THREE.MeshStandardMaterial({ color: 0xffffff, map: maps.wood, roughness: .78 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xd6d2c8, roughness: .76 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x495255, roughness: .42, metalness: .48 }),
      gutter: new THREE.MeshStandardMaterial({ color: 0x394245, roughness: .56, metalness: .25 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x718c96, roughness: .2, metalness: .05, transmission: .08, transparent: true, opacity: .78, reflectivity: .78 }),
      interior: new THREE.MeshStandardMaterial({ color: 0x171b1c, roughness: .94 }),
      curtain: new THREE.MeshStandardMaterial({ color: 0xc8c0ad, roughness: 1, transparent: true, opacity: .45 }),
      shadow: new THREE.MeshBasicMaterial({ color: 0x181a18, transparent: true, opacity: .22, depthWrite: false }),
      planFoundation: new THREE.MeshBasicMaterial({ color: 0xaaa8a2 }),
      planWall: new THREE.MeshBasicMaterial({ color: 0xe7e0d2 }),
      planRoof: new THREE.MeshBasicMaterial({ color: 0x626c70 }),
      planOpening: new THREE.MeshBasicMaterial({ color: 0x50656e }),
      planDoor: new THREE.MeshBasicMaterial({ color: 0x78614d })
    };
    return Object.freeze({ maps: Object.freeze(maps), ...materials });
  };
})(window);
