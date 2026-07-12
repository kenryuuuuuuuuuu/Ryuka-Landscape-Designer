(function exposeGroundMaterials(global) {
  'use strict';

  const SIZE = 256;

  function random(seed) {
    let state = seed >>> 0;
    return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function canvasTexture(renderer, painter, repeat, isColorTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const context = canvas.getContext('2d');
    painter(context, random(painter.seed || 1), SIZE);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.encoding = isColorTexture ? THREE.sRGBEncoding : THREE.LinearEncoding;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  }

  function fill(ctx, color, size) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
  }

  function grassPainter(base, seed, clover) {
    const painter = (ctx, rand, size) => {
      fill(ctx, base, size);
      for (let y = 0; y < size; y += 24) for (let x = 0; x < size; x += 24) {
        const green = clover ? 78 + Math.floor(rand() * 20) : 62 + Math.floor(rand() * 18);
        ctx.fillStyle = `rgba(${clover ? 72 : 54},${green + 48},${clover ? 62 : 48},.14)`;
        ctx.fillRect(x, y, 24, 24);
      }
      for (let i = 0; i < 2400; i++) {
        const dry = rand() < .055;
        ctx.strokeStyle = dry ? 'rgba(176,151,91,.22)' : `rgba(${42 + rand() * 24},${92 + rand() * 42},${40 + rand() * 22},.24)`;
        ctx.lineWidth = rand() < .15 ? 1.2 : .65;
        const x = rand() * size, y = rand() * size, length = 1.5 + rand() * 4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 1.4, y - length); ctx.stroke();
      }
    };
    painter.seed = seed;
    return painter;
  }

  function soilPainter(base, seed, warm) {
    const painter = (ctx, rand, size) => {
      fill(ctx, base, size);
      for (let y = 0; y < size; y += 32) for (let x = 0; x < size; x += 32) {
        const value = Math.floor((rand() - .5) * 22);
        ctx.fillStyle = `rgba(${warm ? 116 + value : 92 + value},${warm ? 74 + value : 57 + value},${warm ? 43 + value : 35 + value},.18)`;
        ctx.fillRect(x, y, 32, 32);
      }
      for (let i = 0; i < 1800; i++) {
        const light = rand() > .58;
        ctx.fillStyle = light ? 'rgba(170,126,78,.20)' : 'rgba(31,21,15,.23)';
        const s = .45 + rand() * 1.7;
        ctx.fillRect(rand() * size, rand() * size, s, s * .65);
      }
      ctx.lineWidth = .65;
      for (let i = 0; i < 150; i++) {
        ctx.strokeStyle = `rgba(39,25,16,${.04 + rand() * .08})`;
        const y = rand() * size;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(size * .3, y + rand() * 5, size * .7, y - rand() * 5, size, y + (rand() - .5) * 5); ctx.stroke();
      }
    };
    painter.seed = seed;
    return painter;
  }

  function aggregatePainter(base, seed, asphalt, fine) {
    const painter = (ctx, rand, size) => {
      fill(ctx, base, size);
      const count = asphalt ? 2300 : fine ? 1900 : 2600;
      for (let i = 0; i < count; i++) {
        const large = !fine && rand() < .16;
        const v = asphalt ? 78 + rand() * 52 : 118 + rand() * 92;
        ctx.fillStyle = `rgba(${v},${asphalt ? v : v * .94},${asphalt ? v : v * .82},${asphalt ? .22 : .32})`;
        const w = large ? 2.8 + rand() * 3.2 : .6 + rand() * (fine ? 1.3 : 2.1);
        ctx.fillRect(rand() * size, rand() * size, w, w * (.55 + rand() * .45));
      }
      if (asphalt) for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = `rgba(34,36,37,${.05 + rand() * .08})`;
        ctx.beginPath(); const y = rand() * size; ctx.moveTo(0, y); ctx.lineTo(size, y + (rand() - .5) * 3); ctx.stroke();
      }
    };
    painter.seed = seed;
    return painter;
  }

  function heightPainter(seed, furrows) {
    const painter = (ctx, rand, size) => {
      fill(ctx, '#777', size);
      for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) {
        const v = 92 + Math.floor(rand() * 65);
        ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 4, 4);
      }
      if (furrows) {
        for (let y = 0; y < size; y += 28) {
          const gradient = ctx.createLinearGradient(0, y, 0, y + 28);
          gradient.addColorStop(0, '#555'); gradient.addColorStop(.5, '#aaa'); gradient.addColorStop(1, '#555');
          ctx.fillStyle = gradient; ctx.fillRect(0, y, size, 28);
        }
      }
    };
    painter.seed = seed;
    return painter;
  }

  function material(color, map, bumpMap, bumpScale) {
    return new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale, roughness: .96, metalness: 0 });
  }

  global.createGroundMaterials = function createGroundMaterials(renderer) {
    const textures = {
      grass: canvasTexture(renderer, grassPainter('#496744', 101, false), 12, true),
      clover: canvasTexture(renderer, grassPainter('#58784b', 103, true), 10, true),
      field: canvasTexture(renderer, soilPainter('#59402d', 201, false), 9, true),
      guestSoil: canvasTexture(renderer, soilPainter('#65452e', 203, true), 7, true),
      ridgeSoil: canvasTexture(renderer, soilPainter('#4d3424', 207, false), 8, true),
      path: canvasTexture(renderer, aggregatePainter('#a99672', 301, false, true), 9, true),
      gravel: canvasTexture(renderer, aggregatePainter('#8f8a7b', 303, false, false), 10, true),
      yardGravel: canvasTexture(renderer, aggregatePainter('#858074', 307, false, false), 11, true),
      asphalt: canvasTexture(renderer, aggregatePainter('#5b5c5b', 311, true, true), 12, true),
      soilHeight: canvasTexture(renderer, heightPainter(401, false), 9, false),
      ridgeHeight: canvasTexture(renderer, heightPainter(403, true), 8, false),
      gravelHeight: canvasTexture(renderer, heightPainter(405, false), 10, false)
    };
    return Object.freeze({
      textures: Object.freeze(textures),
      surrounding: material(0xffffff, textures.grass, null, 0),
      clover: material(0xffffff, textures.clover, null, 0),
      field: material(0xffffff, textures.field, textures.soilHeight, .09),
      rotationSoil: material(0xffffff, textures.field, textures.soilHeight, .12),
      guestSoil: material(0xffffff, textures.guestSoil, textures.soilHeight, .1),
      ridgeSoil: material(0xffffff, textures.ridgeSoil, textures.ridgeHeight, .16),
      path: material(0xffffff, textures.path, textures.gravelHeight, .035),
      takuchi: material(0xffffff, textures.gravel, textures.gravelHeight, .07),
      yardGravel: material(0xffffff, textures.yardGravel, textures.gravelHeight, .085),
      pergolaGravel: material(0xd2c8b2, textures.path, textures.gravelHeight, .045),
      asphalt: material(0xffffff, textures.asphalt, textures.gravelHeight, .025),
      planTak: new THREE.MeshBasicMaterial({ color: 0xb6ad9b }),
      planField: new THREE.MeshBasicMaterial({ color: 0x8d6b44 }),
      planPath: new THREE.MeshBasicMaterial({ color: 0xd8c9a8 }),
      planSoil: new THREE.MeshBasicMaterial({ color: 0x765234 }),
      planClover: new THREE.MeshBasicMaterial({ color: 0x789b55 }),
      planGravel: new THREE.MeshBasicMaterial({ color: 0xa7a193 }),
      planAsphalt: new THREE.MeshBasicMaterial({ color: 0x777671 })
    });
  };
})(window);
