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

    function createBlackBackgroundTexture(sourceTexture) {
      if (!sourceTexture || !sourceTexture.image || !sourceTexture.image.width || !sourceTexture.image.height) {
        return sourceTexture;
      }

      const image = sourceTexture.image;
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext('2d');
      if (!context) return sourceTexture;

      context.drawImage(image, 0, 0);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3] / 255;
        pixels[i] = Math.round(pixels[i] * alpha);
        pixels[i + 1] = Math.round(pixels[i + 1] * alpha);
        pixels[i + 2] = Math.round(pixels[i + 2] * alpha);
        pixels[i + 3] = 255;
      }
      context.putImageData(imageData, 0, 0);

      const blackTexture = new THREE.CanvasTexture(canvas);
      blackTexture.needsUpdate = true;
      blackTexture.flipY = sourceTexture.flipY;
      blackTexture.wrapS = sourceTexture.wrapS;
      blackTexture.wrapT = sourceTexture.wrapT;
      blackTexture.magFilter = sourceTexture.magFilter;
      blackTexture.minFilter = sourceTexture.minFilter;
      blackTexture.anisotropy = sourceTexture.anisotropy;
      blackTexture.repeat.copy(sourceTexture.repeat);
      blackTexture.offset.copy(sourceTexture.offset);
      blackTexture.center.copy(sourceTexture.center);
      blackTexture.rotation = sourceTexture.rotation;
      if ('colorSpace' in sourceTexture) blackTexture.colorSpace = sourceTexture.colorSpace;
      if ('encoding' in sourceTexture) blackTexture.encoding = sourceTexture.encoding;
      return blackTexture;
    }

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
              node.castShadow = true;
              node.receiveShadow = true;
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
                
                // Fix for car1 wheels rendering white due to transparent PNG being rendered as opaque
                if (name === 'car1' && m.name) {
                    const mn = m.name.toLowerCase();
                    if (mn.indexOf('material.004') >= 0 || mn.indexOf('material.003') >= 0) {
                    if (m.map) {
                      m.map = createBlackBackgroundTexture(m.map);
                      m.map.needsUpdate = true;
                    }
                    m.transparent = false;
                    m.alphaTest = 0;
                    m.opacity = 1;
                        m.needsUpdate = true;
                    }
                }
                
                // (Removed car2-specific material tweaks)
            });
        }

        const n = node.name.toLowerCase();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        const materialNames = materials
          .map((m) => (m && m.name ? m.name.toLowerCase() : ''))
          .filter(Boolean);

        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        const localCenter = node.geometry.boundingBox.getCenter(new THREE.Vector3());
        node.updateMatrixWorld(true);
        const carLocalPos = localCenter.clone().applyMatrix4(node.matrixWorld);

        const hasFrontMat = materialNames.some((mn) =>
          mn.indexOf('headlight') >= 0 ||
          mn.indexOf('farol') >= 0 ||
          mn.indexOf('farois') >= 0 ||
          mn.indexOf('front_light') >= 0
        );
        const hasRearMat = materialNames.some((mn) =>
          mn.indexOf('red_light') >= 0 ||
          mn.indexOf('taillight') >= 0 ||
          mn.indexOf('rear_light') >= 0 ||
          mn.indexOf('brake') >= 0
        );

        const nameLooksLikeLight =
          n.indexOf('farol') >= 0 ||
          n.indexOf('farois') >= 0 ||
          n.indexOf('headlight') >= 0 ||
          n.indexOf('taillight') >= 0 ||
          n.indexOf('light') >= 0;
        const hasFrontTag =
          n.indexOf('farol_f') >= 0 ||
          n.indexOf('front') >= 0 ||
          n.indexOf('frente') >= 0 ||
          n.indexOf('headlight') >= 0;
        const hasRearTag =
          n.indexOf('farol_b') >= 0 ||
          n.indexOf('rear') >= 0 ||
          n.indexOf('back') >= 0 ||
          n.indexOf('trase') >= 0 ||
          n.indexOf('taillight') >= 0 ||
          n.indexOf('arka') >= 0;

        // If name/material says "light" but not explicitly front/rear, infer by Z side.
        const zIsFront = carLocalPos.z >= 0;
        const isFront = hasFrontTag || hasFrontMat || (nameLooksLikeLight && !hasRearTag && zIsFront);
        const isRear = hasRearTag || hasRearMat || (nameLooksLikeLight && !hasFrontTag && !zIsFront);

        if (isFront) {
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

      // Convert detected world positions into root-local coordinates so we reliably
      // place lights relative to the car regardless of model orientation.
      leftPos = root.worldToLocal(leftPos.clone());
      rightPos = root.worldToLocal(rightPos.clone());

      // Force the Z of headlights to the front-most Z of the normalized model bounds
      // to avoid placing lights inside/behind the car when models have inverted axes.
      const modelFrontZ = normBounds.max.z;
      const clampFrontZ = modelFrontZ - 0.12; // a little inset from the bumper
      leftPos.z = clampFrontZ;
      rightPos.z = clampFrontZ;

      // Make sure headlights are not below the model ground
      const minY = normBounds.min.y + 0.18;
      leftPos.y = Math.max(leftPos.y, minY);
      rightPos.y = Math.max(rightPos.y, minY);

      const frontCenterZ = (leftPos.z + rightPos.z) / 2;
      const frontDir = frontCenterZ >= 0 ? 1 : -1;

      // Brighter, wider and softer-decay beams (closer to the old highly visible setup)
      const frontIntensity = mode === 'preview' ? 2.5 : 4.5;
      const frontDistance = mode === 'preview' ? 6 : 18;
      const frontAngle = 1.08;
      const frontPenumbra = 0.5;
      const frontDecay = 0.25;
      const headlightNudgeForward = -0.05;
      const headlightNudgeUp = 0.01;

      const leftLight = new THREE.SpotLight(0xfff3cc, frontIntensity, frontDistance, frontAngle, frontPenumbra, frontDecay);
      leftLight.position.set(leftPos.x, leftPos.y + headlightNudgeUp, leftPos.z + frontDir * headlightNudgeForward);
      leftLight.target.position.set(leftPos.x, leftPos.y - 0.2, leftPos.z + frontDir * (mode === 'preview' ? 3.5 : 5.5));
      root.add(leftLight);
      root.add(leftLight.target);

      const rightLight = new THREE.SpotLight(0xfff3cc, frontIntensity, frontDistance, frontAngle, frontPenumbra, frontDecay);
      rightLight.position.set(rightPos.x, rightPos.y + headlightNudgeUp, rightPos.z + frontDir * headlightNudgeForward);
      rightLight.target.position.set(rightPos.x, rightPos.y - 0.2, rightPos.z + frontDir * (mode === 'preview' ? 3.5 : 5.5));
      root.add(rightLight);
      root.add(rightLight.target);

      // Small local glow so headlights remain visible even when beam angle/terrain hides the cone.
      const leftGlow = new THREE.PointLight(0xfff0c2, mode === 'preview' ? 0.3 : 0.5, mode === 'preview' ? 3 : 5, 1.1);
      leftGlow.position.set(leftPos.x, leftPos.y + headlightNudgeUp, leftPos.z + frontDir * headlightNudgeForward);
      root.add(leftGlow);

      const rightGlow = new THREE.PointLight(0xfff0c2, mode === 'preview' ? 0.3 : 0.5, mode === 'preview' ? 3 : 5, 1.1);
      rightGlow.position.set(rightPos.x, rightPos.y + headlightNudgeUp, rightPos.z + frontDir * headlightNudgeForward);
      root.add(rightGlow);

      // Optional debug helpers: call createCarMesh with { debugLights: true }
      if (options.debugLights) {
        try {
          const slhL = new THREE.SpotLightHelper(leftLight);
          const slhR = new THREE.SpotLightHelper(rightLight);
          const plhL = new THREE.PointLightHelper(leftGlow, 0.06);
          const plhR = new THREE.PointLightHelper(rightGlow, 0.06);
          root.add(slhL);
          root.add(slhR);
          root.add(plhL);
          root.add(plhR);
          // log positions for quick inspection
          console.log('CarCatalog headlights', name, { leftPos, rightPos, modelFrontZ });
        } catch (e) {
          // helpers might not be available in some minimal builds; ignore
        }
      }

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
