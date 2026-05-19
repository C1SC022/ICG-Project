console.log('[multiplayer.js] Loaded.');

let motorSamplePath = 'https://freesound.org/data/previews/127/127980_2335231-lq.ogg';
let CAR_SPECS = {};

let Meter = function Meter($elm, config) {
	let $needle, $value, $windowLayer;
	let lastWindowMin = null, lastWindowMax = null;
	let steps = (config.valueMax - config.valueMin) / config.valueStep,
			angleStep = (config.angleMax - config.angleMin) / steps;
	let margin = 10;
	let value2angle = function(value) {
		return ((value / (config.valueMax - config.valueMin)) * (config.angleMax - config.angleMin) + config.angleMin);
	};
	this.setValue = function(v) {
		$needle.style.transform = "translate3d(-50%, 0, 0) rotate(" + Math.round(value2angle(v)) + "deg)";
		$value.innerHTML = config.needleFormat(v);
	};
	this.setWindow = function(minValue, maxValue, targetValue, currentValue) {
		if (!$windowLayer) return;
		if (minValue == null || maxValue == null) {
			$windowLayer.innerHTML = ""; lastWindowMin = null; lastWindowMax = null; return;
		}
		if (lastWindowMin === minValue && lastWindowMax === maxValue) return;
		lastWindowMin = minValue; lastWindowMax = maxValue;
		$windowLayer.innerHTML = "";
		let startValue = Math.max(config.valueMin, Math.min(minValue, maxValue));
		let endValue = Math.min(config.valueMax, Math.max(minValue, maxValue));
		let startAngle = value2angle(startValue);
		let endAngle = value2angle(endValue);
		for (let a = startAngle; a <= endAngle; a += 1.5) {
			makeElement($windowLayer, "shift-window-tick shift-window-tick--orange", "", {
				left: (50 - 47 * Math.sin(a * (Math.PI / 180))) + "%",
				top: (50 + 47 * Math.cos(a * (Math.PI / 180))) + "%",
				transform: "translate3d(-50%, 0, 0) rotate(" + (a + 180) + "deg)"
			});
		}
		if (typeof targetValue !== 'undefined') {
			let span = endValue - startValue;
			if (span > 0) {
				let cur = (typeof currentValue !== 'undefined') ? currentValue : targetValue;
				let distance = Math.abs(cur - targetValue);
				let closeness = Math.max(0, Math.min(1, 1 - distance / Math.max(1, span)));
				let greenSpan = Math.max(25, span * (0.5 * (1 - closeness)));
				let greenMin = Math.max(startValue, targetValue - greenSpan / 2);
				let greenMax = Math.min(endValue, targetValue + greenSpan / 2);
				let greenStartAngle = value2angle(greenMin);
				let greenEndAngle = value2angle(greenMax);
				for (let a = greenStartAngle; a <= greenEndAngle; a += 1.5) {
					makeElement($windowLayer, "shift-window-tick shift-window-tick--green", "", {
						left: (50 - 47 * Math.sin(a * (Math.PI / 180))) + "%",
						top: (50 + 47 * Math.cos(a * (Math.PI / 180))) + "%",
						transform: "translate3d(-50%, 0, 0) rotate(" + (a + 180) + "deg)"
					});
				}
			}
		}
	};
	let makeElement = function(parent, className, innerHtml, style) {
		let	e = document.createElement('div');
		e.className = className;
		if (innerHtml) e.innerHTML = innerHtml;
		if (style) { for (var prop in style) e.style[prop] = style[prop]; }
		parent.appendChild(e);
		return e;
	};
	makeElement($elm, "label label-unit", config.valueUnit);
	$windowLayer = makeElement($elm, "shift-window-layer");
	for (let n=0; n < steps+1; n++) {
		let value = config.valueMin + n * config.valueStep;
		let angle = config.angleMin + n * angleStep;
		let redzoneClass = value > config.valueRed ? " redzone" : "";
		makeElement($elm, "grad grad--" + n + redzoneClass, config.labelFormat(value), {
			left: (50 - (50 - margin) * Math.sin(angle * (Math.PI / 180))) + "%",
			top: (50 + (50 - margin) * Math.cos(angle * (Math.PI / 180))) + "%"
		});	
		makeElement($elm, "grad-tick grad-tick--" + n + redzoneClass, "", {
			left: (50 - 50 * Math.sin(angle * (Math.PI / 180))) + "%",
			top: (50 + 50 * Math.cos(angle * (Math.PI / 180))) + "%",
			transform: "translate3d(-50%, 0, 0) rotate(" + (angle + 180) + "deg)"
		});
        let angleHalf = angle + angleStep / 2;
        if (angleHalf < config.angleMax) {
            makeElement($elm, "grad-tick grad-tick--half grad-tick--" + n + redzoneClass, "", {
                left: (50 - 50 * Math.sin(angleHalf * (Math.PI / 180))) + "%",
                top: (50 + 50 * Math.cos(angleHalf * (Math.PI / 180))) + "%",
                transform: "translate3d(-50%, 0, 0) rotate(" + (angleHalf + 180) + "deg)"
            });
        }
        let angleQuarter = angle + angleStep / 4;
        if (angleQuarter < config.angleMax) {
            makeElement($elm, "grad-tick grad-tick--quarter grad-tick--" + n + redzoneClass, "", {
                left: (50 - 50 * Math.sin(angleQuarter * (Math.PI / 180))) + "%",
                top: (50 + 50 * Math.cos(angleQuarter * (Math.PI / 180))) + "%",
                transform: "translate3d(-50%, 0, 0) rotate(" + (angleQuarter + 180) + "deg)"
            });
        }
        let angleThreeQuarter = angle - angleStep / 2;
        if (angleThreeQuarter < config.angleMax) {
            makeElement($elm, "grad-tick grad-tick--quarter grad-tick--" + n + redzoneClass, "", {
                left: (50 - 50 * Math.sin(angleThreeQuarter * (Math.PI / 180))) + "%",
                top: (50 + 50 * Math.cos(angleThreeQuarter * (Math.PI / 180))) + "%",
                transform: "translate3d(-50%, 0, 0) rotate(" + (angleThreeQuarter + 180) + "deg)"
            });
        }
	}
	$needle = makeElement($elm, "needle", "", { transform: "translate3d(-50%, 0, 0) rotate(" + value2angle(config.value) + "deg)" });
	makeElement($elm, "needle-axle");
	makeElement($elm, "label label-value", "<div>" + config.labelFormat(config.value) + "</div>" + "<span>" + config.labelUnit + "</span>");
	$value = $elm.querySelector(".label-value div");
};

