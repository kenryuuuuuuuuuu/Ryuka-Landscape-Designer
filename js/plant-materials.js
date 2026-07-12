(function exposePlantMaterials(global) {
  'use strict';

  function standard(color, roughness = 0.82) {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  global.createPlantMaterials = function createPlantMaterials() {
    return Object.freeze({
      trunk: standard(0x5a402d, 0.94),
      twig: standard(0x66503a, 0.92),

      deciduous: standard(0x4f813f),
      citrus: standard(0x285f32),
      fig: standard(0x4d7c3b),
      blueberry: standard(0x557f43),
      springDeciduous: standard(0x78aa59),
      springCitrus: standard(0x397548),
      springFig: standard(0x6f9850),
      springBlueberry: standard(0x83a95a),
      autumnRed: standard(0xa74738),
      autumnOrange: standard(0xc56c32),
      autumnGold: standard(0xc1973c),
      autumnBrown: standard(0x86603b),
      winterBlueberry: standard(0x7b493d),
      winterDryLeaf: standard(0x796447),

      flowerWhite: new THREE.MeshStandardMaterial({
        color: 0xf3f0e4,
        roughness: 0.72,
        side: THREE.DoubleSide
      }),
      flowerPink: new THREE.MeshStandardMaterial({
        color: 0xf2cbd1,
        roughness: 0.72,
        side: THREE.DoubleSide
      }),
      flowerCore: standard(0xe3b43d, 0.72),
      fruitPurple: standard(0x593d61, 0.68),
      fruitBlue: standard(0x334d79, 0.65),
      fruitYellow: standard(0xe5b928, 0.62),
      fruitOrange: standard(0xe48224, 0.62),
      fruitRed: standard(0xa83b32, 0.66),

      shadow: new THREE.MeshBasicMaterial({
        color: 0x182018,
        transparent: true,
        opacity: 0.2,
        depthWrite: false
      }),
      planDeciduous: new THREE.MeshBasicMaterial({ color: 0x7fa46a }),
      planEvergreen: new THREE.MeshBasicMaterial({ color: 0x3f7650 })
    });
  };
})(window);
