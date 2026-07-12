(function exposeEnvironmentMaterials(global) {
  'use strict';

  function standard(color, roughness = 0.9, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  global.createEnvironmentMaterials = function createEnvironmentMaterials() {
    return Object.freeze({
      mountainNear: standard(0x456348, 1),
      mountainMiddle: new THREE.MeshBasicMaterial({ color: 0x647c67, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      mountainFar: new THREE.MeshBasicMaterial({ color: 0x91a594, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
      forestTrunk: standard(0x554637, 1),
      forestBroadleaf: standard(0x496a48, 1),
      forestConifer: standard(0x365b43, 1),
      forestSilhouette: new THREE.MeshBasicMaterial({ color: 0x5f7860 }),
      shoulder: standard(0x9b9984, 1),
      ditch: standard(0x697174, 0.96),
      verge: standard(0x718b61, 1),
      contactShadow: new THREE.MeshBasicMaterial({ color: 0x1d251e, transparent: true, opacity: 0.16, depthWrite: false }),
      sun: new THREE.MeshBasicMaterial({ color: 0xffd28a }),
      glow: new THREE.SpriteMaterial({ color: 0xffc885, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })
    });
  };
})(window);
