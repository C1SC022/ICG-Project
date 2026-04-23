console.log('[game.js] Loaded. THREE available:', typeof THREE !== 'undefined');

let motorSamplePath = 'https://freesound.org/data/previews/127/127980_2335231-lq.ogg';

const CAR_SPECS = (window.CarCatalog && window.CarCatalog.specs) ? window.CarCatalog.specs : {};
if (!window.CarCatalog) {
	window.CarCatalog = {
		specs: CAR_SPECS,
		getCarList: function() { return Object.keys(CAR_SPECS); },
		getCarSpec: function(name) { return CAR_SPECS[name] || null; }
	};
}

// METER

let Meter = function Meter($elm, config) {
	
	// DOM
	let $needle, $value, $windowLayer;
	let lastWindowMin = null, lastWindowMax = null;
	
	// Others
	
	let steps = (config.valueMax - config.valueMin) / config.valueStep,
			angleStep = (config.angleMax - config.angleMin) / steps;
	
	let margin = 10; // in %
	let angle = 0; // in degrees
	
	let value2angle = function(value) {
		let angle = ((value / (config.valueMax - config.valueMin)) * (config.angleMax - config.angleMin) + config.angleMin);

		return angle;
	};
	
	this.setValue = function(v) {
		$needle.style.transform = "translate3d(-50%, 0, 0) rotate(" + Math.round(value2angle(v)) + "deg)";
		$value.innerHTML = config.needleFormat(v);
	};

	this.setWindow = function(minValue, maxValue, targetValue, currentValue) {
		if (!$windowLayer) {
			return;
		}

		if (minValue == null || maxValue == null) {
			$windowLayer.innerHTML = "";
			lastWindowMin = null;
			lastWindowMax = null;
			return;
		}

		if (lastWindowMin === minValue && lastWindowMax === maxValue) {
			return;
		}

		lastWindowMin = minValue;
		lastWindowMax = maxValue;
		$windowLayer.innerHTML = "";

		let startValue = Math.max(config.valueMin, Math.min(minValue, maxValue));
		let endValue = Math.min(config.valueMax, Math.max(minValue, maxValue));
		let startAngle = value2angle(startValue);
		let endAngle = value2angle(endValue);

		// Draw the full window in orange first
		for (let a = startAngle; a <= endAngle; a += 1.5) {
			makeElement($windowLayer, "shift-window-tick shift-window-tick--orange", "", {
				left: (50 - 47 * Math.sin(a * (Math.PI / 180))) + "%",
				top: (50 + 47 * Math.cos(a * (Math.PI / 180))) + "%",
				transform: "translate3d(-50%, 0, 0) rotate(" + (a + 180) + "deg)"
			});
		}

		// If target is provided, draw a shrinking green window centered on the target
		if (typeof targetValue !== 'undefined') {
			let span = endValue - startValue;
			if (span > 0) {
				let cur = (typeof currentValue !== 'undefined') ? currentValue : targetValue;
				let distance = Math.abs(cur - targetValue);
				let closeness = Math.max(0, Math.min(1, 1 - distance / Math.max(1, span)));
				// greenSpan shrinks as closeness -> 1. Minimum 25 RPM wide.
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
	
	let switchLabel = function(e) {
		e.target.closest(".meter").classList.toggle('meter--big-label');
	};
	
	let makeElement = function(parent, className, innerHtml, style) {

		let	e = document.createElement('div');
		e.className = className;

		if (innerHtml) {
			e.innerHTML = innerHtml;
		}

		if (style) {
			for (var prop in style) {
				e.style[prop] = style[prop];
			}
		}

		parent.appendChild(e);
		
		return e;
	};

	// Label unit
	makeElement($elm, "label label-unit", config.valueUnit);
	$windowLayer = makeElement($elm, "shift-window-layer");

	for (let n=0; n < steps+1; n++) {
		let value = config.valueMin + n * config.valueStep;
		angle = config.angleMin + n * angleStep;
		
		// Graduation numbers
		
		// Red zone
		let redzoneClass = "";
		if (value > config.valueRed) {
			redzoneClass = " redzone";
		}
		
		makeElement($elm, "grad grad--" + n + redzoneClass, config.labelFormat(value), {
			left: (50 - (50 - margin) * Math.sin(angle * (Math.PI / 180))) + "%",
			top: (50 + (50 - margin) * Math.cos(angle * (Math.PI / 180))) + "%"
		});	

		// Tick
		makeElement($elm, "grad-tick grad-tick--" + n + redzoneClass, "", {
			left: (50 - 50 * Math.sin(angle * (Math.PI / 180))) + "%",
			top: (50 + 50 * Math.cos(angle * (Math.PI / 180))) + "%",
			transform: "translate3d(-50%, 0, 0) rotate(" + (angle + 180) + "deg)"
		});

		// Half ticks
		angle += angleStep / 2;
		
		if (angle < config.angleMax) {
			makeElement($elm, "grad-tick grad-tick--half grad-tick--" + n + redzoneClass, "", {
				left: (50 - 50 * Math.sin(angle * (Math.PI / 180))) + "%",
				top: (50 + 50 * Math.cos(angle * (Math.PI / 180))) + "%",
				transform: "translate3d(-50%, 0, 0) rotate(" + (angle + 180) + "deg)"
			});
		}

		// Quarter ticks
		angle += angleStep / 4;
		
		if (angle < config.angleMax) {
			makeElement($elm, "grad-tick grad-tick--quarter grad-tick--" + n + redzoneClass, "", {
				left: (50 - 50 * Math.sin(angle * (Math.PI / 180))) + "%",
				top: (50 + 50 * Math.cos(angle * (Math.PI / 180))) + "%",
				transform: "translate3d(-50%, 0, 0) rotate(" + (angle + 180) + "deg)"
			});
		}

		angle -= angleStep / 2;
		
		if (angle < config.angleMax) {
			makeElement($elm, "grad-tick grad-tick--quarter grad-tick--" + n + redzoneClass, "", {
				left: (50 - 50 * Math.sin(angle * (Math.PI / 180))) + "%",
				top: (50 + 50 * Math.cos(angle * (Math.PI / 180))) + "%",
				transform: "translate3d(-50%, 0, 0) rotate(" + (angle + 180) + "deg)"
			});
		}
	}
	
	// NEEDLE
	
	angle = value2angle(config.value);
	
	$needle = makeElement($elm, "needle", "", {
		transform: "translate3d(-50%, 0, 0) rotate(" + angle + "deg)"
	});
	
	let $axle = makeElement($elm, "needle-axle");
	makeElement($elm, "label label-value", "<div>" + config.labelFormat(config.value) + "</div>" + "<span>" + config.labelUnit + "</span>");
	
	$value = $elm.querySelector(".label-value div");
};


// DOM LOADED FIESTA


function initApp() {
	console.log('[initApp] Starting initialization');
	let rpmMeter; // will be created per-car by createRpmMeter()


	let gearMeter = document.querySelector('.meter--gear div') || null;
	let countdownOverlay = document.getElementById('raceCountdown') || null;
	let finishOverlay = document.getElementById('raceFinish') || null;
	let finishTimeLabel = document.getElementById('raceFinishTime') || null;
	let restartRaceBtn = document.getElementById('restartRaceBtn') || null;
	let menuRaceBtn = document.getElementById('menuRaceBtn') || null;

	const RACE_COUNTDOWN_SECONDS = 5;
	const RACE_FINISH_DISTANCE_METERS = 400;
	const SHIFT_PENALTY_BRAKE_LIGHT = 0.35;
	const SHIFT_PENALTY_BRAKE_HEAVY = 0.6;
	const SHIFT_PENALTY_DURATION_LIGHT = 0.2;
	const SHIFT_PENALTY_DURATION_HEAVY = 0.38;
	const SHIFT_PENALTY_TORQUE_LIGHT = 0.88;
	const SHIFT_PENALTY_TORQUE_HEAVY = 0.74;
	
	// USER INPUTS
	
	document.onkeydown = keyDown;
	document.onkeyup = keyUp;

	function keyDown(e) {

		e = e || window.event;

		if (e.keyCode == '38') { 			// up arrow
			isAccelerating = true;
		}
		else if (e.keyCode == '40') { // down arrow
			isBraking = true;
		}
		else if (e.keyCode == '37') { // left arrow
		}
		else if (e.keyCode == '39') { // right arrow
		}

	}	

	function keyUp(e) {

		e = e || window.event;

		if (e.keyCode == '38') {			// up arrow
			isAccelerating = false;
		}
		else if (e.keyCode == '40') { // down arrow
			isBraking = false;
		}
		else if (e.keyCode == '37') { // left arrow
			gearDown();
		}
		else if (e.keyCode == '39') { // right arrow
			gearUp();
		}

	}	
	
	function gearUp() {
		if (raceState !== 'racing') {
			return;
		}
		if (gear < gears.length - 1) {
			let prev = gear;
			gear++;
			if (gearMeter) gearMeter.innerHTML = (gear === 0) ? 'N' : gear;
			engageGear(prev, gear);
		}
	}

	function gearDown() {
		if (raceState !== 'racing') {
			return;
		}
		if (gear > 0) {
			let prev = gear;
			gear--;
			if (gearMeter) gearMeter.innerHTML = (gear === 0) ? 'N' : gear;
			engageGear(prev, gear);
		}
	}

	
	const SINGLE_CAR_NAME = 'car1';
	const cars = {
		car1: CAR_SPECS.car1
	};
	let currentCarName = SINGLE_CAR_NAME;
	let currentCar = cars[currentCarName];

	let {
		mass,
		cx,
		gears,
		transmitionRatio,
		transmitionLoss,
		wheelDiameter,
		brakeTorqueMax
	} = currentCar.vehicle;

	let {
		rpmIdle,
		rpmMax,
		rpmRedzone,
		torqueMin,
		torqueMax,
		torquePeak,
		torqueSigma
	} = currentCar.engine;

	let {
		revUpRate,
		idleReturnRate,
		engageTime,
		boostMultiplier,
		slipDrag
	} = currentCar.clutch;

		// Create / recreate RPM meter based on current car parameters
		function createRpmMeter($elm) {
			if (!$elm) return;
			$elm.innerHTML = ""; // clear existing
			rpmMeter = new Meter($elm, {
				value: rpmIdle,
				valueMin: 0,
				valueMax: rpmMax,
				valueStep: 1000,
				valueUnit: "<div>RPM</div><span>x1000</span>",
				angleMin: 30,
				angleMax: 330,
				labelUnit: "Km/h",
				labelFormat: function(v) { return Math.round(v / 1000); },
				needleFormat: function() { return Math.round(speed); },
				valueRed: rpmRedzone
			});
		}

		function applyCarToUI(name) {
			if (name !== SINGLE_CAR_NAME || !cars[SINGLE_CAR_NAME]) return;
			currentCarName = SINGLE_CAR_NAME;
			currentCar = cars[SINGLE_CAR_NAME];
			playerTravelZ = 0;

			if (window.CarCatalog && typeof window.CarCatalog.setSelectedCar === 'function') {
				window.CarCatalog.setSelectedCar(SINGLE_CAR_NAME);
			}

			// rebind vehicle/engine/clutch params
			({
				mass,
				cx,
				gears,
				transmitionRatio,
				transmitionLoss,
				wheelDiameter,
				brakeTorqueMax
			} = currentCar.vehicle);

			({
				rpmIdle,
				rpmMax,
				rpmRedzone,
				torqueMin,
				torqueMax,
				torquePeak,
				torqueSigma
			} = currentCar.engine);

			({
				revUpRate,
				idleReturnRate,
				engageTime,
				boostMultiplier,
				slipDrag
			} = currentCar.clutch);

			// reset state to car initial state
			gear = currentCar.initialState.gear;
			speed = currentCar.initialState.speed;

			// recreate meter
			createRpmMeter(document.querySelector('.meter--rpm'));
			if (gearMeter) gearMeter.innerHTML = (gear === 0) ? 'N' : gear;

			// recompute windows
			shiftWindows = calculateShiftWindows();
			launchWindow = calculateLaunchWindow();
			updateShiftWindowUI();
			startCountdown();
			// show the 3D car model if three.js is available
			if (typeof showCarMesh === 'function') {
				showCarMesh(name);
			}
		}

	let shiftWindows = {};
	let launchWindow = null;

	let gear = currentCar.initialState.gear,
		speed = currentCar.initialState.speed,	// in km/h
		overallRatio,
		wheelRpm,
		wheelTorque,
		brakeTorque,
		resistance,
		acceleration;

	// Clutch / gear engagement helpers
	let clutchTimer = 0,
		clutchTorqueBoost = 0;

	function engageGear(prevGear, nextGear) {
		// When engaging from neutral to a gear, simulate clutch transfer
		if (prevGear === 0 && nextGear > 0) {
			let targetRpm = 0;
			if (gears[nextGear] !== 0) {
				targetRpm = speed / (60 * transmitionRatio * gears[nextGear] * (Math.PI * wheelDiameter / 1000));
			}
			let rpmDiff = rpm - targetRpm;
			if (rpmDiff > 200) {
				clutchTimer = engageTime; // seconds
				clutchTorqueBoost = (rpmDiff / rpmMax) * boostMultiplier;
			} else if (rpmDiff < -200) {
				// engine too slow for gear: small jerk or drop in engine RPM to match wheels
				speed = Math.max(0, speed - Math.abs(rpmDiff) * slipDrag);
			}
		}
	}

	// --- Three.js simple cars --------------------------------------------
	let scene, camera, renderer;
	let carMeshes = {};
	let currentShownName = null;
	let pendingShownName = null;
	// -1: world flows toward -Z (camera looks forward to +Z). 1: inverted direction.
	const STREAM_DIRECTION = -1;
	const STREAM_SEGMENT_LENGTH = 30;
	const STREAM_SEGMENT_COUNT = 7;
	const STREAM_STREET_LIGHT_PAIRS = 10;
	const STREAM_SKIP_INITIAL_LIGHT_PAIRS = 0;
	const STREAM_START_Z = -186;
	const STREAM_RECYCLE_BEHIND_DISTANCE = 50;
	const STREET_LIGHT_STEP = 20;
	const REAL_LIGHT_STEP = 40;
	const CAMERA_BASE_POS = { x: 8, y: 2.5, z: -125 };
	const CAR_BASE_POS = { x: 2, y: -0.5, z: -122 };
	const CAR_CAMERA_OFFSET = { x: 0, y: -2.95, z: -0.8 };
	let streetLightTemplate = null;
	let streetLightLoadInProgress = false;
	let streetLightQueuedCallbacks = [];
	let streamedRoadSegments = [];
	let streamedStreetLightPairs = [];

	// camera look X (smooth target). When 0 => perpendicular to road.
	let currentLookX = 0;
	let targetLookX = 0;
	let playerTravelZ = 0;
	let moonLight = null;
	let moonFillLight = null;
	let policeLightRig = null;
	let policeBlueLight = null;
	let policeRedLight = null;
	let policeBlueTarget = null;
	let policeRedTarget = null;
	let policeLightTime = 0;

	function loadStreetLightTemplate(onReady) {
		if (streetLightTemplate) {
			onReady(streetLightTemplate);
			return;
		}

		if (typeof window.GLTFLoader === 'undefined') {
			console.warn('GLTFLoader is not available. StreetLight model was not loaded.');
			return;
		}

		streetLightQueuedCallbacks.push(onReady);

		if (streetLightLoadInProgress) {
			return;
		}

		streetLightLoadInProgress = true;
		const loader = new window.GLTFLoader();
		loader.load(
			'../blender_models/StreetLight.gltf',
			function (gltf) {
				streetLightTemplate = gltf.scene;
				streetLightTemplate.traverse(function (node) {
					if (node.isMesh) {
						node.castShadow = true;
						node.receiveShadow = true;
					}
				});

				const callbacks = streetLightQueuedCallbacks.slice();
				streetLightQueuedCallbacks = [];
				streetLightLoadInProgress = false;
				callbacks.forEach(function (cb) { cb(streetLightTemplate); });
			},
			undefined,
			function (error) {
				streetLightLoadInProgress = false;
				streetLightQueuedCallbacks = [];
				console.error('Failed to load StreetLight.gltf', error);
			}
		);
	}

	function addStreetLightsFromModel() {
		loadStreetLightTemplate(function (template) {
			if (!scene || !template) return;

			function attachLampLight(streetLight, withPointLight) {
				if (!withPointLight) {
					return;
				}

				let lampMesh = null;
				streetLight.traverse(function (node) {
					if (lampMesh || !node.isMesh || !node.material) return;

					const mat = node.material;
					const hasEmissive = mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0);
					if (hasEmissive || mat.name === 'Material.002') {
						lampMesh = node;
					}
				});

				if (!lampMesh) {
					return;
				}

				streetLight.updateMatrixWorld(true);
				lampMesh.geometry.computeBoundingBox();
				const localCenter = lampMesh.geometry.boundingBox.getCenter(new THREE.Vector3());
				const worldCenter = lampMesh.localToWorld(localCenter.clone());
				const lightPos = streetLight.worldToLocal(worldCenter.clone());

				// Keep each post light local to reduce per-frame light cost.
				const lampLight = new THREE.PointLight(0xffe8b0, 3.2, 28);
				lampLight.castShadow = false;
				lampLight.position.copy(lightPos);
				lampLight.position.y += 0.08;
				streetLight.add(lampLight);
			}

			streamedStreetLightPairs.forEach(function (pair) {
				scene.remove(pair);
			});
			streamedStreetLightPairs = [];

			for (let i = 0; i < STREAM_STREET_LIGHT_PAIRS; i++) {
				if (i < STREAM_SKIP_INITIAL_LIGHT_PAIRS) {
					continue;
				}

				const pair = new THREE.Group();
				pair.position.z = STREAM_START_Z + i * STREET_LIGHT_STEP * (-STREAM_DIRECTION);

				const shouldEmitRealLight = true;

				const leftLight = template.clone(true);
				leftLight.position.set(-5.1, -0.5, 0);
				leftLight.rotation.y = Math.PI * 1.5;
				leftLight.scale.setScalar(0.5);
				attachLampLight(leftLight, shouldEmitRealLight);
				pair.add(leftLight);

				const rightLight = template.clone(true);
				rightLight.position.set(5.1, -0.5, 0);
				rightLight.rotation.y = Math.PI / 2;
				rightLight.scale.setScalar(0.5);
				attachLampLight(rightLight, shouldEmitRealLight);
				pair.add(rightLight);

				scene.add(pair);
				streamedStreetLightPairs.push(pair);
			}
		});
	}

	function buildRoadAndLights() {
		if (!scene || typeof THREE === 'undefined') return;

		const roadMat = new THREE.MeshPhongMaterial({
			color: 0x1b1c20,
			specular: 0x2f4f8c,
			shininess: 42,
			reflectivity: 0.35
		});
		const shoulderMat = new THREE.MeshLambertMaterial({ color: 0x27292e });
		const sideLineMat = new THREE.MeshLambertMaterial({ color: 0xf7f7f7 });
		const centerLineMat = new THREE.MeshLambertMaterial({ color: 0xffd54a });

		streamedRoadSegments.forEach(function (segment) {
			scene.remove(segment);
		});
		streamedRoadSegments = [];

		for (let i = 0; i < STREAM_SEGMENT_COUNT; i++) {
			const segment = new THREE.Group();
			segment.position.z = STREAM_START_Z + i * STREAM_SEGMENT_LENGTH * (-STREAM_DIRECTION);

			const road = new THREE.Mesh(new THREE.PlaneGeometry(8, STREAM_SEGMENT_LENGTH), roadMat);
			road.rotation.x = -Math.PI / 2;
			road.position.set(0, -0.49, STREAM_SEGMENT_LENGTH / 2);
			road.receiveShadow = true;
			segment.add(road);

			[-6.2, 6.2].forEach(function (x) {
				const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(4, STREAM_SEGMENT_LENGTH), shoulderMat);
				shoulder.rotation.x = -Math.PI / 2;
				shoulder.position.set(x, -0.495, STREAM_SEGMENT_LENGTH / 2);
				shoulder.receiveShadow = true;
				segment.add(shoulder);
			});

			[-3.8, 3.8].forEach(function (x) {
				const sideLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, STREAM_SEGMENT_LENGTH), sideLineMat);
				sideLine.rotation.x = -Math.PI / 2;
				sideLine.position.set(x, -0.485, STREAM_SEGMENT_LENGTH / 2);
				segment.add(sideLine);
			});

			for (let localZ = 1.6; localZ < STREAM_SEGMENT_LENGTH; localZ += 7) {
				const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.2), centerLineMat);
				dash.rotation.x = -Math.PI / 2;
				dash.position.set(0, -0.482, localZ);
				segment.add(dash);
			}

			scene.add(segment);
			streamedRoadSegments.push(segment);
		}

		addStreetLightsFromModel();
	}

	function recycleStreamPool(pool, spacing) {
		if (!pool.length) return;
		if (!camera) return;

		if (STREAM_DIRECTION < 0) {
			// Moving toward smaller Z: objects behind camera are at larger Z and must be moved ahead to smaller Z.
			const recycleBehindZ = camera.position.z + STREAM_RECYCLE_BEHIND_DISTANCE;
			let minZ = Infinity;
			for (let i = 0; i < pool.length; i++) {
				if (pool[i].position.z < minZ) {
					minZ = pool[i].position.z;
				}
			}

			for (let i = 0; i < pool.length; i++) {
				if (pool[i].position.z > recycleBehindZ) {
					pool[i].position.z = minZ - spacing;
					minZ = pool[i].position.z;
				}
			}
			return;
		}

		// Moving toward larger Z: objects behind camera are at smaller Z and must be moved ahead to larger Z.
		const recycleBehindZ = camera.position.z - STREAM_RECYCLE_BEHIND_DISTANCE;
		let maxZ = -Infinity;
		for (let i = 0; i < pool.length; i++) {
			if (pool[i].position.z > maxZ) {
				maxZ = pool[i].position.z;
			}
		}

		for (let i = 0; i < pool.length; i++) {
			if (pool[i].position.z < recycleBehindZ) {
				pool[i].position.z = maxZ + spacing;
				maxZ = pool[i].position.z;
			}
		}
	}

	function updateStreamedWorld(deltaSeconds) {
		if (!scene || deltaSeconds <= 0) return;
		recycleStreamPool(streamedRoadSegments, STREAM_SEGMENT_LENGTH);
		recycleStreamPool(streamedStreetLightPairs, STREET_LIGHT_STEP);
	}

	function setupAtmosphereLights() {
		if (!scene || typeof THREE === 'undefined') return;

		if (moonLight && moonLight.parent) {
			moonLight.parent.remove(moonLight);
		}
		if (moonFillLight && moonFillLight.parent) {
			moonFillLight.parent.remove(moonFillLight);
		}
		if (policeLightRig && policeLightRig.parent) {
			policeLightRig.parent.remove(policeLightRig);
		}
		if (policeBlueTarget && policeBlueTarget.parent) {
			policeBlueTarget.parent.remove(policeBlueTarget);
		}
		if (policeRedTarget && policeRedTarget.parent) {
			policeRedTarget.parent.remove(policeRedTarget);
		}
		moonLight = new THREE.DirectionalLight(0xb9c8ff, 0.55);
		moonLight.position.set(-35, 75, -65);
		moonLight.target.position.set(0, 0, 35);
		scene.add(moonLight);
		scene.add(moonLight.target);

		moonFillLight = new THREE.HemisphereLight(0x94a7ff, 0x10131d, 0.24);
		scene.add(moonFillLight);

		policeLightRig = new THREE.Group();
		policeLightRig.position.set(CAMERA_BASE_POS.x - 18, CAMERA_BASE_POS.y + 1.2, CAMERA_BASE_POS.z + 6);

		const policeAnchor = new THREE.Mesh(
			new THREE.SphereGeometry(0.18, 10, 10),
			new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0 })
		);
		policeLightRig.add(policeAnchor);

		policeBlueLight = new THREE.SpotLight(0x3d79ff, 2.6, 900,  Math.PI / 7, 0.5, 0.2);
		policeBlueLight.position.set(-3, 1.2, -6);
		policeBlueTarget = new THREE.Object3D();
		scene.add(policeBlueTarget);
		policeBlueLight.target = policeBlueTarget;
		policeLightRig.add(policeBlueLight);

		policeRedLight = new THREE.SpotLight(0xff3344, 2.6, 900, Math.PI / 7, 0.5, 0.2);
		policeRedLight.position.set(-3.0, 1.6, -6);
		policeRedTarget = new THREE.Object3D();
		scene.add(policeRedTarget);
		policeRedLight.target = policeRedTarget;
		policeLightRig.add(policeRedLight);

		scene.add(policeLightRig);
		policeLightTime = 0;
	}

	function updateAtmosphereLights(deltaSeconds) {
		if (!moonLight || !moonFillLight || !policeBlueLight || !policeRedLight || !policeBlueTarget || !policeRedTarget) return;

		if (deltaSeconds > 0) {
			policeLightTime += deltaSeconds;
		}

		if (policeLightRig && camera) {
			const targetMesh = getCurrentMesh();
			const targetX = targetMesh ? targetMesh.position.x : CAR_BASE_POS.x;
			const targetY = targetMesh ? targetMesh.position.y : CAR_BASE_POS.y;
			const targetZ = targetMesh ? targetMesh.position.z : (CAR_BASE_POS.z + playerTravelZ);

			// Place the police rig in front of the car as requested
			policeLightRig.position.set(
				targetX,
				targetY + 2.0,
				targetZ + 28
			);

			// Targets stay slightly above the car so the spotlights point at the car
			policeBlueTarget.position.set(targetX, targetY + 0.7, targetZ + 0.6);
			policeRedTarget.position.set(targetX, targetY + 0.7, targetZ + 0.6);
		}

		const blinkCycle = policeLightTime % 0.72;
		const bluePhase = blinkCycle < 0.36;
		const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(policeLightTime * 10.5));

		const nearIntensity = 1.9 * pulse;
		policeBlueLight.intensity = bluePhase ? nearIntensity : 0.03;
		policeRedLight.intensity = bluePhase ? 0.03 : nearIntensity;

		moonLight.intensity = 0.48 + 0.06 * Math.sin(policeLightTime * 0.25);
		moonFillLight.intensity = 0.22 + 0.03 * Math.sin(policeLightTime * 0.2);
	}

	function initThree() {
		if (typeof THREE === 'undefined') {
			console.warn('THREE.js not found — include three.js to render 3D cars');
			return;
		}

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220);
		

		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

		// prefer mounting into a container with id 'three-container' if present
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

		// No global scene lights: street light poles are the only light sources.
		setupAtmosphereLights();

		// Place camera on the road (driver/pedestrian position) and look down the track
		camera.position.set(CAMERA_BASE_POS.x, CAMERA_BASE_POS.y, CAMERA_BASE_POS.z);
		camera.lookAt(-300, -60, 10);

		buildRoadAndLights();

		window.addEventListener('resize', function () {
			if (!camera || !renderer) return;
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		});
	}

	function createCarMesh(name, carSpec) {
		if (window.CarCatalog && typeof window.CarCatalog.createCarMesh === 'function') {
			return window.CarCatalog.createCarMesh(THREE, name, carSpec, {
				mode: 'sim',
				onModelLoaded: function () {
					Object.keys(carMeshes).forEach(function (k) {
						carMeshes[k] = null;
					});
					const retryName = pendingShownName || currentShownName;
					if (retryName) {
						showCarMesh(retryName);
					}
				}
			});
		}

		return null;
	}

	function showCarMesh(name) {
		if (!scene || !name) {
			currentShownName = null;
			pendingShownName = null;
			return null;
		}

		pendingShownName = name;

		Object.keys(carMeshes).forEach(function (k) {
			const m = carMeshes[k];
			if (m && m.parent === scene) {
				scene.remove(m);
			}
		});

		let mesh = carMeshes[name];
		if (!mesh && cars[name]) {
			mesh = createCarMesh(name, cars[name]);
			carMeshes[name] = mesh;
		}

		if (mesh) {
			if (!mesh.userData.simScaleApplied) {
				mesh.scale.multiplyScalar(2.2);
				mesh.userData.simScaleApplied = true;
			}
			mesh.position.set(0, -0.49, 2.2);
			mesh.rotation.y = 0;
			scene.add(mesh);
			currentShownName = name;
			pendingShownName = name;
			return mesh;
		}

		currentShownName = null;
		return null;
	}

	function syncCarWithCamera(deltaSeconds) {
		if (!camera || typeof THREE === 'undefined') return;
		const mesh = getCurrentMesh();
		if (!mesh) return;

		const travelDelta = kmh2ms(speed) * deltaSeconds * STREAM_DIRECTION;
		if (isFinite(travelDelta) && deltaSeconds > 0) {
			playerTravelZ += travelDelta;
		}

		camera.position.set(CAMERA_BASE_POS.x, CAMERA_BASE_POS.y, CAMERA_BASE_POS.z + playerTravelZ);
		camera.lookAt(-300, -60, 10 + playerTravelZ);

		mesh.position.set(CAR_BASE_POS.x, CAR_BASE_POS.y, CAR_BASE_POS.z + playerTravelZ);
		mesh.rotation.set(0, Math.PI, 0);
	}

	// return current shown mesh
	function getCurrentMesh() {
		if (!currentShownName) return null;
		return carMeshes[currentShownName] || null;
	}


	let 
			torque,
			rpm = 0,
			isAccelerating = false,
			isBraking = false;

	let raceState = 'countdown';
	let countdownLeft = RACE_COUNTDOWN_SECONDS;
	let countdownDisplayValue = RACE_COUNTDOWN_SECONDS;
	let raceElapsedTime = 0;
	let penaltyBrakeTimer = 0;
	let penaltyBrakeLevel = 0;
	let penaltyTorqueFactor = 1;
	

	// Helper functions
	
	let torqueByRpm = function(rpm) {
		// Gaussian-shaped torque curve: baseline + (peak amplitude * gaussian)
		let x = (rpm - torquePeak) / torqueSigma;
		let gauss = Math.exp(-0.5 * x * x);
		let torque = torqueMin + (torqueMax - torqueMin) * gauss;
		return torque;
	};

	function calculateShiftWindows() {
		let windows = {};
		let maxGear = gears.length - 1;

		for (let g = 1; g < maxGear; g++) {
			let nextGear = g + 1;
			let shiftRpm = rpmMax;
			let foundCrossover = false;

			for (let testRpm = rpmIdle; testRpm <= rpmMax; testRpm += 25) {
				let nextRpm = testRpm * gears[g] / gears[nextGear];
				if (nextRpm < rpmIdle) {
					continue;
				}

				let currentWheelTorque = torqueByRpm(testRpm) / (transmitionRatio * gears[g]);
				let nextWheelTorque = torqueByRpm(nextRpm) / (transmitionRatio * gears[nextGear]);

				// If next gear starts pulling as much or more, this is the best shift point.
				if (nextWheelTorque >= currentWheelTorque) {
					shiftRpm = testRpm;
					foundCrossover = true;
					break;
				}
			}

			if (!foundCrossover) {
				// With this torque curve there is no crossover; best is to shift near limiter.
				shiftRpm = rpmMax;
			}

			if (shiftRpm >= rpmMax - 50) {
				windows[g] = {
					min: Math.max(rpmRedzone, rpmMax - 450),
					max: rpmMax,
					target: shiftRpm
				};
			} else {
				windows[g] = {
					min: Math.max(rpmIdle, shiftRpm - 200),
					max: Math.min(rpmMax, shiftRpm + 200),
					target: shiftRpm
				};
			}
		}

		return windows;
	}

	function calculateLaunchWindow() {
		// Best launch from neutral is based on the wheel torque available in 1st gear.
		// Since launch torque is proportional to engine torque, we find the RPM band
		// where 1st gear delivers at least 95% of the maximum launch torque.
		let firstGear = gears[1];
		if (!firstGear) {
			return null;
		}

		let maxLaunchTorque = -Infinity;
		let torqueSamples = [];

		for (let testRpm = rpmIdle; testRpm <= rpmMax; testRpm += 25) {
			let launchTorque = torqueByRpm(testRpm) / (transmitionRatio * firstGear);
			torqueSamples.push({ rpm: testRpm, torque: launchTorque });
			if (launchTorque > maxLaunchTorque) {
				maxLaunchTorque = launchTorque;
			}
		}

		let threshold = maxLaunchTorque * 0.95;
		let minRpm = rpmMax;
		let maxRpm = rpmIdle;
		let targetRpm = rpmMax;

		for (let i = 0; i < torqueSamples.length; i++) {
			if (torqueSamples[i].torque >= threshold) {
				minRpm = Math.min(minRpm, torqueSamples[i].rpm);
				maxRpm = Math.max(maxRpm, torqueSamples[i].rpm);
			}
		}

		// Target launch RPM is the point of maximum launch torque.
		for (let i = 0; i < torqueSamples.length; i++) {
			if (torqueSamples[i].torque === maxLaunchTorque) {
				targetRpm = torqueSamples[i].rpm;
				break;
			}
		}

		return {
			min: minRpm,
			max: maxRpm,
			target: targetRpm
		};
	}

	shiftWindows = calculateShiftWindows();
	launchWindow = calculateLaunchWindow();

	// init three.js and create simple car meshes, then create RPM meter
	initThree();
	carMeshes = {};
	const initialCarName = currentCarName || Object.keys(cars)[0];
	showCarMesh(initialCarName);

	// create the initial RPM meter for the selected car
	createRpmMeter(document.querySelector('.meter--rpm'));
		if (gearMeter) gearMeter.innerHTML = (gear === 0) ? 'N' : gear;
		updateShiftWindowUI();

	console.log('[Car] Single car integration initialized:', SINGLE_CAR_NAME);
	
	function kmh2ms(speed) {	// Km/h to m/s
		return speed / 3.6;
	}

	function updateShiftWindowUI() {
		let maxGear = gears.length - 1;
		let window = shiftWindows[gear];

		if (gear === 0) {
			if (launchWindow) {
				if (rpmMeter) rpmMeter.setWindow(launchWindow.min, launchWindow.max, launchWindow.target, rpm);
			} else {
				if (rpmMeter) rpmMeter.setWindow(null, null);
			}
			return;
		}

		if (gear >= maxGear) {
			if (rpmMeter) rpmMeter.setWindow(null, null);
			return;
		}

		if (!window) {
			if (rpmMeter) rpmMeter.setWindow(null, null);
			return;
		}

		if (rpmMeter) rpmMeter.setWindow(window.min, window.max, window.target, rpm);
	}

	function showCountdown(value) {
		if (!countdownOverlay) return;
		countdownOverlay.classList.remove('hidden');
		countdownOverlay.textContent = String(value);
	}

	function hideCountdown() {
		if (!countdownOverlay) return;
		countdownOverlay.classList.add('hidden');
	}

	function showFinish(timeSeconds) {
		if (finishTimeLabel) {
			finishTimeLabel.textContent = timeSeconds.toFixed(2) + 's';
		}
		if (finishOverlay) {
			finishOverlay.classList.remove('hidden');
		}
	}

	function hideFinish() {
		if (!finishOverlay) return;
		finishOverlay.classList.add('hidden');
	}

	function getGreenWindow(window) {
		if (!window) return null;
		let span = Math.max(0, window.max - window.min);
		let greenSpan = Math.max(25, span * 0.28);
		return {
			min: Math.max(window.min, window.target - greenSpan / 2),
			max: Math.min(window.max, window.target + greenSpan / 2)
		};
	}

	function setPenalty(level) {
		if (level === 'light') {
			penaltyBrakeTimer = Math.max(penaltyBrakeTimer, SHIFT_PENALTY_DURATION_LIGHT);
			penaltyBrakeLevel = Math.max(penaltyBrakeLevel, SHIFT_PENALTY_BRAKE_LIGHT);
			penaltyTorqueFactor = Math.min(penaltyTorqueFactor, SHIFT_PENALTY_TORQUE_LIGHT);
			return;
		}

		penaltyBrakeTimer = Math.max(penaltyBrakeTimer, SHIFT_PENALTY_DURATION_HEAVY);
		penaltyBrakeLevel = Math.max(penaltyBrakeLevel, SHIFT_PENALTY_BRAKE_HEAVY);
		penaltyTorqueFactor = Math.min(penaltyTorqueFactor, SHIFT_PENALTY_TORQUE_HEAVY);
	}

	function applyLaunchPenalty(launchRpm) {
		if (!launchWindow) {
			return;
		}

		let greenWindow = getGreenWindow(launchWindow);
		if (greenWindow && launchRpm >= greenWindow.min && launchRpm <= greenWindow.max) {
			return;
		}

		if (launchRpm >= launchWindow.min && launchRpm <= launchWindow.max) {
			setPenalty('light');
			return;
		}

		setPenalty('heavy');
	}

	function startCountdown() {
		raceState = 'countdown';
		countdownLeft = RACE_COUNTDOWN_SECONDS;
		countdownDisplayValue = RACE_COUNTDOWN_SECONDS;
		raceElapsedTime = 0;
		penaltyBrakeTimer = 0;
		penaltyBrakeLevel = 0;
		penaltyTorqueFactor = 1;
		playerTravelZ = 0;
		speed = 0;
		rpm = rpmIdle;
		buildRoadAndLights();

		gear = 0;
		if (gearMeter) gearMeter.innerHTML = 'N';
		if (gearMeter) gearMeter.classList.remove('redzone');

		hideFinish();
		showCountdown(countdownDisplayValue);
	}

	function startRaceNow() {
		if (raceState !== 'countdown') {
			return;
		}

		let launchRpm = rpm;

		let prev = gear;
		gear = 1;
		if (gearMeter) gearMeter.innerHTML = '1';
		engageGear(prev, gear);
		applyLaunchPenalty(launchRpm);

		raceState = 'racing';
		raceElapsedTime = 0;
		hideCountdown();
	}

	function finishRace() {
		if (raceState !== 'racing') {
			return;
		}

		raceState = 'finished';
		speed = 0;
		isAccelerating = false;
		isBraking = false;
		penaltyBrakeTimer = 0;
		penaltyBrakeLevel = 0;
		penaltyTorqueFactor = 1;
		showFinish(raceElapsedTime);
	}

	if (restartRaceBtn) {
		restartRaceBtn.addEventListener('click', function () {
			startCountdown();
		});
	}

	if (menuRaceBtn) {
		menuRaceBtn.addEventListener('click', function () {
			window.location.href = '../index.html';
		});
	}
	
	// Physics 101
	/* 
	 * P = C w
	 * P(hp) = C(m.kg) w(rpm) / 716
	 *
	 * F = m.a
	 * Force(newton) = mass(kg) * acceleration (m/s)
	 *
	 * a = Cr / (r.m)
	 * acceleration (m/s) = torqueWheel (m.kg) / (wheelRadius (m) * mass (kg))
	 */

	let lastTime = new Date().getTime(),
			nowTime,
			delta;
	
	
	// MAIN LOOP
	
	(function loop(){
		window.requestAnimationFrame(loop);

		// Delta time
		nowTime = new Date().getTime();
		delta = (nowTime - lastTime) / 1000; // in seconds
		lastTime = nowTime;

		if (raceState === 'countdown') {
			countdownLeft = Math.max(0, countdownLeft - delta);
			let nextDisplay = Math.ceil(countdownLeft);
			if (nextDisplay !== countdownDisplayValue) {
				countdownDisplayValue = nextDisplay;
				if (countdownDisplayValue > 0) {
					showCountdown(countdownDisplayValue);
				}
			}

			gear = 0;
			speed = 0;
			isBraking = false;

			if (countdownLeft <= 0) {
				startRaceNow();
			}
		}

		if (raceState === 'racing') {
			raceElapsedTime += delta;
			isAccelerating = true;
			isBraking = false;
		}
		
		let oldSpeed = speed,
				oldRpm = rpm;
		
		// Torque
		
		if (raceState === 'racing' && isAccelerating && rpm < rpmMax) {	// Gas!
			torque = torqueByRpm(rpm);

		} else {
			torque = -(rpm * rpm / 1000000);
		}
		
		if (raceState === 'finished') {
			brakeTorque = brakeTorqueMax;
		} else {
			if (penaltyBrakeTimer > 0) {
				penaltyBrakeTimer = Math.max(0, penaltyBrakeTimer - delta);
				brakeTorque = brakeTorqueMax * penaltyBrakeLevel;
			} else {
				penaltyBrakeLevel = 0;
				penaltyTorqueFactor = 1;
				brakeTorque = 0;
			}
		}
		
		
		// Transmission and wheel torque
		if (gears[gear] === 0) {
			// Neutral: no drive torque to wheels
			overallRatio = 0;
			wheelTorque = -brakeTorque; // only braking acts on wheels
			acceleration = 20 * wheelTorque / (wheelDiameter * mass / 2);
			resistance = 0.5 * 1.2 * cx * kmh2ms(speed)^2;
		} else {
			overallRatio = transmitionRatio * gears[gear];
			wheelTorque = torque / overallRatio - brakeTorque;
			if (raceState === 'racing' && penaltyTorqueFactor < 1) {
				wheelTorque *= penaltyTorqueFactor;
			}
			// apply clutch torque boost if engaging
			if (clutchTimer > 0) {
				wheelTorque += clutchTorqueBoost;
				clutchTimer = Math.max(0, clutchTimer - delta);
				if (clutchTimer === 0) { clutchTorqueBoost = 0; }
			}
			acceleration = 20 * wheelTorque / (wheelDiameter * mass / 2);
			resistance = 0.5 * 1.2 * cx * kmh2ms(speed)^2;
		}

		// Speed
		
		speed += (acceleration - resistance) * delta;
		
		
		if (speed < 0) { speed = 0; }
		if (raceState === 'finished') { speed = 0; }
		
		wheelRpm = speed / (60 * (Math.PI * wheelDiameter / 1000));
		// Engine RPM
		if (gears[gear] === 0) {
			// Neutral: allow revs to increase with throttle without increasing speed
			if (isAccelerating) {
				rpm += revUpRate * delta; // rev up when throttle pressed
			} else {
				// relax towards idle
				rpm += (rpmIdle - rpm) * idleReturnRate * delta;
			}
			if (rpm < 600) rpm = 600;
			if (rpm > rpmMax) rpm = rpmMax;
		} else {
			// RPM linked to wheel speed and gear ratio
			rpm = speed / (60 * transmitionRatio * gears[gear] * (Math.PI * wheelDiameter / 1000));
		}

		// Ensure RPM doesn't drop below idle
		if (rpm < rpmIdle) {
			rpm = rpmIdle;
		}
		if (raceState === 'finished') {
			rpm = rpmIdle;
		}
		
		// Gear shifter
		if (rpm > rpmRedzone) {
			if (gearMeter) gearMeter.classList.add('redzone');

		} else {
			if (gearMeter) gearMeter.classList.remove('redzone');
		}

		updateShiftWindowUI();
		
		// Update GUI
		if (rpmMeter) {
			rpmMeter.setValue(rpm);
		}

		// Update engine sound
		if (source) {
			source.playbackRate.value = rpm / 4000;
		}

		if (source2) {
			source2.playbackRate.value = speed / 500;
		}

		syncCarWithCamera(delta);

		if (raceState === 'racing' && Math.abs(playerTravelZ) >= RACE_FINISH_DISTANCE_METERS) {
			finishRace();
		}

		updateStreamedWorld(delta);
		updateAtmosphereLights(delta);

		// update controls (free camera) then render three.js scene
		// No free-camera controls active — camera is fixed to road position
		if (typeof renderer !== 'undefined' && renderer && scene && camera) {
			renderer.render(scene, camera);
		}

	})();

	startCountdown();
	
	///////////////////////////////////////////////
	// WEBAUDIO
	
	// Courtesy of https://mdn.github.io/decode-audio-data/
	
	// define variables

	var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	var source,source2,
			gainNode;
	var songLength;

	var loader = document.querySelector('.loader');
	var btnVolume = document.querySelector('.btn-volume');

	// use XHR to load an audio track, and
	// decodeAudioData to decode it and stick it in a buffer.
	// Then we put the buffer into the source

	function getData() {
		source = audioCtx.createBufferSource();
		source2 = audioCtx.createBufferSource();
		let request = new XMLHttpRequest();

		request.open('GET', motorSamplePath, true);
		request.responseType = 'arraybuffer';

		request.onload = function() {
			var audioData = request.response;

			audioCtx.decodeAudioData(audioData, function(buffer) {
				let myBuffer = buffer;	// local buffer ?
				let myBuffer2 = buffer;
//				songLength = buffer.duration; // in seconds
				source.buffer = myBuffer;
				source2.buffer = myBuffer2;

				source.loop = true;
				source2.loop = true;

				// Hacky granular engine sound!
				source.loopStart = 0.1; // Tune this
				source.loopEnd = 0.1735; // Tune this

				source2.loopStart = 0.605;
				source2.loopEnd = 0.650;
				
				source.playbackRate.value = 1;
				source2.playbackRate.value = 1;

				// Create a gain node.
				gainNode = audioCtx.createGain();
				// Connect the source to the gain node.
				source.connect(gainNode);
				source2.connect(gainNode);
				// Connect the gain node to the destination.
				gainNode.connect(audioCtx.destination);

				// Remove loader if it exists
				if (loader) loader.classList.remove('active');
			},

				function(e){"Error with decoding audio data" + e.err});
		}

		request.send();
	}

	// wire up buttons — only if element exists
	if (btnVolume) {
		btnVolume.onclick = function() {
			this.classList.toggle('active');

			if (this.classList.contains('active')) {
				gainNode.gain.value = 1;
			} else {
				gainNode.gain.value = 0;
			}
		}
	}

	// Load the sample — only if audio UI elements exist
	if (loader && btnVolume) {
		getData();
		// Launch loop playing
		setTimeout(() => { if (source) source.start(0); if (source2) source2.start(0); }, 100);
	}
	

	}

	// If DOM already loaded, run init immediately, otherwise wait for event
	console.log('[game.js] readyState:', document.readyState);
	if (document.getElementById('WebGL-output')) {
		console.log('[game.js] Car selection page detected — skipping simulator init');
	} else if (document.readyState === 'loading') {
		console.log('[game.js] Waiting for DOMContentLoaded');
		document.addEventListener('DOMContentLoaded', initApp);
	} else {
		console.log('[game.js] Calling initApp immediately');
		initApp();
	}