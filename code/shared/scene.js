// Scene — shared Three.js world building and update helpers.
// Depends on: window.THREE, window.AssetManager, window.GAME_CONSTANTS

window.GameScene = {
    /**
     * Creates and mounts a WebGL renderer. Returns { scene, camera, renderer }.
     * @param {string|null} containerId  DOM id to mount into (or full-window if null)
     * @param {number} fov
     */
    initThree(containerId, fov = 60) {
        const C = window.GAME_CONSTANTS;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 220);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const mount = containerId ? document.getElementById(containerId) : null;
        if (mount) {
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            mount.appendChild(renderer.domElement);
        } else {
            Object.assign(renderer.domElement.style, { position: 'fixed', left: '0', top: '0', zIndex: '0' });
            document.body.appendChild(renderer.domElement);
        }

        window.addEventListener('resize', () => {
            if (!camera || !renderer) return;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        return { scene, camera, renderer };
    },

    /**
     * Sets up moon directional light (with shadows) + hemisphere fill + police strobe.
     * Returns { moonLight, moonFillLight, policeLightRig, policeBlueLight, policeRedLight,
     *           policeBlueTarget, policeRedTarget }
     * @param {THREE.Scene} scene
     * @param {object} shadowFrustumSize  { d } — half-extent of ortho shadow camera
     * @param {{ x, y, z }} initialTarget  World position the light starts pointing at
     */
    setupAtmosphereLights(scene, shadowFrustumSize, initialTarget) {
        const d = (shadowFrustumSize && shadowFrustumSize.d) || 8;
        const tgt = initialTarget || { x: 0, y: -0.5, z: -122 };
        const C = window.GAME_CONSTANTS;

        const moonLight = new THREE.DirectionalLight(0xb9c8ff, 0.55);
        moonLight.position.set(tgt.x - 35, tgt.y + 75, tgt.z - 65);
        moonLight.target.position.set(tgt.x, tgt.y, tgt.z);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 1024;
        moonLight.shadow.mapSize.height = 1024;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 180;
        moonLight.shadow.camera.left = -d;
        moonLight.shadow.camera.right = d;
        moonLight.shadow.camera.top = d;
        moonLight.shadow.camera.bottom = -d;
        moonLight.shadow.camera.updateProjectionMatrix();
        moonLight.shadow.bias = -0.001;
        scene.add(moonLight);
        scene.add(moonLight.target);

        const moonFillLight = new THREE.HemisphereLight(0x94a7ff, 0x10131d, 0.24);
        scene.add(moonFillLight);

        // Police strobe rig
        const camBase = C.CAMERA_BASE_POS;
        const policeLightRig = new THREE.Group();
        policeLightRig.position.set(camBase.x - 18, camBase.y + 1.2, camBase.z + 6);

        const policeBlueLight = new THREE.SpotLight(0x3d79ff, 2.6, 1000, Math.PI / 6, 0.5, 0.2);
        policeBlueLight.position.set(-3, 1.2, -6);
        const policeRedLight = new THREE.SpotLight(0xff3344, 2.6, 1000, Math.PI / 6, 0.5, 0.2);
        policeRedLight.position.set(-3.0, 1.6, -6);

        const policeBlueTarget = new THREE.Object3D();
        const policeRedTarget = new THREE.Object3D();
        scene.add(policeBlueTarget);
        scene.add(policeRedTarget);
        policeBlueLight.target = policeBlueTarget;
        policeRedLight.target = policeRedTarget;
        policeLightRig.add(policeBlueLight);
        policeLightRig.add(policeRedLight);
        scene.add(policeLightRig);

        return { moonLight, moonFillLight, policeLightRig, policeBlueLight, policeRedLight, policeBlueTarget, policeRedTarget };
    },

    /**
     * Updates police strobe and moon light position each frame.
     * @param {object} lights  Return value of setupAtmosphereLights
     * @param {object} target  { x, y, z } — world position of car (or midpoint in multiplayer)
     * @param {object} policeTarget  { x, y, z } — world position for police lights
     * @param {number} policeLightTime  Accumulated time for blink cycle
     */
    updateAtmosphereLights(lights, target, policeTarget, policeLightTime) {
        const { moonLight, moonFillLight, policeBlueLight, policeRedLight, policeBlueTarget, policeRedTarget, policeLightRig } = lights;
        if (!moonLight) return;

        moonLight.position.set(target.x - 35, target.y + 75, target.z - 65);
        moonLight.target.position.set(target.x, target.y, target.z);
        moonLight.intensity = 0.48 + 0.06 * Math.sin(policeLightTime * 0.25);
        if (moonFillLight) moonFillLight.intensity = 0.22 + 0.03 * Math.sin(policeLightTime * 0.2);

        if (policeLightRig) {
            policeLightRig.position.set(policeTarget.x, policeTarget.y + 2.0, policeTarget.z + 65);
            policeBlueTarget.position.set(policeTarget.x, policeTarget.y + 0.7, policeTarget.z + 0.6);
            policeRedTarget.position.set(policeTarget.x, policeTarget.y + 0.7, policeTarget.z + 0.6);
        }
        const bluePhase = (policeLightTime % 0.72) < 0.36;
        const pulse = 5.5 * (0.35 + 0.65 * Math.max(0, Math.sin(policeLightTime * 10.5)));
        policeBlueLight.intensity = bluePhase ? pulse : 0.03;
        policeRedLight.intensity = bluePhase ? 0.03 : pulse;
    },

    /**
     * Builds road segments, street lights, and decorations. Populates the provided pool arrays.
     * @param {THREE.Scene} scene
     * @param {{ roadSegments, streetLightPairs, decorations }} pools  Arrays to push objects into
     */
    buildRoadAndLights(scene, pools) {
        const C = window.GAME_CONSTANTS;
        const texLoader = new THREE.TextureLoader();

        const asphaltTex = texLoader.load('../textures/asphalt.jpg');
        asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
        asphaltTex.repeat.set(2, 4);

        const sidewalkTex = texLoader.load('../textures/139-stone-block-wall-pbr-texture-seamless-hr-1488102640.jpg');
        if (sidewalkTex) {
            sidewalkTex.wrapS = sidewalkTex.wrapT = THREE.RepeatWrapping;
            sidewalkTex.repeat.set(1, 10);
        }

        const roadMat = new THREE.MeshPhongMaterial({ color: 0x444444, map: asphaltTex, specular: 0x222222, shininess: 10 });
        const shoulderMat = new THREE.MeshLambertMaterial({ color: 0x27292e });
        const sideLineMat = new THREE.MeshLambertMaterial({ color: 0xf7f7f7 });
        const centerLineMat = new THREE.MeshLambertMaterial({ color: 0xffd54a });
        const sidewalkMat = new THREE.MeshLambertMaterial({ color: sidewalkTex ? 0xffffff : 0x888888, map: sidewalkTex });

        // Clear old segments
        pools.roadSegments.forEach(s => scene.remove(s));
        pools.roadSegments.length = 0;

        const segLen = C.STREAM_SEGMENT_LENGTH;
        const dir = C.STREAM_DIRECTION;

        // Reusable geometries to save memory/FPS
        const roadGeo = new THREE.PlaneGeometry(8, segLen);
        const shoulderGeo = new THREE.PlaneGeometry(4, segLen);
        const sidewalkGeo = new THREE.BoxGeometry(12.45, 0.2, segLen);
        const sideLineGeo = new THREE.PlaneGeometry(0.12, segLen);
        const dashGeo = new THREE.PlaneGeometry(0.14, 3.2);

        for (let i = 0; i < C.STREAM_SEGMENT_COUNT; i++) {
            const segment = new THREE.Group();
            segment.position.z = C.STREAM_START_Z + i * segLen * (-dir);

            const road = new THREE.Mesh(roadGeo, roadMat);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, -0.49, segLen / 2);
            road.receiveShadow = true;
            segment.add(road);

            [-6.2, 6.2].forEach(x => {
                const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
                shoulder.rotation.x = -Math.PI / 2;
                shoulder.position.set(x, -0.495, segLen / 2);
                shoulder.receiveShadow = true;
                segment.add(shoulder);
            });
            [-10.2, 10.2].forEach(x => {
                const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
                sidewalk.position.set(x, -0.44, segLen / 2);
                sidewalk.receiveShadow = true;
                sidewalk.castShadow = false; // Essential for performance
                segment.add(sidewalk);
            });
            [-3.8, 3.8].forEach(x => {
                const sideLine = new THREE.Mesh(sideLineGeo, sideLineMat);
                sideLine.rotation.x = -Math.PI / 2;
                sideLine.position.set(x, -0.485, segLen / 2);
                segment.add(sideLine);
            });
            for (let lz = 1.6; lz < segLen; lz += 7) {
                const dash = new THREE.Mesh(dashGeo, centerLineMat);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(0, -0.482, lz);
                segment.add(dash);
            }
            scene.add(segment);
            pools.roadSegments.push(segment);
        }

        this._addStreetLights(scene, pools);
        this._addDecorations(scene, pools);
    },

    _addStreetLights(scene, pools) {
        const C = window.GAME_CONSTANTS;
        const template = window.AssetManager.get('streetLight');
        if (!scene || !template) return;

        pools.streetLightPairs.forEach(p => scene.remove(p));
        pools.streetLightPairs.length = 0;

        function attachLampLight(streetLight) {
            let lampMesh = null;
            streetLight.traverse(node => {
                if (lampMesh || !node.isMesh || !node.material) return;
                const mat = node.material;
                const hasEmissive = mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0);
                if (hasEmissive || mat.name === 'Material.002') lampMesh = node;
            });
            if (!lampMesh) return;

            streetLight.updateMatrixWorld(true);
            lampMesh.geometry.computeBoundingBox();
            const localCenter = lampMesh.geometry.boundingBox.getCenter(new THREE.Vector3());
            const worldCenter = lampMesh.localToWorld(localCenter.clone());
            const lightPos = streetLight.worldToLocal(worldCenter.clone());

            const lampLight = new THREE.SpotLight(0xffe8b0, 20, 60, Math.PI / 3, 0.5, 1);
            lampLight.castShadow = false;
            lampLight.position.copy(lightPos);
            lampLight.position.y -= 0.4;
            lampLight.target.position.set(lampLight.position.x, lampLight.position.y - 10, lampLight.position.z);
            streetLight.add(lampLight.target);
            lampLight.userData = { isLampLight: true };
            lampLight.visible = false;
            streetLight.add(lampLight);
        }

        for (let i = 0; i < C.STREAM_STREET_LIGHT_PAIRS; i++) {
            const pair = new THREE.Group();
            pair.position.z = C.STREAM_START_Z + i * C.STREET_LIGHT_STEP * (-C.STREAM_DIRECTION);

            const l = template.clone(true);
            l.position.set(-5.1, -0.34, 0); l.rotation.y = Math.PI * 1.5; l.scale.setScalar(0.5);
            attachLampLight(l);

            const r = template.clone(true);
            r.position.set(5.1, -0.34, 0); r.rotation.y = Math.PI / 2; r.scale.setScalar(0.5);
            attachLampLight(r);

            pair.add(l); pair.add(r);
            scene.add(pair);
            pools.streetLightPairs.push(pair);
        }
    },

    _addDecorations(scene, pools) {
        const C = window.GAME_CONSTANTS;
        if (!scene) return;

        pools.decorations.forEach(d => scene.remove(d));
        pools.decorations.length = 0;

        const buildingNames = ['build', 'build2'];
        const side = -1; // buildings/props on the left side

        // Fixed prop layout (group-local coords, building at x = side*12.5 = -12.5):
        //
        //  x=-9.8  z=±1.8  → lixo/lixo2 : flanking the staircase entrance
        //  x=-9.2  z=-3.5  → hidrante   : near the street-light zone at group edge
        //  x=-11.5 z= 3.0  → caixas     : open sidewalk space beside building facade
        //
        const FIXED_PROPS = [
            { name: 'lixo',    x: side * 8,  z: -1.8, ry: Math.PI * 0.5  },
            { name: 'lixo2',   x: side * 9.4,  z:  1.5, ry: Math.PI * 1.5  },
            { name: 'hidrante', x: side - 9, z: -3.5, ry: Math.PI * 0.5              },
            { name: 'caixas',  x: side - 8, z:  4.5, ry: Math.PI * 0.25 },
        ];

        for (let i = 0; i < C.STREAM_DECORATION_COUNT; i++) {
            const group = new THREE.Group();
            group.position.z = C.STREAM_START_Z + i * C.DECORATION_STEP * (-C.STREAM_DIRECTION);
            group.position.y = -0.34;

            const house = window.AssetManager.get(buildingNames[i % buildingNames.length]);
            if (house) {
                house.scale.setScalar(1.2 + Math.random() * 0.5);
                house.position.x = side * 12.5;
                group.add(house);
            }

            for (const def of FIXED_PROPS) {
                const prop = window.AssetManager.get(def.name);
                if (!prop) continue;
                prop.scale.setScalar(0.6);
                prop.rotation.y = def.ry;
                prop.position.set(def.x, 0, def.z);
                group.add(prop);
            }

            scene.add(group);
            pools.decorations.push(group);
        }
    },

    /**
     * Recycles a pool of 3D objects that have moved behind the camera.
     */

    recycleStreamPool(pool, spacing, camera) {
        const C = window.GAME_CONSTANTS;
        if (!pool.length || !camera) return;

        const recycleBehindZ = camera.position.z + C.STREAM_RECYCLE_BEHIND_DISTANCE;
        let minZ = Infinity;
        for (const obj of pool) { if (obj.position.z < minZ) minZ = obj.position.z; }
        for (const obj of pool) {
            if (obj.position.z > recycleBehindZ) {
                obj.position.z = minZ - spacing;
                minZ = obj.position.z;
            }
        }
    },

    /**
     * Updates visibility of lamp lights based on distance to camera.
     */
    updateStreetLightVisibility(streetLightPairs, camera) {
        if (!camera) return;
        const activeDistance = 150;
        streetLightPairs.forEach(pair => {
            const isActive = Math.abs(pair.position.z - camera.position.z) < activeDistance;
            pair.traverse(node => {
                if (node.userData.isLampLight) node.visible = isActive;
            });
        });
    },

    /**
     * Spawns a smoke particle at the given world position.
     * @param {THREE.Scene} scene
     * @param {Array} particles  Array to push particle into
     */
    spawnSmoke(scene, particles, x, y, z) {
        const geom = new THREE.SphereGeometry(0.12, 5, 5);
        const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7, depthWrite: false });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        particles.push({
            mesh,
            opacity: 0.7,
            size: 0.12,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                0.5 + Math.random() * 0.5,
                2.0 + Math.random() * 1.5
            )
        });
    },

    /**
     * Updates all smoke particles, removing expired ones.
     * @param {THREE.Scene} scene
     * @param {Array} particles
     * @param {number} delta  Seconds since last frame
     */
    updateSmoke(scene, particles, delta) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.mesh.position.addScaledVector(p.velocity, delta);
            p.opacity -= delta * 1.5;
            p.size += delta * 0.8;
            p.mesh.material.opacity = Math.max(0, p.opacity);
            p.mesh.scale.setScalar(p.size / 0.12);
            if (p.opacity <= 0) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                particles.splice(i, 1);
            }
        }
    },

    /**
     * Spawns smoke from the rear wheels of a mesh if penalty is active.
     */
    spawnWheelSmoke(scene, particles, mesh, penaltyBrakeTimer, raceState) {
        if (raceState !== 'racing' || penaltyBrakeTimer <= 0 || !mesh || !mesh.userData.wheels) return;
        const sortedWheels = [...mesh.userData.wheels].map(w => {
            const pos = new THREE.Vector3();
            w.getWorldPosition(pos);
            return { pos };
        }).sort((a, b) => b.pos.z - a.pos.z);

        if (sortedWheels.length >= 2) {
            for (let k = 0; k < 2; k++) {
                this.spawnSmoke(scene, particles, sortedWheels[0].pos.x, sortedWheels[0].pos.y - 0.2, sortedWheels[0].pos.z);
                this.spawnSmoke(scene, particles, sortedWheels[1].pos.x, sortedWheels[1].pos.y - 0.2, sortedWheels[1].pos.z);
            }
        }
    },

    /**
     * Creates a visual finish line at the given Z position.
     */
    createFinishLine(scene, z) {
        const finishLine = new THREE.Mesh(
            new THREE.PlaneGeometry(8.0, 0.4),
            new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
        );
        finishLine.rotation.x = Math.PI / 2;
        finishLine.position.set(0, -0.485, z);
        scene.add(finishLine);

        const finishGlow = new THREE.Mesh(
            new THREE.PlaneGeometry(8.0, 0.25),
            new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
        );
        finishGlow.position.set(0, -0.3, z);
        scene.add(finishGlow);
    }
};
