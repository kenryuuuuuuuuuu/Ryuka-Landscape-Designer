(function exposeAssetLoader(global) {
  'use strict';

  function createAssetManager(catalog) {
    if (!global.THREE || !THREE.GLTFLoader) throw new Error('THREE.GLTFLoader is required');
    const loader = new THREE.GLTFLoader();
    const entries = new Map(catalog.map(item => [item.id, item]));
    const promises = new Map();
    const prototypes = new Map();
    const failures = new Map();
    const listeners = new Set();
    const shared = { geometries: new Set(), materials: new Set(), textures: new Set() };

    function key(id, variant) { return `${id}:${variant}`; }
    function notify() { const status = getStatus(); listeners.forEach(callback => callback(status)); }
    function collect(root) {
      root.traverse(object => {
        if (object.geometry) shared.geometries.add(object.geometry);
        const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        materials.forEach(material => {
          shared.materials.add(material);
          Object.values(material).forEach(value => { if (value?.isTexture) shared.textures.add(value); });
        });
      });
    }
    function normalize(scene, item) {
      const sourceBox = new THREE.Box3().setFromObject(scene);
      const size = sourceBox.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.x + size.y + size.z) || Math.min(size.x, size.y, size.z) <= 1e-6) throw new Error('empty or invalid GLB bounds');
      const scale = new THREE.Vector3(item.canonicalSize.x / size.x, item.canonicalSize.y / size.y, item.canonicalSize.z / size.z);
      if (![scale.x, scale.y, scale.z].every(value => Number.isFinite(value) && value > 0.01 && value < 100)) throw new Error('extreme GLB normalization scale');
      const root = new THREE.Group();
      root.name = `asset:${item.id}`;
      scene.scale.copy(scale);
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.set(-center.x, -box.min.y, -center.z);
      root.add(scene);
      root.updateMatrixWorld(true);
      return root;
    }
    function configure(root, item, variant) {
      root.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = item.castShadow && !(variant === 'low' && object.geometry?.attributes?.position?.count < 30);
        object.receiveShadow = item.receiveShadow;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if ('envMapIntensity' in material) material.envMapIntensity = item.envMapIntensity;
          if (material.transparent) material.depthWrite = material.opacity >= 0.95;
          material.needsUpdate = true;
        });
      });
    }
    function preload(id, variant = 'high', retry = false) {
      const item = entries.get(id);
      if (!item || !item.variants[variant]) return Promise.reject(new Error(`Unknown asset ${id}:${variant}`));
      const cacheKey = key(id, variant);
      if (retry) { promises.delete(cacheKey); failures.delete(cacheKey); }
      if (prototypes.has(cacheKey)) return Promise.resolve(prototypes.get(cacheKey));
      if (promises.has(cacheKey)) return promises.get(cacheKey);
      if (failures.has(cacheKey)) return Promise.reject(failures.get(cacheKey));
      const promise = new Promise((resolve, reject) => {
        loader.load(item.variants[variant], gltf => {
          try {
            if (!gltf?.scene) throw new Error('GLB scene is missing');
            const prototype = normalize(gltf.scene, item);
            configure(prototype, item, variant);
            prototype.userData.assetId = id;
            prototype.userData.variant = variant;
            collect(prototype);
            prototypes.set(cacheKey, prototype);
            resolve(prototype);
          } catch (error) { failures.set(cacheKey, error); reject(error); }
          finally { notify(); }
        }, undefined, error => { failures.set(cacheKey, error); notify(); reject(error); });
      });
      promises.set(cacheKey, promise);
      notify();
      return promise;
    }
    function preloadAll() {
      return Promise.allSettled(catalog.flatMap(item => ['high', 'low'].map(variant => preload(item.id, variant))));
    }
    function createInstance(id, options = {}) {
      const variant = options.variant || 'high';
      const prototype = prototypes.get(key(id, variant));
      const item = entries.get(id);
      if (!prototype || !item) return null;
      const instance = prototype.clone(true);
      instance.userData.assetId = id;
      instance.userData.variant = variant;
      const target = options.targetSize || item.canonicalSize;
      instance.scale.set(target.x / item.canonicalSize.x, target.y / item.canonicalSize.y, target.z / item.canonicalSize.z);
      if (options.position) instance.position.set(options.position.x, options.position.y || 0, options.position.z);
      instance.rotation.y = Number(options.rotationY) || 0;
      return instance;
    }
    function getStatus() {
      const urls = catalog.flatMap(item => ['high', 'low'].map(variant => {
        const cacheKey = key(item.id, variant);
        return { id: item.id, variant, url: item.variants[variant], state: prototypes.has(cacheKey) ? 'ready' : failures.has(cacheKey) ? 'failed' : promises.has(cacheKey) ? 'loading' : 'idle' };
      }));
      return { total: urls.length, ready: urls.filter(x => x.state === 'ready').length, loading: urls.filter(x => x.state === 'loading').length, failed: urls.filter(x => x.state === 'failed').length, urls };
    }
    function retryFailed() { return Promise.allSettled([...failures.keys()].map(cacheKey => { const [id, variant] = cacheKey.split(':'); return preload(id, variant, true); })); }
    function disposeAll() {
      shared.textures.forEach(texture => texture.dispose());
      shared.materials.forEach(material => material.dispose());
      shared.geometries.forEach(geometry => geometry.dispose());
      promises.clear(); prototypes.clear(); failures.clear();
      shared.textures.clear(); shared.materials.clear(); shared.geometries.clear(); notify();
    }
    return Object.freeze({
      preloadAll, preload,
      isReady: (id, variant = 'high') => prototypes.has(key(id, variant)),
      createInstance, getStatus,
      getSharedResources: () => shared,
      onStatusChange(callback) { listeners.add(callback); callback(getStatus()); return () => listeners.delete(callback); },
      retryFailed, disposeAll
    });
  }

  global.createAssetManager = createAssetManager;
})(window);
