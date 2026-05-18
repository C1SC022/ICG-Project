window.CarCatalog = {
  selectedCarStorageKey: 'dragRace.selectedCar',
  specs: {
    car1: {
      vehicle: {
        soundPath: '../sounds/car1.ogg',
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
    },
    car2: {
      vehicle: {
        soundPath: '../sounds/car1.ogg',
        mass: 1200,
        cx: 0.32,
        gears: [0, 0.45, 0.75, 1.05, 1.35, 1.55, 1.75],
        transmitionRatio: 0.18,
        transmitionLoss: 0.15,
        wheelDiameter: 0.52,
        brakeTorqueMax: 350
      },
      engine: {
        rpmIdle: 1000,
        rpmMax: 9000,
        rpmRedzone: 8200,
        torqueMin: 25,
        torqueMax: 58,
        torquePeak: 6500,
        torqueSigma: 1200
      },
      clutch: {
        revUpRate: 3000,
        idleReturnRate: 2.2,
        engageTime: 0.22,
        boostMultiplier: 450,
        slipDrag: 0.0007
      },
      initialState: { gear: 0, speed: 0 }
    },
    car3: {
      vehicle: {
        soundPath: '../sounds/car1.ogg',
        mass: 1100,
        cx: 0.30,
        gears: [0, 0.42, 0.72, 1.02, 1.32, 1.52, 1.65],
        transmitionRatio: 0.175,
        transmitionLoss: 0.15,
        wheelDiameter: 0.51,
        brakeTorqueMax: 330
      },
      engine: {
        rpmIdle: 1100,
        rpmMax: 8200,
        rpmRedzone: 7000,
        torqueMin: 23,
        torqueMax: 52,
        torquePeak: 4800,
        torqueSigma: 1150
      },
      clutch: {
        revUpRate: 2750,
        idleReturnRate: 2.1,
        engageTime: 0.24,
        boostMultiplier: 425,
        slipDrag: 0.00075
      },
      initialState: { gear: 0, speed: 0 }
    }
  },
  getCarList() {
    return ['car1', 'car2', 'car3'];
  },
  getCarSpec(name) {
    return this.specs[name] || null;
  },
  getDefaultCarName() {
    return 'car1';
  },
  getSelectedCar() {
    try {
      return window.localStorage.getItem(this.selectedCarStorageKey) || 'car1';
    } catch (e) {
      return 'car1';
    }
  },
  setSelectedCar(name) {
    if (!this.specs[name]) return;
    try {
      window.localStorage.setItem(this.selectedCarStorageKey, name);
    } catch (err) {
      // Ignore storage failures
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
    const mode = options.mode || 'default';

    if (!catalog._carQueues) catalog._carQueues = {};
    if (!catalog._carTemplates) catalog._carTemplates = {};
    if (!catalog._carLoading) catalog._carLoading = {};
    
    if (catalog._carTemplates[name]) {
      const fromModel = catalog._carTemplates[name].clone(true);

      // Normalize scale so both cars have roughly the same length (z-axis)
      // Use only meshes for bounding box to avoid "exploded" models caused by far pivots or helpers
      let meshBounds = new THREE.Box3();
      fromModel.traverse(node => { 
          if (node.isMesh) {
              // Ensure geometry bounding box is up to date
              if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
              meshBounds.expandByObject(node); 
          }
      });

      let size = meshBounds.getSize(new THREE.Vector3());
      let center = meshBounds.getCenter(new THREE.Vector3());
            // Align car3 with car1 (it's modeled sideways/differently)
      

      // Center the model
      fromModel.position.x -= center.x;
      fromModel.position.y -= center.y;
      fromModel.position.z -= center.z;

      const targetLength = 4.5; // Reduced from 4.8 to better match the other cars
      const currentLength = size.z > 0 ? size.z : 1;
      const normalizationScale = targetLength / currentLength;
      const baseModeScale = (mode === 'preview' ? 0.72 : 0.62);
      
      fromModel.scale.setScalar(normalizationScale * baseModeScale);

      // Re-calculate bounds after scaling to place on ground
      const normBounds = new THREE.Box3().setFromObject(fromModel);
      fromModel.position.y -= normBounds.min.y;

      const root = new THREE.Group();
      root.add(fromModel);
      root.updateMatrixWorld(true); // Force matrix update so descendant world coordinates are correctly scaled and translated

      // Add vehicle lights
      let frontMesh = null;
      let rearMesh = null;
      const frontLightPositions = [];

      fromModel.traverse(function(node) {
        if (!node.isMesh) return;
        
        // Ensure double sided rendering for all parts
        if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach(m => {
                m.side = THREE.DoubleSide;
                
                // Special for car2: make red_light and glass materials glow
                if (name === 'car2' && m.name) {
                    const mn = m.name.toLowerCase();
                    if (mn.indexOf('red_light') >= 0) {
                        if (mode === 'preview') {
                            m.emissive = new THREE.Color(0xff0000);
                            m.emissiveIntensity = 1.0;
                        } else {
                            m.emissive = new THREE.Color(0x000000);
                            m.emissiveIntensity = 0.0;
                        }
                    }
                    if (mn.indexOf('glass') >= 0) {
                        // Headlights
                        m.emissive = new THREE.Color(0xffffff);
                        m.emissiveIntensity = mode === 'preview' ? 0.5 : 1.5;
                    }
                }
            });
        }

        const n = node.name.toLowerCase();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        const hasFrontMat = materials.some(m => m.name && (m.name.toLowerCase().indexOf('glass') >= 0 || m.name.toLowerCase().indexOf('headlight') >= 0));
        const hasRearMat = materials.some(m => m.name && (m.name.toLowerCase().indexOf('red_light') >= 0 || m.name.toLowerCase().indexOf('taillight') >= 0));

        // Updated search terms for Dodge Charger and other models
        const isFront = hasFrontMat || n.indexOf('farol_f') >= 0 || n.indexOf('headlight') >= 0;
        const isRear = hasRearMat || n.indexOf('farol_b') >= 0 || n.indexOf('taillight') >= 0 || n.indexOf('arka') >= 0;

        if (isFront) {
          if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
          const localCenter = node.geometry.boundingBox.getCenter(new THREE.Vector3());
          node.updateMatrixWorld(true);
          const carLocalPos = localCenter.clone().applyMatrix4(node.matrixWorld);
          frontLightPositions.push(carLocalPos);
        }

        if (isFront && !frontMesh) frontMesh = node;
        if (isRear && !rearMesh) rearMesh = node;
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
          const isLightMaterial = materials.some((mat) => 
            hasEmissiveMaterial(mat) || 
            (mat && mat.name && (
                mat.name.indexOf('Led') >= 0 || 
                mat.name.indexOf('Light') >= 0 || 
                mat.name.indexOf('red_light') >= 0 || 
                mat.name.indexOf('glass') >= 0 ||
                mat.name.indexOf('Material.002') >= 0
            ))
          );
          if (!isLightMaterial) return;
          emissiveBox.expandByObject(node);
          hasEmissiveMesh = true;
        });

        return hasEmissiveMesh ? emissiveBox : new THREE.Box3().setFromObject(mesh);
      }

      let leftPos = null;
      let rightPos = null;
      const zBumper = (targetLength * baseModeScale) / 2 - 0.7; // Fallback bumper position

      if (frontLightPositions.length >= 2) {
        // Sort by X coordinate (negative is left, positive is right)
        frontLightPositions.sort((a, b) => a.x - b.x);
        
        // Take the left-most and right-most detected headlight meshes
        leftPos = frontLightPositions[0];
        rightPos = frontLightPositions[frontLightPositions.length - 1];
      } else if (frontLightPositions.length === 1) {
        // Single headlight mesh containing both lights, split it by width
        const pos = frontLightPositions[0];
        const box = getLightAnchorBox(frontMesh);
        const width = Math.max(0.25, box.max.x - box.min.x);
        leftPos = new THREE.Vector3(pos.x - width * 0.35, pos.y, pos.z);
        rightPos = new THREE.Vector3(pos.x + width * 0.35, pos.y, pos.z);
      } else {
        // Fallback headlight positions if no headlight meshes are detected
        leftPos = new THREE.Vector3(-0.45, 0.42, zBumper);
        rightPos = new THREE.Vector3(0.45, 0.42, zBumper);
      }

      // Configured for a premium headlight beam that starts bright and diffuses smoothly over 40 meters
      const frontIntensity = mode === 'preview' ? 35 : 65;
      const frontDistance = 40;
      const frontAngle = 0.52; // Focused beam
      const frontPenumbra = 0.85; // High diffusion at the edges
      const frontDecay = 1.6; // Soft, smooth physical decay

      const leftLight = new THREE.SpotLight(0xfff3cc, frontIntensity, frontDistance, frontAngle, frontPenumbra, frontDecay);
      leftLight.position.copy(leftPos);
      leftLight.target.position.set(leftPos.x, leftPos.y - 0.4, leftPos.z + 5); // Aimed slightly down and forward
      root.add(leftLight);
      root.add(leftLight.target);

      const rightLight = new THREE.SpotLight(0xfff3cc, frontIntensity, frontDistance, frontAngle, frontPenumbra, frontDecay);
      rightLight.position.copy(rightPos);
      rightLight.target.position.set(rightPos.x, rightPos.y - 0.4, rightPos.z + 5); // Aimed slightly down and forward
      root.add(rightLight);
      root.add(rightLight.target);

      if (rearMesh && mode === 'preview') {
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
          rearLight.position.copy(rearPos);
          root.add(rearLight);
        }

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

      // Find wheels for animation
      const wheels = [];
      fromModel.traverse(node => {
        if (node.isMesh) {
          const n = node.name.toLowerCase();
          if (n.indexOf('wheel') >= 0 || n.indexOf('whell') >= 0 || n.indexOf('tire') >= 0 || n.indexOf('lastik') >= 0 || n.indexOf('jant') >= 0 || n.indexOf('teker') >= 0 || n.indexOf('circle') >= 0 || n === 'fw' || n === 'bw') {
            
            // Fix pivot so the wheel rotates around its own center
            if (node.geometry) {
              node.geometry.computeBoundingBox();
              const center = node.geometry.boundingBox.getCenter(new THREE.Vector3());
              
              node.geometry = node.geometry.clone();
              node.geometry.translate(-center.x, -center.y, -center.z);
              
              const offset = center.clone();
              offset.x *= node.scale.x;
              offset.y *= node.scale.y;
              offset.z *= node.scale.z;
              
              
              offset.applyEuler(node.rotation);
              node.position.add(offset);

              
            }

            node.userData.axleName = (name === 'car3') ? 'y' : 'x';
            wheels.push(node);
          }
        }
      });

      root.userData = { spec, name, source: 'model', wheels: wheels };
      return root;
    }

    if (!catalog._carLoading[name]) {
      catalog._carLoading[name] = true;
      catalog._carQueues[name] = catalog._carQueues[name] || [];
      
      let loader;
      let modelPath;
      
      if (name === 'car2' && window.GLTFLoader) {
        loader = new window.GLTFLoader();
        modelPath = '../blender_models/car2/Dodge Charger.glb';
      } 
      
      if (name === 'car1' && window.GLTFLoader) {
        loader = new window.GLTFLoader();
        modelPath = '../blender_models/car1.gltf';
      }

      if (name === 'car3' && window.GLTFLoader) {
        loader = new window.GLTFLoader();
        modelPath = '../blender_models/car3/LowPolyCars.gltf';
      }

      if (loader && modelPath) {
          loader.load(modelPath, function(result) {
            const scene = result.scene || result.library?.visual_scenes?.[0] || result;
            catalog._carTemplates[name] = scene;
            scene.traverse(function(node) {
              if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(m => m.side = THREE.DoubleSide);
                    } else {
                        node.material.side = THREE.DoubleSide;
                    }
                }
              }
            });
            const callbacks = catalog._carQueues[name].slice();
            catalog._carQueues[name] = [];
            catalog._carLoading[name] = false;
            callbacks.forEach((cb) => cb());
          }, undefined, function(err) {
            console.error('Failed to load car model', modelPath, err);
            catalog._carLoading[name] = false;
          });
      }
    }

    if (typeof options.onModelLoaded === 'function') {
      catalog._carQueues[name] = catalog._carQueues[name] || [];
      catalog._carQueues[name].push(options.onModelLoaded);
    }

    return null;
  }
};
