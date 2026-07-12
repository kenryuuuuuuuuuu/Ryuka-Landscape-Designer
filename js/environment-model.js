(function exposeEnvironmentModel(global) {
  'use strict';

  const GEOMETRIES = Object.freeze({
    sky: new THREE.SphereGeometry(280, 32, 18),
    sun: new THREE.SphereGeometry(1.35, 16, 12),
    ground: new THREE.CircleGeometry(250, 72),
    broadleaf: new THREE.DodecahedronGeometry(0.72, 0),
    conifer: new THREE.ConeGeometry(0.7, 1.8, 7),
    trunk: new THREE.CylinderGeometry(0.1, 0.15, 1.25, 6),
    shadow: new THREE.CircleGeometry(1, 20),
    road: new THREE.PlaneGeometry(72, 6),
    shoulder: new THREE.PlaneGeometry(72, 0.72),
    ditch: new THREE.BoxGeometry(72, 0.1, 0.38)
  });
  global.ENVIRONMENT_GEOMETRIES = GEOMETRIES;

  function seeded(seed) {
    let value = seed >>> 0;
    return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function ridgeGeometry(radius, baseHeight, amplitude, seed) {
    const random = seeded(seed);
    const segments = 72;
    const heights = [];
    let walk = random() * 0.8;
    for (let i = 0; i < segments; i += 1) {
      walk = walk * 0.72 + (random() - 0.5) * 0.85;
      heights.push(baseHeight + Math.sin(i * 0.47 + seed) * amplitude * 0.38 + Math.sin(i * 0.16) * amplitude * 0.55 + walk * amplitude);
    }
    heights.push(heights[0]);
    const radii = [];
    for (let i = 0; i < segments; i += 1) {
      radii.push(radius + Math.sin(i * 0.31 + seed) * 3);
    }
    radii.push(radii[0]);
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = i / segments * Math.PI * 2;
      const r = radii[i];
      const x = i === segments ? positions[0] : Math.sin(angle) * r;
      const z = i === segments ? positions[2] : Math.cos(angle) * r;
      positions.push(x, -3, z, x, heights[i], z);
      if (i < segments) {
        const n = i * 2;
        indices.push(n, n + 1, n + 3, n, n + 3, n + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const position = geometry.getAttribute('position');
    const firstBottom = new THREE.Vector3().fromBufferAttribute(position, 0);
    const firstTop = new THREE.Vector3().fromBufferAttribute(position, 1);
    const lastBottom = new THREE.Vector3().fromBufferAttribute(position, segments * 2);
    const lastTop = new THREE.Vector3().fromBufferAttribute(position, segments * 2 + 1);
    geometry.userData.seamDistance = Math.max(firstBottom.distanceTo(lastBottom), firstTop.distanceTo(lastTop));
    return geometry;
  }

  function environmentCanvas(period, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const context = canvas.getContext('2d');
    const colors = period === 'night'
      ? ['#101a2d', '#283449', '#3c424b']
      : period === 'twilight'
        ? ['#476c93', '#d18a78', '#f0c09b']
        : ['#4d8fc1', '#a9c9d4', '#e4ddd0'];
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.55, colors[1]);
    gradient.addColorStop(1, colors[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const glow = context.createRadialGradient(canvas.width * 0.72, canvas.height * 0.58, 0, canvas.width * 0.72, canvas.height * 0.58, canvas.width * 0.24);
    glow.addColorStop(0, period === 'night' ? 'rgba(90,110,145,.08)' : 'rgba(255,214,157,.32)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function addContactShadow(group, materials, x, z, scaleX, scaleZ, opacity = 1) {
    const shadow = new THREE.Mesh(GEOMETRIES.shadow, materials.contactShadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.018, z);
    shadow.scale.set(scaleX, scaleZ, 1);
    shadow.userData.opacityScale = opacity;
    group.add(shadow);
  }

  global.createEnvironmentModel = function createEnvironmentModel(options) {
    const { scene, renderer, materials, groundMaterial, asphaltMaterial, data } = options;
    const root = new THREE.Group();
    const context = new THREE.Group();
    const contactShadows = new THREE.Group();
    root.add(context, contactShadows);
    scene.add(root);

    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x5d93bd) },
        horizon: { value: new THREE.Color(0xd7dfda) },
        sunColor: { value: new THREE.Color(0xffc58f) },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        daylight: { value: 1 },
        twilight: { value: 0 }
      },
      vertexShader: 'varying vec3 vWorld;void main(){vWorld=normalize((modelMatrix*vec4(position,1.0)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sunColor;uniform vec3 sunDirection;uniform float daylight;uniform float twilight;varying vec3 vWorld;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec3 d=normalize(vWorld);float h=smoothstep(-.12,.72,d.y);float glow=pow(max(dot(d,normalize(sunDirection)),0.0),18.0);vec3 c=mix(horizon,zenith,h);c=mix(c,sunColor,glow*(.15+.38*twilight));c+=(hash(gl_FragCoord.xy)-.5)/255.0;gl_FragColor=vec4(c,1.0);}'
    });
    const sky = new THREE.Mesh(GEOMETRIES.sky, skyMaterial);
    root.add(sky);

    const sun = new THREE.Mesh(GEOMETRIES.sun, materials.sun);
    const glow = new THREE.Sprite(materials.glow);
    glow.scale.set(8, 8, 1);
    root.add(glow, sun);

    const hemi = new THREE.HemisphereLight(0xcce2ee, 0x62513d, 0.72);
    const ambient = new THREE.AmbientLight(0xffffff, 0.16);
    const keyLight = new THREE.DirectionalLight(0xfff0d5, 2.2);
    keyLight.castShadow = true;
    Object.assign(keyLight.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 4, far: 190 });
    keyLight.shadow.bias = -0.00018;
    keyLight.shadow.normalBias = 0.028;
    root.add(hemi, ambient, keyLight, keyLight.target);

    const entranceLight = new THREE.PointLight(0xffb56b, 0, 7, 2);
    entranceLight.position.set(data.building.doorX, 2.75, data.building.cz - data.building.d / 2 - 0.42);
    entranceLight.castShadow = false;
    const guestLight = new THREE.PointLight(0xffc07a, 0, 6, 2);
    guestLight.position.set(data.building.cx - 4.2, 2.55, data.building.cz + data.building.d / 2 + 0.28);
    guestLight.castShadow = false;
    root.add(entranceLight, guestLight);

    const ground = new THREE.Mesh(GEOMETRIES.ground, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.09;
    ground.receiveShadow = true;
    context.add(ground);
    const road = new THREE.Mesh(GEOMETRIES.road, asphaltMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(1, -0.055, -19.2);
    road.receiveShadow = true;
    context.add(road);
    [-22.55, -15.85].forEach(z => {
      const shoulder = new THREE.Mesh(GEOMETRIES.shoulder, materials.shoulder);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(1, -0.046, z);
      context.add(shoulder);
    });
    const ditch = new THREE.Mesh(GEOMETRIES.ditch, materials.ditch);
    ditch.position.set(1, -0.075, -15.45);
    context.add(ditch);

    const mountainGeometries = [ridgeGeometry(112, 8, 4.5, 11), ridgeGeometry(154, 13, 6.5, 23), ridgeGeometry(205, 18, 7.5, 37)];
    const mountainMaterials = [materials.mountainNear, materials.mountainMiddle, materials.mountainFar];
    mountainGeometries.forEach((geometry, index) => context.add(new THREE.Mesh(geometry, mountainMaterials[index])));

    const maxTrees = 140;
    const broadleaf = new THREE.InstancedMesh(GEOMETRIES.broadleaf, materials.forestBroadleaf, maxTrees);
    const conifer = new THREE.InstancedMesh(GEOMETRIES.conifer, materials.forestConifer, maxTrees);
    const trunks = new THREE.InstancedMesh(GEOMETRIES.trunk, materials.forestTrunk, maxTrees);
    const random = seeded(501);
    const transform = new THREE.Object3D();
    let broadleafIndex = 0;
    let coniferIndex = 0;
    for (let i = 0; i < maxTrees; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 43 + random() * 69;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const scale = 0.72 + random() * 1.55;
      transform.position.set(x, 1.4 * scale, z);
      transform.scale.set(scale * (0.8 + random() * 0.35), scale, scale);
      transform.rotation.set((random() - 0.5) * 0.08, random() * Math.PI, (random() - 0.5) * 0.08);
      transform.updateMatrix();
      if (i % 3 === 0) conifer.setMatrixAt(coniferIndex++, transform.matrix);
      else broadleaf.setMatrixAt(broadleafIndex++, transform.matrix);
      transform.position.y = 0.62 * scale;
      transform.scale.set(scale, scale, scale);
      transform.updateMatrix();
      trunks.setMatrixAt(i, transform.matrix);
    }
    context.add(broadleaf, conifer, trunks);

    addContactShadow(contactShadows, materials, data.building.cx, data.building.cz, data.building.w * 0.53, data.building.d * 0.58, 0.8);
    addContactShadow(contactShadows, materials, data.facilities.shed.x, data.facilities.shed.z, 2.2, 1.7, 0.75);
    data.guestGarden.beds.forEach(bed => addContactShadow(contactShadows, materials, bed.x, bed.z, 1.4, 0.75, 0.55));
    data.trees.forEach(tree => addContactShadow(contactShadows, materials, tree.x, tree.z, tree.r * 0.7, tree.r * 0.5, 0.55));
    addContactShadow(contactShadows, materials, data.facilities.well.x, data.facilities.well.z, 0.8, 0.55, 0.5);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const environments = {};
    let environmentPeriod = '';
    function getEnvironment(period, quality) {
      const key = `${period}-${quality === 'high' ? 'high' : 'low'}`;
      if (!environments[key]) {
        const texture = environmentCanvas(period, quality === 'high' ? 1024 : 512);
        environments[key] = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
      }
      return environments[key];
    }

    let effectiveQuality = null;
    function setQuality(quality) {
      if (quality === effectiveQuality) return;
      effectiveQuality = quality;
      root.userData.qualityChangeCount = (root.userData.qualityChangeCount || 0) + 1;
      const high = quality === 'high';
      keyLight.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
      if (keyLight.shadow.map) {
        keyLight.shadow.map.dispose();
        root.userData.shadowMapDisposeCount = (root.userData.shadowMapDisposeCount || 0) + 1;
      }
      keyLight.shadow.map = null;
      broadleaf.count = high ? Math.min(92, broadleafIndex) : 42;
      conifer.count = high ? Math.min(46, coniferIndex) : 20;
      trunks.count = high ? 140 : 62;
      broadleaf.instanceMatrix.needsUpdate = conifer.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = true;
      environmentPeriod = '';
    }

    function update({ altitude, azimuth, mode, exposure }) {
      const daylight = Math.max(0, Math.min(1, (Math.sin(altitude) + 0.05) * 2.1));
      const twilight = Math.max(0, Math.min(1, 1 - Math.abs(altitude) / 0.28));
      const period = altitude < -0.01 ? 'night' : altitude < 0.22 ? 'twilight' : 'day';
      const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude), -Math.cos(azimuth) * Math.cos(altitude));
      skyMaterial.uniforms.sunDirection.value.copy(direction);
      skyMaterial.uniforms.daylight.value = daylight;
      skyMaterial.uniforms.twilight.value = twilight;
      if (mode === 'plan') {
        skyMaterial.uniforms.zenith.value.set(0xe8eeea);
        skyMaterial.uniforms.horizon.value.set(0xf4f0e8);
      } else if (period === 'night') {
        skyMaterial.uniforms.zenith.value.set(0x101a2d);
        skyMaterial.uniforms.horizon.value.set(0x344052);
      } else if (period === 'twilight') {
        skyMaterial.uniforms.zenith.value.set(0x4e7297);
        skyMaterial.uniforms.horizon.value.set(0xe7a17f);
      } else {
        skyMaterial.uniforms.zenith.value.set(0x5794c2);
        skyMaterial.uniforms.horizon.value.set(0xd9e2dc);
      }
      const radius = 120;
      keyLight.position.copy(direction).multiplyScalar(radius);
      keyLight.target.position.set(0, 0, 0);
      keyLight.color.set(period === 'twilight' ? 0xffb477 : period === 'night' ? 0x7890b0 : 0xfff1db);
      keyLight.intensity = mode === 'plan' ? 1.15 : period === 'night' ? 0.035 : 0.45 + 2.25 * Math.min(1, Math.sin(altitude) * 1.55);
      hemi.color.set(period === 'night' ? 0x61728f : period === 'twilight' ? 0xd5a28b : 0xcce2ee);
      hemi.groundColor.set(period === 'night' ? 0x252b35 : 0x62513d);
      hemi.intensity = mode === 'plan' ? 0.82 : 0.2 + 0.58 * daylight;
      ambient.intensity = mode === 'plan' ? 0.32 : 0.045 + 0.15 * daylight;
      sun.visible = glow.visible = mode === 'real' && altitude > -0.04;
      sun.position.copy(direction).multiplyScalar(52);
      glow.position.copy(sun.position);
      const exteriorLightLevel = mode === 'real' && altitude < 0.12 ? Math.min(32, (0.12 - altitude) * 180) : 0;
      entranceLight.intensity = exteriorLightLevel;
      guestLight.intensity = exteriorLightLevel * 0.55;
      contactShadows.visible = mode === 'real';
      renderer.toneMappingExposure = mode === 'plan' ? 1.05 : exposure * (period === 'night' ? 0.68 : 0.98);
      scene.fog.color.set(mode === 'plan' ? 0xe7ece8 : period === 'night' ? 0x222d3e : period === 'twilight' ? 0xb9998e : 0xa9c1c2);
      if (mode === 'plan') {
        scene.environment = null;
        environmentPeriod = '';
      }
      else if (period !== environmentPeriod) {
        scene.environment = getEnvironment(period, effectiveQuality);
        environmentPeriod = period;
      }
      root.userData.period = period;
      root.userData.lightCount = 5;
    }

    function setContextVisible(visible, mode) {
      context.visible = visible && mode === 'real';
    }

    setQuality('high');
    return Object.freeze({ root, context, sky, keyLight, hemi, ambient, mountainGeometries, setQuality, setContextVisible, update, environments });
  };
})(window);
