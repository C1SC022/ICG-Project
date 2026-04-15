window.CarCatalog = {
  selectedCarStorageKey: 'dragRace.selectedCar',
  specs: {
    car1: {
      vehicle: {
        mass: 1000,
        cx: 0.28,
        gears: [0, 0.4, 0.7, 1.0, 1.3, 1.5, 1.68],
        transmitionRatio: 0.17,
        transmitionLoss: 0.15,
        wheelDiameter: 0.5,
        brakeTorqueMax: 300
      },
      engine: {
        rpmIdle: 1200,
        rpmMax: 8000,
        rpmRedzone: 6500,
        torqueMin: 20,
        torqueMax: 45,
        torquePeak: 4500,
        torqueSigma: 1000
      },
      clutch: {
        revUpRate: 2500,
        idleReturnRate: 2,
        engageTime: 0.25,
        boostMultiplier: 400,
        slipDrag: 0.0008
      },
      initialState: { gear: 0, speed: 0 }
    }
  },
  getCarList() {
    return ['car1'];
  },
  getCarSpec(name) {
    return name === 'car1' ? this.specs.car1 : null;
  },
  getDefaultCarName() {
    return 'car1';
  },
  getSelectedCar() {
    return 'car1';
  },
  setSelectedCar(name) {
    if (name !== 'car1') return;
    try {
      window.localStorage.setItem(this.selectedCarStorageKey, name);
    } catch (err) {
      // Ignore storage failures (private mode / blocked storage).
    }
  },
  estimateTopSpeed(spec) {
    if (!spec || !spec.vehicle || !spec.engine) return 0;
    const topGear = spec.vehicle.gears[spec.vehicle.gears.length - 1] || 1;
    const wheelCirc = Math.PI * spec.vehicle.wheelDiameter;
    return (spec.engine.rpmMax / (spec.vehicle.transmitionRatio * topGear)) * wheelCirc * 60 / 1000;
  },
  getMetrics(spec) {
    if (!spec || !spec.vehicle || !spec.engine) {
      return { acceleration: 0, speed: 0, braking: 0, grip: 0, balance: 0 };
    }
    return {
      acceleration: spec.engine.torqueMax / spec.vehicle.mass,
      speed: this.estimateTopSpeed(spec),
      braking: spec.vehicle.brakeTorqueMax / spec.vehicle.mass,
      grip: 1 / spec.vehicle.cx,
      balance: spec.vehicle.mass / spec.vehicle.cx
    };
  },
  createCarMesh(THREE, name, spec, options = {}) {
    if (!THREE || !spec) return null;

    const catalog = this;
    const loaderClass = window.GLTFLoader;
    const mode = options.mode || 'default';

    if (!catalog._blenderCarQueue) {
      catalog._blenderCarQueue = [];
    }

    if (catalog._blenderCarTemplate) {
      const fromBlender = catalog._blenderCarTemplate.clone(true);
      fromBlender.scale.setScalar(mode === 'preview' ? 0.72 : 0.62);

      const bounds = new THREE.Box3().setFromObject(fromBlender);
      const center = bounds.getCenter(new THREE.Vector3());
      fromBlender.position.x -= center.x;
      fromBlender.position.z -= center.z;
      fromBlender.position.y -= bounds.min.y;

      const root = new THREE.Group();
      root.add(fromBlender);

      // Add vehicle lights from Blender mesh names.
      let frontMesh = null;
      let rearMesh = null;
      fromBlender.traverse(function(node) {
        if (!node.isMesh) return;
        if (node.name === 'Farol_F' || node.name.indexOf('Farol_F') >= 0) frontMesh = node;
        if (node.name === 'Farol_B' || node.name.indexOf('Farol_B') >= 0) rearMesh = node;
      });

      root.updateMatrixWorld(true);

      function hasEmissiveMaterial(mat) {
        return !!(mat && mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0));
      }

      function getLightAnchorBox(mesh) {
        if (!mesh) return null;

        const emissiveBox = new THREE.Box3();
        let hasEmissiveMesh = false;

        mesh.traverse(function(node) {
          if (!node.isMesh || !node.material) return;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          const isLightMaterial = materials.some((mat) => hasEmissiveMaterial(mat) || (mat && typeof mat.name === 'string' && mat.name.indexOf('Material.002') >= 0));
          if (!isLightMaterial) return;
          emissiveBox.expandByObject(node);
          hasEmissiveMesh = true;
        });

        return hasEmissiveMesh ? emissiveBox : new THREE.Box3().setFromObject(mesh);
      }

      if (frontMesh) {
        const box = getLightAnchorBox(frontMesh);
        const width = Math.max(0.25, box.max.x - box.min.x);
        const centerX = (box.min.x + box.max.x) * 0.5;
        const y = box.min.y + (box.max.y - box.min.y) * 0.86;
        const z = box.max.z - 0.01;

        let leftX = box.min.x + width * 0.06;
        let rightX = box.max.x - width * 0.06;
        if (rightX - leftX < 0.7) {
          leftX = centerX - 0.45;
          rightX = centerX + 0.45;
        }

        const leftPos = root.worldToLocal(new THREE.Vector3(leftX, y, z));
        const rightPos = root.worldToLocal(new THREE.Vector3(rightX, y, z));

        const frontIntensity = mode === 'preview' ? 1.4 : 2.1;
        const frontDistance = mode === 'preview' ? 7 : 18;

        const leftLight = new THREE.SpotLight(0xfff3cc, frontIntensity, frontDistance, Math.PI / 7, 0.5, 1.2);
        leftLight.castShadow = false;
        leftLight.position.copy(leftPos);
        leftLight.target.position.set(leftPos.x, leftPos.y - 0.04, leftPos.z + (mode === 'preview' ? 3 : 10));
        root.add(leftLight);
        root.add(leftLight.target);

        const rightLight = new THREE.SpotLight(0xfff3cc, frontIntensity, frontDistance, Math.PI / 7, 0.5, 1.2);
        rightLight.castShadow = false;
        rightLight.position.copy(rightPos);
        rightLight.target.position.set(rightPos.x, rightPos.y - 0.04, rightPos.z + (mode === 'preview' ? 3 : 10));
        root.add(rightLight);
        root.add(rightLight.target);

        const leftGlow = new THREE.PointLight(0xfff8de, mode === 'preview' ? 0.5 : 0.85, mode === 'preview' ? 3.4 : 5.6);
        leftGlow.position.copy(leftPos);
        root.add(leftGlow);

        const rightGlow = new THREE.PointLight(0xfff8de, mode === 'preview' ? 0.5 : 0.85, mode === 'preview' ? 3.4 : 5.6);
        rightGlow.position.copy(rightPos);
        root.add(rightGlow);
      }

      if (rearMesh) {
        const box = getLightAnchorBox(rearMesh);
        const width = Math.max(0.15, box.max.x - box.min.x);
        const height = Math.max(0.02, box.max.y - box.min.y);
        const rearZ = box.min.z + 0.03;
        const rearY = box.min.y + (box.max.y - box.min.y) * 0.55;
        const steps = 9;
        const xMargin = width * 0.05;
        const xStart = box.min.x + xMargin;
        const xEnd = box.max.x - xMargin;

        for (let i = 0; i < steps; i++) {
          const t = steps === 1 ? 0.5 : i / (steps - 1);
          const x = xStart + (xEnd - xStart) * t;
          const rearPos = root.worldToLocal(new THREE.Vector3(x, rearY, rearZ));
          const rearLight = new THREE.PointLight(0xff1b1b, mode === 'preview' ? 0.22 : 0.44, mode === 'preview' ? 2.6 : 4.4);
          rearLight.castShadow = false;
          rearLight.position.copy(rearPos);
          root.add(rearLight);
        }

        // Add a physical rear light bar so the taillight reads as a line, not only point lights.
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry((xEnd - xStart) * 0.98, Math.max(0.04, height * 0.38)),
          new THREE.MeshStandardMaterial({
            color: 0xff1f1f,
            emissive: 0xff1515,
            emissiveIntensity: mode === 'preview' ? 1.2 : 1.7,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
          })
        );
        const barCenter = root.worldToLocal(new THREE.Vector3((xStart + xEnd) * 0.5, rearY, rearZ + 0.002));
        bar.position.copy(barCenter);
        root.add(bar);
      }

      root.userData = { spec, name, source: 'blender' };
      return root;
    }

    if (!catalog._blenderCarLoading && loaderClass) {
      catalog._blenderCarLoading = true;
      const loader = new loaderClass();
      loader.load(
        '../blender_models/car1.gltf',
        function(gltf) {
          catalog._blenderCarTemplate = gltf.scene;
          catalog._blenderCarTemplate.traverse(function(node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          const callbacks = catalog._blenderCarQueue.slice();
          catalog._blenderCarQueue = [];
          catalog._blenderCarLoading = false;
          callbacks.forEach(function(cb) { cb(); });
        },
        undefined,
        function(error) {
          catalog._blenderCarLoading = false;
          catalog._blenderCarQueue = [];
          console.error('Failed to load blender car model car1.gltf', error);
        }
      );
    }

    if (typeof options.onModelLoaded === 'function') {
      catalog._blenderCarQueue.push(options.onModelLoaded);
    }

    return null;
  }
};