function initMultiApp() {
    const urlParams = new URLSearchParams(window.location.search);
    CAR_SPECS = (window.CarCatalog && window.CarCatalog.specs) ? window.CarCatalog.specs : {};
    const p1CarName = urlParams.get('p1') || 'car1';
    const p2CarName = urlParams.get('p2') || 'car2';

    // Centralized SoundManager loading for multiplayer
    let soundPath = '../sounds/car1.ogg';
    const p1Spec = CAR_SPECS[p1CarName];
    if (p1Spec && p1Spec.vehicle && p1Spec.vehicle.soundPath) {
        soundPath = p1Spec.vehicle.soundPath;
    }
    window.SoundManager.load(soundPath);
    window.SoundManager.setupVolumeButton();

    const RACE_COUNTDOWN_SECONDS = 5;
    const RACE_FINISH_DISTANCE_METERS = 400;

    class Player {
        constructor(id, carName, meterSelector, gearSelector) {
            this.id = id;
            this.carName = carName;
            this.spec = CAR_SPECS[carName] || CAR_SPECS.car1;
            this.gear = this.spec.initialState.gear;
            this.speed = this.spec.initialState.speed;
            this.rpm = this.spec.engine.rpmIdle;
            this.travelZ = 0;
            this.isAccelerating = false;
            this.isBraking = false;
            this.finished = false;
            this.finishTime = 0;
            this.mesh = null;
            this.rpmMeter = null;
            this.gearEl = document.querySelector(gearSelector + ' div');
            this.meterEl = document.querySelector(meterSelector);
            
            this.clutchTimer = 0;
            this.clutchTorqueBoost = 0;
            this.penaltyBrakeTimer = 0;
            this.penaltyBrakeLevel = 0;
            this.penaltyTorqueFactor = 1;

            this.shiftWindows = this.calculateShiftWindows();
            this.launchWindow = this.calculateLaunchWindow();
            
            this.initMeter();
        }

        torqueByRpm(r) {
            let x = (r - this.spec.engine.torquePeak) / this.spec.engine.torqueSigma;
            let gauss = Math.exp(-0.5 * x * x);
            return this.spec.engine.torqueMin + (this.spec.engine.torqueMax - this.spec.engine.torqueMin) * gauss;
        }

        calculateShiftWindows() {
            let windows = {};
            const maxGear = this.spec.vehicle.gears.length - 1;
            const { rpmIdle, rpmMax, rpmRedzone } = this.spec.engine;
            const { gears, transmitionRatio } = this.spec.vehicle;

            for (let g = 1; g < maxGear; g++) {
                let nextGear = g + 1;
                let shiftRpm = rpmMax;
                let foundCrossover = false;

                for (let testRpm = rpmIdle; testRpm <= rpmMax; testRpm += 25) {
                    let nextRpm = testRpm * gears[g] / gears[nextGear];
                    if (nextRpm < rpmIdle) continue;

                    let currentWheelTorque = this.torqueByRpm(testRpm) / (transmitionRatio * gears[g]);
                    let nextWheelTorque = this.torqueByRpm(nextRpm) / (transmitionRatio * gears[nextGear]);

                    if (nextWheelTorque >= currentWheelTorque) {
                        shiftRpm = testRpm;
                        foundCrossover = true;
                        break;
                    }
                }

                if (!foundCrossover) shiftRpm = rpmMax;

                if (shiftRpm >= rpmMax - 50) {
                    windows[g] = { min: Math.max(rpmRedzone, rpmMax - 450), max: rpmMax, target: shiftRpm };
                } else {
                    windows[g] = { min: Math.max(rpmIdle, shiftRpm - 200), max: Math.min(rpmMax, shiftRpm + 200), target: shiftRpm };
                }
            }
            return windows;
        }

        calculateLaunchWindow() {
            let firstGear = this.spec.vehicle.gears[1];
            if (!firstGear) return null;

            const { rpmIdle, rpmMax } = this.spec.engine;
            let maxLaunchTorque = -Infinity;
            let torqueSamples = [];

            for (let testRpm = rpmIdle; testRpm <= rpmMax; testRpm += 25) {
                let launchTorque = this.torqueByRpm(testRpm) / (this.spec.vehicle.transmitionRatio * firstGear);
                torqueSamples.push({ rpm: testRpm, torque: launchTorque });
                if (launchTorque > maxLaunchTorque) maxLaunchTorque = launchTorque;
            }

            let threshold = maxLaunchTorque * 0.95;
            let minRpm = rpmMax, maxRpm = rpmIdle, targetRpm = rpmMax;

            for (let i = 0; i < torqueSamples.length; i++) {
                if (torqueSamples[i].torque >= threshold) {
                    minRpm = Math.min(minRpm, torqueSamples[i].rpm);
                    maxRpm = Math.max(maxRpm, torqueSamples[i].rpm);
                }
            }
            for (let i = 0; i < torqueSamples.length; i++) {
                if (torqueSamples[i].torque === maxLaunchTorque) {
                    targetRpm = torqueSamples[i].rpm;
                    break;
                }
            }
            return { min: minRpm, max: maxRpm, target: targetRpm };
        }

        initMeter() {
            if (!this.meterEl) return;
            this.meterEl.innerHTML = "";
            this.rpmMeter = new Meter(this.meterEl, {
                value: this.spec.engine.rpmIdle,
                valueMin: 0,
                valueMax: this.spec.engine.rpmMax,
                valueStep: 1000,
                valueUnit: "<div>RPM</div><span>x1000</span>",
                angleMin: 30,
                angleMax: 330,
                labelUnit: "Km/h",
                labelFormat: (v) => Math.round(v / 1000),
                needleFormat: () => Math.round(this.speed),
                valueRed: this.spec.engine.rpmRedzone
            });
        }

        updateUI() {
            if (this.rpmMeter) this.rpmMeter.setValue(this.rpm);
            if (this.gearEl) {
                this.gearEl.innerHTML = (this.gear === 0) ? 'N' : this.gear;
                if (this.rpm > this.spec.engine.rpmRedzone) this.gearEl.classList.add('redzone');
                else this.gearEl.classList.remove('redzone');
            }
            this.updateShiftWindowUI();
        }

        updateShiftWindowUI() {
            if (!this.rpmMeter) return;
            if (this.gear === 0) {
                if (this.launchWindow) this.rpmMeter.setWindow(this.launchWindow.min, this.launchWindow.max, this.launchWindow.target, this.rpm);
            } else if (this.gear >= this.spec.vehicle.gears.length - 1) {
                this.rpmMeter.setWindow(null, null);
            } else {
                let sw = this.shiftWindows[this.gear];
                if (sw) this.rpmMeter.setWindow(sw.min, sw.max, sw.target, this.rpm);
                else this.rpmMeter.setWindow(null, null);
            }
        }

        setPenalty(level) {
            const SHIFT_PENALTY_BRAKE_LIGHT = 0.35;
            const SHIFT_PENALTY_BRAKE_HEAVY = 0.6;
            const SHIFT_PENALTY_DURATION_LIGHT = 0.2;
            const SHIFT_PENALTY_DURATION_HEAVY = 0.38;
            const SHIFT_PENALTY_TORQUE_LIGHT = 0.88;
            const SHIFT_PENALTY_TORQUE_HEAVY = 0.74;

            if (level === 'light') {
                this.penaltyBrakeTimer = Math.max(this.penaltyBrakeTimer, SHIFT_PENALTY_DURATION_LIGHT);
                this.penaltyBrakeLevel = Math.max(this.penaltyBrakeLevel, SHIFT_PENALTY_BRAKE_LIGHT);
                this.penaltyTorqueFactor = Math.min(this.penaltyTorqueFactor, SHIFT_PENALTY_TORQUE_LIGHT);
                return;
            }

            this.penaltyBrakeTimer = Math.max(this.penaltyBrakeTimer, SHIFT_PENALTY_DURATION_HEAVY);
            this.penaltyBrakeLevel = Math.max(this.penaltyBrakeLevel, SHIFT_PENALTY_BRAKE_HEAVY);
            this.penaltyTorqueFactor = Math.min(this.penaltyTorqueFactor, SHIFT_PENALTY_TORQUE_HEAVY);
        }

        gearUp() {
            if (raceState !== 'racing') return;
            if (this.gear < this.spec.vehicle.gears.length - 1) {
                const prev = this.gear;

                // Apply shifting penalty if shifting outside the optimal RPM window
                let sw = this.shiftWindows[prev];
                if (sw) {
                    if (this.rpm < sw.min) {
                        // Shifted too early (under-revving)
                        let diff = sw.min - this.rpm;
                        if (diff > 800) {
                            this.setPenalty('heavy');
                        } else {
                            this.setPenalty('light');
                        }
                    } else if (this.rpm > sw.max) {
                        // Shifted too late (over-revving/redlining)
                        let diff = this.rpm - sw.max;
                        if (diff > 500) {
                            this.setPenalty('heavy');
                        } else {
                            this.setPenalty('light');
                        }
                    }
                }

                this.gear++;
                this.engageGear(prev, this.gear);
            }
        }

        gearDown() {
            if (raceState !== 'racing') return;
            if (this.gear > 0) {
                const prev = this.gear;
                this.gear--;
                this.engageGear(prev, this.gear);
            }
        }

        engageGear(prevGear, nextGear) {
            if (prevGear === 0 && nextGear > 0) {
                let targetRpm = 0;
                if (this.spec.vehicle.gears[nextGear] !== 0) {
                    targetRpm = this.speed / (60 * this.spec.vehicle.transmitionRatio * this.spec.vehicle.gears[nextGear] * (Math.PI * this.spec.vehicle.wheelDiameter / 1000));
                }
                let rpmDiff = this.rpm - targetRpm;
                if (rpmDiff > 200) {
                    this.clutchTimer = this.spec.clutch.engageTime;
                    this.clutchTorqueBoost = (rpmDiff / this.spec.engine.rpmMax) * this.spec.clutch.boostMultiplier;
                } else if (rpmDiff < -200) {
                    this.speed = Math.max(0, this.speed - Math.abs(rpmDiff) * this.spec.clutch.slipDrag);
                }
            }
        }
    }

    let p1 = new Player('p1', p1CarName, '.meter--rpm.meter--p1', '.meter--gear.meter--p1');
    let p2 = new Player('p2', p2CarName, '.meter--rpm.meter--p2', '.meter--gear.meter--p2');

    let smokeParticles = [];
    function spawnSmoke(x, y, z) {
        const geom = new THREE.SphereGeometry(0.12, 5, 5);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        
        smokeParticles.push({
            mesh: mesh,
            opacity: 0.7,
            size: 0.12,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                0.5 + Math.random() * 0.5,
                2.0 + Math.random() * 1.5 // drifts backwards (towards +Z since car travels towards -Z)
            )
        });
    }

    let raceState = 'loading';
    let assetsLoaded = {
        p1Car: false,
        p2Car: false
    };

    function checkAllAssetsLoaded() {
        if (assetsLoaded.p1Car && assetsLoaded.p2Car) {
            if (raceState === 'loading') {
                raceState = 'countdown';
                document.getElementById('raceCountdown').classList.remove('hidden');
                
                // Play sounds for P1 and P2!
                window.SoundManager.getPlayer('p1').play(p1.rpm, p1.speed);
                window.SoundManager.getPlayer('p2').play(p2.rpm, p2.speed);
            }
        }
    }

    let countdownLeft = RACE_COUNTDOWN_SECONDS;
    let raceElapsedTime = 0;
    
    let scene, camera, renderer;
    const CAMERA_BASE_POS = { x: 8, y: 2.5, z: -125 };
    const CAR_BASE_POS_Z = -122;
    const STREAM_DIRECTION = -1;
    const STREAM_SEGMENT_LENGTH = 30;
    const STREAM_SEGMENT_COUNT = 3;
    const STREAM_STREET_LIGHT_PAIRS = 3;
    const STREAM_DECORATION_COUNT = 16;
    const STREAM_START_Z = -100;
    const STREAM_RECYCLE_BEHIND_DISTANCE = 45;
    const STREET_LIGHT_STEP = 20;
    const DECORATION_STEP = 8;
    let streamedRoadSegments = [];
    let streamedStreetLightPairs = [];
    let streamedDecorations = [];
    let policeLightRig, policeBlueLight, policeRedLight, policeBlueTarget, policeRedTarget, policeLightTime = 0;

    function initThree() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220);
        
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

        const mount = document.getElementById('three-container');
        if (mount) {
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            mount.appendChild(renderer.domElement);
        } else {
            renderer.domElement.style.position = 'fixed';
            renderer.domElement.style.left = '0';
            renderer.domElement.style.top = '0';
            renderer.domElement.style.zIndex = '0';
            document.body.appendChild(renderer.domElement);
        }

        setupAtmosphereLights();
        buildRoadAndLights();
        loadCarModels();

        // Add visual finish line
        const finishLineGeom = new THREE.PlaneGeometry(8.0, 0.4);
        const finishLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
        const finishLine = new THREE.Mesh(finishLineGeom, finishLineMat);
        finishLine.rotation.x = Math.PI / 2;
        // In multiplayer, travelZ moves negatively from CAR_BASE_POS_Z
        finishLine.position.set(0, -0.485, CAR_BASE_POS_Z - 400);
        scene.add(finishLine);
        
        const finishLineGlowGeom = new THREE.PlaneGeometry(8.0, 0.25);
        const finishLineGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
        const finishLineGlow = new THREE.Mesh(finishLineGlowGeom, finishLineGlowMat);
        finishLineGlow.position.set(0, -0.3, CAR_BASE_POS_Z - 400);
        scene.add(finishLineGlow);
    }

    function applySimScale(mesh) {
        if (mesh && !mesh.userData.simScaleApplied) {
            mesh.scale.multiplyScalar(2.2);
            mesh.userData.simScaleApplied = true;
        }
    }

    function loadCarModels() {
        if (typeof window.CarCatalog !== 'undefined') {
            const options1 = { mode: 'sim', onModelLoaded: () => {
                if(p1.mesh) scene.remove(p1.mesh);
                p1.mesh = window.CarCatalog.createCarMesh(THREE, p1.carName, p1.spec, { mode: 'sim' });
                if (p1.mesh) {
                    applySimScale(p1.mesh);
                    scene.add(p1.mesh);
                    assetsLoaded.p1Car = true;
                    checkAllAssetsLoaded();
                }
            }};
            p1.mesh = window.CarCatalog.createCarMesh(THREE, p1.carName, p1.spec, options1);
            if (p1.mesh) {
                applySimScale(p1.mesh);
                scene.add(p1.mesh);
                assetsLoaded.p1Car = true;
                checkAllAssetsLoaded();
            }

            const options2 = { mode: 'sim', onModelLoaded: () => {
                if(p2.mesh) scene.remove(p2.mesh);
                p2.mesh = window.CarCatalog.createCarMesh(THREE, p2.carName, p2.spec, { mode: 'sim' });
                if (p2.mesh) {
                    applySimScale(p2.mesh);
                    scene.add(p2.mesh);
                    assetsLoaded.p2Car = true;
                    checkAllAssetsLoaded();
                }
            }};
            p2.mesh = window.CarCatalog.createCarMesh(THREE, p2.carName, p2.spec, options2);
            if (p2.mesh) {
                applySimScale(p2.mesh);
                scene.add(p2.mesh);
                assetsLoaded.p2Car = true;
                checkAllAssetsLoaded();
            }
        }
    }

    function setupAtmosphereLights() {
		const moonLight = new THREE.DirectionalLight(0xb9c8ff, 0.55);
		moonLight.position.set(-35, 75, -65);
        moonLight.target.position.set(0, 0, 35);
		scene.add(moonLight); scene.add(moonLight.target);
		scene.add(new THREE.HemisphereLight(0x94a7ff, 0x10131d, 0.24));

        policeLightRig = new THREE.Group();
        policeLightRig.position.set(CAMERA_BASE_POS.x - 18, CAMERA_BASE_POS.y + 1.2, CAMERA_BASE_POS.z + 6);
        policeBlueLight = new THREE.SpotLight(0x3d79ff, 2.6, 1000, Math.PI/6, 0.5, 0.2);
        policeBlueLight.position.set(-3, 1.2, -6);
        policeRedLight = new THREE.SpotLight(0xff3344, 2.6, 1000, Math.PI/6, 0.5, 0.2);
        policeRedLight.position.set(-3.0, 1.6, -6);
        policeBlueTarget = new THREE.Object3D(); policeRedTarget = new THREE.Object3D();
        scene.add(policeBlueTarget); scene.add(policeRedTarget);
        policeBlueLight.target = policeBlueTarget; policeRedLight.target = policeRedTarget;
        policeLightRig.add(policeBlueLight); policeLightRig.add(policeRedLight);
        scene.add(policeLightRig);
    }

    function addStreetLightsFromModel() {
        const template = window.AssetManager.get('streetLight');
        if (!scene || !template) return;

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
            lampLight.position.copy(lightPos); 
            lampLight.position.y -= 0.4; // Move below the lamp housing
            
            // Point the spotlight downwards
            lampLight.target.position.set(lampLight.position.x, lampLight.position.y - 10, lampLight.position.z);
            streetLight.add(lampLight.target);

            lampLight.userData = { isLampLight: true };
            lampLight.visible = false;
            streetLight.add(lampLight);
        }

        for (let i = 0; i < STREAM_STREET_LIGHT_PAIRS; i++) {
            const pair = new THREE.Group();
            pair.position.z = STREAM_START_Z + i * STREET_LIGHT_STEP * (-STREAM_DIRECTION);
            const l = template.clone(true); l.position.set(-5.1, -0.5, 0); l.rotation.y = Math.PI*1.5; l.scale.setScalar(0.5);
            const r = template.clone(true); r.position.set(5.1, -0.5, 0); r.rotation.y = Math.PI/2; r.scale.setScalar(0.5);
            attachLampLight(l); attachLampLight(r);
            pair.add(l); pair.add(r);
            scene.add(pair); streamedStreetLightPairs.push(pair);
        }
    }

    function addDecorationsFromModels() {
        if (!scene) return;
        const propNames = ['caixas', 'hidrante', 'lixo', 'lixo2'];
        const buildingNames = ['build', 'build2'];
        const side = -1;

        for (let i = 0; i < STREAM_DECORATION_COUNT; i++) {
            const group = new THREE.Group();
            group.position.z = STREAM_START_Z + i * DECORATION_STEP * (-STREAM_DIRECTION);
            group.position.y = -0.5;

            const bName = buildingNames[i % buildingNames.length];
            const house = window.AssetManager.get(bName);
            if (house) {
                house.scale.setScalar(1.2 + Math.random() * 0.5);
                house.position.x = side * 12.5;
                group.add(house);
            }

            const usedPositions = [];
            const numProps = 3 + Math.floor(Math.random() * 4);
            for (let j = 0; j < numProps; j++) {
                const pName = propNames[Math.floor(Math.random() * propNames.length)];
                const prop = window.AssetManager.get(pName);
                if (prop) {
                    prop.scale.setScalar(0.6);
                    prop.rotation.y = Math.random() * Math.PI * 2;
                    let attempts = 0, placed = false;
                    while (attempts < 15 && !placed) {
                        const px = side * (8.5 + Math.random() * 2.0);
                        const pz = (Math.random() - 0.5) * 7.5;
                        const tooClose = usedPositions.some(pos => Math.sqrt((pos.x - px)**2 + (pos.z - pz)**2) < 1.8);
                        if (!tooClose) {
                            prop.position.set(px, 0, pz); group.add(prop);
                            usedPositions.push({x: px, z: pz}); placed = true;
                        }
                        attempts++;
                    }
                }
            }
            scene.add(group); streamedDecorations.push(group);
        }
    }

    function buildRoadAndLights() {
        const texLoader = new THREE.TextureLoader();
        const asphaltTex = texLoader.load('../textures/asphalt.jpg');
        asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
        asphaltTex.repeat.set(2, 4);

        const sidewalkTex = texLoader.load('../textures/139-stone-block-wall-pbr-texture-seamless-hr-1488102640.jpg');
        if (sidewalkTex) {
            sidewalkTex.wrapS = sidewalkTex.wrapT = THREE.RepeatWrapping;
            sidewalkTex.repeat.set(1, 10);
        }

        const roadMat = new THREE.MeshPhongMaterial({ color: 0x444444, map: asphaltTex, specular: 0x222222, shininess: 10, reflectivity: 0.1 });
        const shoulderMat = new THREE.MeshLambertMaterial({ color: 0x27292e });
        const sideLineMat = new THREE.MeshLambertMaterial({ color: 0xf7f7f7 });
        const centerLineMat = new THREE.MeshLambertMaterial({ color: 0xffd54a });
        const sidewalkMat = new THREE.MeshLambertMaterial({ color: sidewalkTex ? 0xffffff : 0x888888, map: sidewalkTex });

        for (let i = 0; i < STREAM_SEGMENT_COUNT; i++) {
            const segment = new THREE.Group();
            segment.position.z = STREAM_START_Z + i * STREAM_SEGMENT_LENGTH * (-STREAM_DIRECTION);
            const road = new THREE.Mesh(new THREE.PlaneGeometry(8, STREAM_SEGMENT_LENGTH), roadMat);
            road.rotation.x = -Math.PI / 2; road.position.set(0, -0.49, STREAM_SEGMENT_LENGTH/2); road.receiveShadow = true;
            segment.add(road);
            [-6.2, 6.2].forEach(x => {
                const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(4, STREAM_SEGMENT_LENGTH), shoulderMat);
                shoulder.rotation.x = -Math.PI / 2; shoulder.position.set(x, -0.495, STREAM_SEGMENT_LENGTH/2); shoulder.receiveShadow = true;
                segment.add(shoulder);
            });
            [-10.2, 10.2].forEach(x => {
                const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(4, STREAM_SEGMENT_LENGTH), sidewalkMat);
                sidewalk.rotation.x = -Math.PI / 2; sidewalk.position.set(x, -0.49, STREAM_SEGMENT_LENGTH/2); sidewalk.receiveShadow = true;
                segment.add(sidewalk);
            });
            [-3.8, 3.8].forEach(x => {
                const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, STREAM_SEGMENT_LENGTH), sideLineMat);
                line.rotation.x = -Math.PI / 2; line.position.set(x, -0.485, STREAM_SEGMENT_LENGTH/2);
                segment.add(line);
            });
            for (let lz = 1.6; lz < STREAM_SEGMENT_LENGTH; lz += 7) {
                const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.2), centerLineMat);
                dash.rotation.x = -Math.PI / 2; dash.position.set(0, -0.482, lz);
                segment.add(dash);
            }
            scene.add(segment);
            streamedRoadSegments.push(segment);
        }
        addStreetLightsFromModel();
        addDecorationsFromModels();
    }

    function updatePhysics(p, delta) {
        if (p.finished) {
            p.brakeTorque = p.spec.vehicle.brakeTorqueMax;
        } else {
            if (p.penaltyBrakeTimer > 0) {
                p.penaltyBrakeTimer = Math.max(0, p.penaltyBrakeTimer - delta);
                p.brakeTorque = p.spec.vehicle.brakeTorqueMax * p.penaltyBrakeLevel;
            } else {
                p.penaltyBrakeLevel = 0; p.penaltyTorqueFactor = 1; p.brakeTorque = 0;
            }
        }

        if (raceState === 'racing' && p.isAccelerating && p.rpm < p.spec.engine.rpmMax) {
            p.torque = p.torqueByRpm(p.rpm);
        } else {
            p.torque = -(p.rpm * p.rpm / 1000000);
        }

        if (p.spec.vehicle.gears[p.gear] === 0) {
            p.overallRatio = 0;
            p.wheelTorque = -p.brakeTorque;
            p.acceleration = 20 * p.wheelTorque / (p.spec.vehicle.wheelDiameter * p.spec.vehicle.mass / 2);
            p.resistance = 0.5 * 1.2 * p.spec.vehicle.cx * ((p.speed / 3.6) ^ 2);
        } else {
            p.overallRatio = p.spec.vehicle.transmitionRatio * p.spec.vehicle.gears[p.gear];
            p.wheelTorque = p.torque / p.overallRatio - p.brakeTorque;
            if (raceState === 'racing' && p.penaltyTorqueFactor < 1) p.wheelTorque *= p.penaltyTorqueFactor;
            if (p.clutchTimer > 0) {
                p.wheelTorque += p.clutchTorqueBoost;
                p.clutchTimer = Math.max(0, p.clutchTimer - delta);
                if (p.clutchTimer === 0) p.clutchTorqueBoost = 0;
            }
            p.acceleration = 20 * p.wheelTorque / (p.spec.vehicle.wheelDiameter * p.spec.vehicle.mass / 2);
            p.resistance = 0.5 * 1.2 * p.spec.vehicle.cx * ((p.speed / 3.6) ^ 2);
        }

        p.speed += (p.acceleration - p.resistance) * delta;
        if (p.speed < 0) p.speed = 0;
        if (raceState === 'finished') p.speed = 0;

        if (p.spec.vehicle.gears[p.gear] === 0) {
            if (p.isAccelerating) p.rpm += p.spec.clutch.revUpRate * delta;
            else p.rpm += (p.spec.engine.rpmIdle - p.rpm) * p.spec.clutch.idleReturnRate * delta;
            if (p.rpm < 600) p.rpm = 600;
            if (p.rpm > p.spec.engine.rpmMax) p.rpm = p.spec.engine.rpmMax;
        } else {
            p.rpm = p.speed / (60 * p.spec.vehicle.transmitionRatio * p.spec.vehicle.gears[p.gear] * (Math.PI * p.spec.vehicle.wheelDiameter / 1000));
        }

        if (p.rpm < p.spec.engine.rpmIdle) p.rpm = p.spec.engine.rpmIdle;
        if (raceState === 'finished') p.rpm = p.spec.engine.rpmIdle;

        p.travelZ += (p.speed / 3.6) * delta * STREAM_DIRECTION;
        if (!p.finished && (Math.abs(p.travelZ) + 2.25) >= RACE_FINISH_DISTANCE_METERS) {
            p.finished = true; p.finishTime = raceElapsedTime; checkWinner();
        }
    }

    function checkWinner() {
        if (p1.finished || p2.finished) {
            if (raceState === 'finished') return;
            
            const winner = p1.finished ? p1 : p2;
            const winnerLabel = p1.finished ? "PLAYER 1" : "PLAYER 2";
            
            document.getElementById('raceWinner').textContent = `${winnerLabel} WINS`;
            document.getElementById('raceFinishTime').textContent = `Time: ${winner.finishTime.toFixed(2)}s`;
            document.getElementById('raceFinish').classList.remove('hidden');
            raceState = 'finished';
            
            // Stop both players' engine sounds!
            window.SoundManager.stopAll();
        }
    }

    let lastTime = performance.now();
    function loop() {
        requestAnimationFrame(loop);
        let now = performance.now(), delta = (now - lastTime) / 1000; lastTime = now;

        if (raceState === 'countdown') {
            countdownLeft = Math.max(0, countdownLeft - delta);
            document.getElementById('raceCountdown').textContent = Math.ceil(countdownLeft);
            p1.gear = 0; p1.speed = 0; p1.isBraking = false;
            p2.gear = 0; p2.speed = 0; p2.isBraking = false;
            if (countdownLeft <= 0) { 
                raceState = 'racing'; document.getElementById('raceCountdown').classList.add('hidden'); 
                p1.gear = 1; p2.gear = 1; 
            }
        } else if (raceState === 'racing') {
            raceElapsedTime += delta;
            p1.isAccelerating = true; p1.isBraking = false;
            p2.isAccelerating = true; p2.isBraking = false;
        }

        updatePhysics(p1, delta); updatePhysics(p2, delta);
        p1.updateUI(); p2.updateUI();

        // Update audio playback rates based on dynamic RPM and Speed
        window.SoundManager.getPlayer('p1').update(p1.rpm, p1.speed);
        window.SoundManager.getPlayer('p2').update(p2.rpm, p2.speed);

        const leaderZ = Math.min(p1.travelZ, p2.travelZ); // travelZ is negative, so min() is further ahead
        const gap = Math.abs(p1.travelZ - p2.travelZ);

        camera.position.set(CAMERA_BASE_POS.x, CAMERA_BASE_POS.y, CAMERA_BASE_POS.z + leaderZ);
        
        let targetFov = 60;
        if (gap < 45) {
            targetFov = 60 + Math.min(gap * 0.7, 30);
        } else {
            targetFov = 60; // Fixed max FOV when far apart
        }
        
        if (typeof camera.fov !== 'undefined') {
            camera.fov += (targetFov - camera.fov) * delta * 4;
        } else {
            camera.fov = targetFov;
        }
        camera.updateProjectionMatrix();
        
        camera.lookAt(-300, -60, 10 + leaderZ);

        if (p1.mesh) { 
            p1.mesh.position.set(2, -0.5, CAR_BASE_POS_Z + p1.travelZ); 
            p1.mesh.rotation.y = Math.PI; 
            if (p1.mesh.userData.wheels && p1.spec) {
                const radius = p1.spec.vehicle.wheelDiameter / 2;
                const v_ms = p1.speed / 3.6;
                const angularVelocity = v_ms / radius;
                p1.mesh.userData.wheels.forEach(wheel => {
                    const axleName = wheel.userData.axleName || 'x';
                    wheel.rotation[axleName] += angularVelocity * delta;
                });
            }
        }
        if (p2.mesh) { 
            p2.mesh.position.set(-2, -0.5, CAR_BASE_POS_Z + p2.travelZ); 
            p2.mesh.rotation.y = Math.PI; 
            if (p2.mesh.userData.wheels && p2.spec) {
                const radius = p2.spec.vehicle.wheelDiameter / 2;
                const v_ms = p2.speed / 3.6;
                const angularVelocity = v_ms / radius;
                p2.mesh.userData.wheels.forEach(wheel => {
                    const axleName = wheel.userData.axleName || 'x';
                    wheel.rotation[axleName] += angularVelocity * delta;
                });
            }
        }

        const recycleBehindZ = camera.position.z + STREAM_RECYCLE_BEHIND_DISTANCE;
        [streamedRoadSegments, streamedStreetLightPairs, streamedDecorations].forEach(pool => {
            if (!pool.length) return;
            let minZ = Infinity; pool.forEach(s => { if (s.position.z < minZ) minZ = s.position.z; });
            pool.forEach(s => { if (s.position.z > recycleBehindZ) { 
                const step = (pool === streamedRoadSegments ? 30 : (pool === streamedStreetLightPairs ? 20 : DECORATION_STEP));
                s.position.z = minZ - step; 
                minZ = s.position.z; 
            } });
        });

        if (camera) {
            const activeDistance = 150;
            streamedStreetLightPairs.forEach(pair => {
                const dist = Math.abs(pair.position.z - camera.position.z);
                const isActive = dist < activeDistance;
                pair.traverse(node => {
                    if (node.userData.isLampLight) node.visible = isActive;
                });
            });
        }

        policeLightTime += delta;
        const trailingZ = Math.max(p1.travelZ, p2.travelZ);
        const policeTargetZ = CAR_BASE_POS_Z + trailingZ;
        // Positioned further back (65 units instead of 28)
        policeLightRig.position.set(0, 1.5, policeTargetZ + 65);
        policeBlueTarget.position.set(0, 0.7, policeTargetZ + 0.6);
        policeRedTarget.position.set(0, 0.7, policeTargetZ + 0.6);
        const nearIntensity = 5.5 * (0.35 + 0.65 * Math.max(0, Math.sin(policeLightTime * 10.5)));
        const bluePhase = (policeLightTime % 0.72) < 0.36;
        policeBlueLight.intensity = bluePhase ? nearIntensity : 0.03;
        policeRedLight.intensity = bluePhase ? 0.03 : nearIntensity;

        // Spawn tire smoke for Player 1 if shifting penalty is active (rear wheels spin)
        if (raceState === 'racing' && p1.penaltyBrakeTimer > 0 && p1.mesh && p1.mesh.userData.wheels) {
            let sortedWheels = [...p1.mesh.userData.wheels].map(w => {
                let pos = new THREE.Vector3();
                w.getWorldPosition(pos);
                return { wheel: w, z: pos.z, pos: pos };
            }).sort((a, b) => b.z - a.z); // b.z - a.z: larger Z comes first (rear wheels since car travels to -Z)
            
            if (sortedWheels.length >= 2) {
                for (let k = 0; k < 2; k++) {
                    spawnSmoke(sortedWheels[0].pos.x, sortedWheels[0].pos.y - 0.2, sortedWheels[0].pos.z);
                    spawnSmoke(sortedWheels[1].pos.x, sortedWheels[1].pos.y - 0.2, sortedWheels[1].pos.z);
                }
            }
        }

        // Spawn tire smoke for Player 2 if shifting penalty is active (rear wheels spin)
        if (raceState === 'racing' && p2.penaltyBrakeTimer > 0 && p2.mesh && p2.mesh.userData.wheels) {
            let sortedWheels = [...p2.mesh.userData.wheels].map(w => {
                let pos = new THREE.Vector3();
                w.getWorldPosition(pos);
                return { wheel: w, z: pos.z, pos: pos };
            }).sort((a, b) => b.z - a.z); // b.z - a.z: larger Z comes first (rear wheels since car travels to -Z)
            
            if (sortedWheels.length >= 2) {
                for (let k = 0; k < 2; k++) {
                    spawnSmoke(sortedWheels[0].pos.x, sortedWheels[0].pos.y - 0.2, sortedWheels[0].pos.z);
                    spawnSmoke(sortedWheels[1].pos.x, sortedWheels[1].pos.y - 0.2, sortedWheels[1].pos.z);
                }
            }
        }

        // Update active smoke particles
        for (let i = smokeParticles.length - 1; i >= 0; i--) {
            let p = smokeParticles[i];
            p.mesh.position.addScaledVector(p.velocity, delta);
            p.opacity -= delta * 1.5;
            p.size += delta * 0.8;
            
            p.mesh.material.opacity = Math.max(0, p.opacity);
            p.mesh.scale.setScalar(p.size / 0.12);
            
            if (p.opacity <= 0) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                smokeParticles.splice(i, 1);
            }
        }

        renderer.render(scene, camera);
    }

    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'w') p1.isAccelerating = true; if (k === 'd') p1.gearUp(); if (k === 'a') p1.gearDown();
        if (e.key === 'ArrowUp') p2.isAccelerating = true; if (e.key === 'ArrowRight') p2.gearUp(); if (e.key === 'ArrowLeft') p2.gearDown();
    });
    window.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() === 'w') p1.isAccelerating = false; if (e.key === 'ArrowUp') p2.isAccelerating = false;
    });

    // Touch controls for multiplayer (Split screen)
    function handleMultiStart(clientX) {
        if (clientX < window.innerWidth / 2) {
            if (raceState === 'racing') p1.gearUp();
            else p1.isAccelerating = true;
        } else {
            if (raceState === 'racing') p2.gearUp();
            else p2.isAccelerating = true;
        }
    }

    function handleMultiEnd(clientX) {
        if (clientX < window.innerWidth / 2) p1.isAccelerating = false;
        else p2.isAccelerating = false;
    }

    window.addEventListener('touchstart', (e) => {
        if (e.target.closest && (e.target.closest('#restartRaceBtn') || e.target.closest('#menuRaceBtn') || e.target.closest('.btn-volume') || e.target.closest('.race-btn'))) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            handleMultiStart(e.changedTouches[i].clientX);
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (e.target.closest && (e.target.closest('#restartRaceBtn') || e.target.closest('#menuRaceBtn') || e.target.closest('.btn-volume') || e.target.closest('.race-btn'))) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            handleMultiEnd(e.changedTouches[i].clientX);
        }
    }, { passive: false });

    window.addEventListener('touchcancel', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            handleMultiEnd(e.changedTouches[i].clientX);
        }
    }, { passive: false });

    window.addEventListener('mousedown', (e) => {
        if (e.target.closest && (e.target.closest('#restartRaceBtn') || e.target.closest('#menuRaceBtn') || e.target.closest('.btn-volume') || e.target.closest('.race-btn'))) return;
        handleMultiStart(e.clientX);
    });

    window.addEventListener('mouseup', (e) => {
        if (e.target.closest && (e.target.closest('#restartRaceBtn') || e.target.closest('#menuRaceBtn') || e.target.closest('.btn-volume') || e.target.closest('.race-btn'))) return;
        handleMultiEnd(e.clientX);
    });

    document.getElementById('restartRaceBtn').onclick = () => window.location.reload();
    document.getElementById('menuRaceBtn').onclick = () => window.location.href = '../index.html';

    initThree();
    loop();
}

initMultiApp();
