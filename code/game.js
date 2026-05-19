// game.js — Singleplayer mode
// Depends on: shared/constants.js, shared/meter.js, shared/physics.js, shared/scene.js
//             cars.js, assets.js, sound.js

function initApp() {
    const C = window.GAME_CONSTANTS;
    const { RACE_COUNTDOWN_SECONDS, RACE_FINISH_DISTANCE_METERS, CAMERA_BASE_POS, CAR_BASE_POS,
        STREAM_SEGMENT_LENGTH, STREET_LIGHT_STEP, DECORATION_STEP, STREAM_DIRECTION,
        SHIFT_PENALTY_BRAKE_LIGHT, SHIFT_PENALTY_BRAKE_HEAVY,
        SHIFT_PENALTY_DURATION_LIGHT, SHIFT_PENALTY_DURATION_HEAVY,
        SHIFT_PENALTY_TORQUE_LIGHT, SHIFT_PENALTY_TORQUE_HEAVY } = C;

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const gearMeterEl   = document.querySelector('.meter--gear.meter--p1 div') || null;
    const countdownEl   = document.getElementById('raceCountdown') || null;
    const finishEl      = document.getElementById('raceFinish') || null;
    const finishTimeEl  = document.getElementById('raceFinishTime') || null;
    const restartBtn    = document.getElementById('restartRaceBtn') || null;
    const menuBtn       = document.getElementById('menuRaceBtn') || null;

    // ── Car spec ──────────────────────────────────────────────────────────────
    const urlParams  = new URLSearchParams(window.location.search);
    const carName    = urlParams.get('p1') || 'car1';
    const spec       = (window.CarCatalog && window.CarCatalog.specs[carName]) || window.CarCatalog.specs.car1;

    window.SoundManager.load(spec.vehicle.soundPath || '../sounds/car1.ogg');
    window.SoundManager.setupVolumeButton();

    // ── Physics state ─────────────────────────────────────────────────────────
    let gear = 0, speed = 0, rpm = spec.engine.rpmIdle;
    let torque = 0, wheelTorque = 0, overallRatio = 0, acceleration = 0, resistance = 0;
    let clutchTimer = 0, clutchTorqueBoost = 0;
    let penaltyBrakeTimer = 0, penaltyBrakeLevel = 0, penaltyTorqueFactor = 1;
    let brakeTorque = 0;
    let isAccelerating = false, isBraking = false;
    let shiftWindows = window.GamePhysics.calculateShiftWindows(spec);
    let launchWindow = window.GamePhysics.calculateLaunchWindow(spec);

    // ── Race state ─────────────────────────────────────────────────────────────
    let raceState = 'loading';
    let raceElapsedTime = 0;
    let countdownLeft = RACE_COUNTDOWN_SECONDS;
    let countdownDisplay = RACE_COUNTDOWN_SECONDS;
    let playerTravelZ = 0;

    // ── 3D scene ──────────────────────────────────────────────────────────────
    let scene, camera, renderer;
    let carMesh = null;
    let atmLights = null;
    let policeLightTime = 0;
    let smokeParticles = [];
    const pools = { roadSegments: [], streetLightPairs: [], decorations: [] };

    // ── RPM meter ─────────────────────────────────────────────────────────────
    let rpmMeter = null;

    function createRpmMeter() {
        const el = document.querySelector('.meter--rpm.meter--p1');
        if (!el) return;
        el.innerHTML = '';
        rpmMeter = new window.Meter(el, {
            value: spec.engine.rpmIdle,
            valueMin: 0,
            valueMax: spec.engine.rpmMax,
            valueStep: 1000,
            valueUnit: '<div>RPM</div><span>x1000</span>',
            angleMin: 30,
            angleMax: 330,
            labelUnit: 'Km/h',
            labelFormat: v => Math.round(v / 1000),
            needleFormat: () => Math.round(speed),
            valueRed: spec.engine.rpmRedzone
        });
    }

    function updateRpmUI() {
        if (rpmMeter) rpmMeter.setValue(rpm);
        if (gearMeterEl) {
            gearMeterEl.innerHTML = gear === 0 ? 'N' : gear;
            rpm > spec.engine.rpmRedzone
                ? gearMeterEl.classList.add('redzone')
                : gearMeterEl.classList.remove('redzone');
        }
        // Shift window guide
        if (!rpmMeter) return;
        const maxGear = spec.vehicle.gears.length - 1;
        if (gear === 0) {
            launchWindow ? rpmMeter.setWindow(launchWindow.min, launchWindow.max, launchWindow.target, rpm)
                         : rpmMeter.setWindow(null, null);
        } else if (gear >= maxGear) {
            rpmMeter.setWindow(null, null);
        } else {
            const sw = shiftWindows[gear];
            sw ? rpmMeter.setWindow(sw.min, sw.max, sw.target, rpm)
               : rpmMeter.setWindow(null, null);
        }
    }

    // ── Gear & clutch ──────────────────────────────────────────────────────────
    function engageGear(prevGear, nextGear) {
        if (prevGear !== 0 || nextGear <= 0) return;
        const targetRpm = spec.vehicle.gears[nextGear] !== 0
            ? speed / (60 * spec.vehicle.transmitionRatio * spec.vehicle.gears[nextGear] * (Math.PI * spec.vehicle.wheelDiameter / 1000))
            : 0;
        const rpmDiff = rpm - targetRpm;
        if (rpmDiff > 200) {
            clutchTimer = spec.clutch.engageTime;
            clutchTorqueBoost = (rpmDiff / spec.engine.rpmMax) * spec.clutch.boostMultiplier;
        } else if (rpmDiff < -200) {
            speed = Math.max(0, speed - Math.abs(rpmDiff) * spec.clutch.slipDrag);
        }
    }

    function setPenalty(level) {
        if (level === 'light') {
            penaltyBrakeTimer    = Math.max(penaltyBrakeTimer,    SHIFT_PENALTY_DURATION_LIGHT);
            penaltyBrakeLevel    = Math.max(penaltyBrakeLevel,    SHIFT_PENALTY_BRAKE_LIGHT);
            penaltyTorqueFactor  = Math.min(penaltyTorqueFactor,  SHIFT_PENALTY_TORQUE_LIGHT);
        } else {
            penaltyBrakeTimer    = Math.max(penaltyBrakeTimer,    SHIFT_PENALTY_DURATION_HEAVY);
            penaltyBrakeLevel    = Math.max(penaltyBrakeLevel,    SHIFT_PENALTY_BRAKE_HEAVY);
            penaltyTorqueFactor  = Math.min(penaltyTorqueFactor,  SHIFT_PENALTY_TORQUE_HEAVY);
        }
    }

    function gearUp() {
        if (raceState !== 'racing') return;
        if (gear >= spec.vehicle.gears.length - 1) return;
        const prev = gear;
        const sw = shiftWindows[prev];
        if (sw) {
            if (rpm < sw.min) { setPenalty(sw.min - rpm > 800 ? 'heavy' : 'light'); }
            else if (rpm > sw.max) { setPenalty(rpm - sw.max > 500 ? 'heavy' : 'light'); }
        }
        gear++;
        if (gearMeterEl) gearMeterEl.innerHTML = gear;
        engageGear(prev, gear);
    }

    // ── Race flow ─────────────────────────────────────────────────────────────
    function startCountdown() {
        raceState = 'countdown';
        countdownLeft = RACE_COUNTDOWN_SECONDS;
        countdownDisplay = RACE_COUNTDOWN_SECONDS;
        raceElapsedTime = 0;
        playerTravelZ = 0;
        gear = 0; speed = 0; rpm = spec.engine.rpmIdle;
        penaltyBrakeTimer = 0; penaltyBrakeLevel = 0; penaltyTorqueFactor = 1;
        if (gearMeterEl) { gearMeterEl.innerHTML = 'N'; gearMeterEl.classList.remove('redzone'); }
        if (finishEl) finishEl.classList.add('hidden');
        if (countdownEl) { countdownEl.classList.remove('hidden'); countdownEl.textContent = countdownDisplay; }
        window.GameScene.buildRoadAndLights(scene, pools);
        window.SoundManager.getPlayer('p1').play(rpm, speed);
    }

    function startRaceNow() {
        if (raceState !== 'countdown') return;
        // Apply launch penalty
        const lw = launchWindow;
        if (lw) {
            const span = lw.max - lw.min;
            const greenHalf = Math.max(25, span * 0.28) / 2;
            const greenMin = Math.max(lw.min, lw.target - greenHalf);
            const greenMax = Math.min(lw.max, lw.target + greenHalf);
            if (rpm < greenMin || rpm > greenMax) {
                setPenalty(rpm >= lw.min && rpm <= lw.max ? 'light' : 'heavy');
            }
        }
        const prev = gear;
        gear = 1;
        if (gearMeterEl) gearMeterEl.innerHTML = '1';
        engageGear(prev, gear);
        raceState = 'racing';
        raceElapsedTime = 0;
        if (countdownEl) countdownEl.classList.add('hidden');
    }

    function finishRace() {
        if (raceState !== 'racing') return;
        raceState = 'finished';
        speed = 0; isAccelerating = false; isBraking = false;
        penaltyBrakeTimer = 0; penaltyBrakeLevel = 0; penaltyTorqueFactor = 1;
        if (finishTimeEl) finishTimeEl.textContent = raceElapsedTime.toFixed(2) + 's';
        if (finishEl) finishEl.classList.remove('hidden');
        window.SoundManager.getPlayer('p1').stop();
    }

    // ── Car mesh ───────────────────────────────────────────────────────────────
    function loadCarMesh() {
        if (!window.CarCatalog) return;
        carMesh = window.CarCatalog.createCarMesh(THREE, carName, spec, {
            mode: 'sim',
            onModelLoaded() {
                carMesh = window.CarCatalog.createCarMesh(THREE, carName, spec, { mode: 'sim' });
                if (carMesh) finalizeCarMesh();
            }
        });
        if (carMesh) finalizeCarMesh();
    }

    function finalizeCarMesh() {
        if (!carMesh.userData.simScaleApplied) {
            carMesh.scale.multiplyScalar(2.2);
            carMesh.userData.simScaleApplied = true;
        }
        carMesh.position.set(CAR_BASE_POS.x, CAR_BASE_POS.y, CAR_BASE_POS.z);
        carMesh.rotation.y = Math.PI;
        scene.add(carMesh);
        startCountdown();
    }

    function syncCarWithCamera(delta) {
        if (!carMesh) return;
        const travelDelta = (speed / 3.6) * delta * STREAM_DIRECTION;
        if (isFinite(travelDelta) && delta > 0) playerTravelZ += travelDelta;

        camera.position.set(CAMERA_BASE_POS.x, CAMERA_BASE_POS.y, CAMERA_BASE_POS.z + playerTravelZ);
        camera.lookAt(-300, -60, 10 + playerTravelZ);
        carMesh.position.set(CAR_BASE_POS.x, CAR_BASE_POS.y, CAR_BASE_POS.z + playerTravelZ);
        carMesh.rotation.set(0, Math.PI, 0);

        if (carMesh.userData.wheels) {
            const radius = spec.vehicle.wheelDiameter / 2;
            const angularVelocity = (speed / 3.6) / radius;
            carMesh.userData.wheels.forEach(wheel => {
                const axle = wheel.userData.axleName || 'x';
                wheel.rotation[axle] += angularVelocity * delta;
            });
        }
    }

    // ── 3D init ───────────────────────────────────────────────────────────────
    function initThree() {
        ({ scene, camera, renderer } = window.GameScene.initThree(null, 60));
        camera.position.set(CAMERA_BASE_POS.x, CAMERA_BASE_POS.y, CAMERA_BASE_POS.z);
        camera.lookAt(-300, -60, 10);

        const carBase = CAR_BASE_POS;
        atmLights = window.GameScene.setupAtmosphereLights(scene, { d: 8 }, carBase);
        window.GameScene.buildRoadAndLights(scene, pools);
        window.GameScene.createFinishLine(scene, carBase.z - RACE_FINISH_DISTANCE_METERS);
        loadCarMesh();
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    const UI_SELECTORS = '#restartRaceBtn,#menuRaceBtn,.btn-volume,.race-btn';
    function isUITarget(e) { return e.target.closest && e.target.closest(UI_SELECTORS); }

    document.onkeydown = e => {
        const k = (e.key || '').toLowerCase();
        if (k === 'w' || e.keyCode === 38) {
            window.SoundManager.resume();
            isAccelerating = true;
        }
        if (k === 's' || e.keyCode === 40) isBraking = true;
        if (k === 'd' || e.keyCode === 39) gearUp();
    };
    document.onkeyup = e => {
        const k = (e.key || '').toLowerCase();
        if (k === 'w' || e.keyCode === 38) isAccelerating = false;
        if (k === 's' || e.keyCode === 40) isBraking = false;
    };

    function handlePress() {
        window.SoundManager.resume();
        if (raceState === 'racing') gearUp();
        else isAccelerating = true;
    }
    function handleRelease() { if (raceState !== 'racing') isAccelerating = false; }

    window.addEventListener('touchstart', e => { if (isUITarget(e)) return; e.preventDefault(); handlePress(); }, { passive: false });
    window.addEventListener('touchend',   e => { if (isUITarget(e)) return; handleRelease(); }, { passive: false });
    window.addEventListener('touchcancel', () => handleRelease(), { passive: false });
    window.addEventListener('mousedown', e => { if (isUITarget(e)) return; handlePress(); });
    window.addEventListener('mouseup',   e => { if (isUITarget(e)) return; handleRelease(); });

    if (restartBtn) restartBtn.onclick = () => startCountdown();
    if (menuBtn)    menuBtn.onclick    = () => window.location.href = '../index.html';

    // ── Main loop ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    (function loop() {
        window.requestAnimationFrame(loop);
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        // Countdown
        if (raceState === 'countdown') {
            countdownLeft = Math.max(0, countdownLeft - delta);
            const next = Math.ceil(countdownLeft);
            if (next !== countdownDisplay) {
                countdownDisplay = next;
                if (countdownEl && countdownDisplay > 0) countdownEl.textContent = countdownDisplay;
            }
            gear = 0; speed = 0; isBraking = false;
            if (countdownLeft <= 0) startRaceNow();
        }

        if (raceState === 'racing') {
            raceElapsedTime += delta;
            isAccelerating = true;
            isBraking = false;
        }

        // Physics
        const { gears, transmitionRatio, wheelDiameter, mass, cx, brakeTorqueMax } = spec.vehicle;
        const { rpmMax, rpmIdle, rpmRedzone } = spec.engine;

        // Torque
        if (raceState === 'racing' && isAccelerating && rpm < rpmMax) {
            torque = window.GamePhysics.torqueByRpm(rpm, spec.engine);
        } else {
            torque = -(rpm * rpm / 1000000);
        }

        // Braking
        if (raceState === 'finished') {
            brakeTorque = brakeTorqueMax;
        } else if (penaltyBrakeTimer > 0) {
            penaltyBrakeTimer = Math.max(0, penaltyBrakeTimer - delta);
            brakeTorque = brakeTorqueMax * penaltyBrakeLevel;
        } else {
            penaltyBrakeLevel = 0; penaltyTorqueFactor = 1; brakeTorque = 0;
        }

        // Transmission
        if (gears[gear] === 0) {
            overallRatio = 0;
            wheelTorque = -brakeTorque;
            acceleration = 20 * wheelTorque / (wheelDiameter * mass / 2);
            resistance = 0;
        } else {
            overallRatio = transmitionRatio * gears[gear];
            wheelTorque = torque / overallRatio - brakeTorque;
            if (raceState === 'racing' && penaltyTorqueFactor < 1) wheelTorque *= penaltyTorqueFactor;
            if (clutchTimer > 0) {
                wheelTorque += clutchTorqueBoost;
                clutchTimer = Math.max(0, clutchTimer - delta);
                if (clutchTimer === 0) clutchTorqueBoost = 0;
            }
            acceleration = 20 * wheelTorque / (wheelDiameter * mass / 2);
            resistance = 0;
        }

        speed = Math.max(0, speed + (acceleration - resistance) * delta);
        if (raceState === 'finished') speed = 0;

        // RPM
        if (gears[gear] === 0) {
            if (isAccelerating) rpm += spec.clutch.revUpRate * delta;
            else rpm += (rpmIdle - rpm) * spec.clutch.idleReturnRate * delta;
            rpm = Math.max(600, Math.min(rpmMax, rpm));
        } else {
            rpm = speed / (60 * transmitionRatio * gears[gear] * (Math.PI * wheelDiameter / 1000));
        }
        if (rpm < rpmIdle) rpm = rpmIdle;
        if (raceState === 'finished') rpm = rpmIdle;

        // UI
        updateRpmUI();
        window.SoundManager.getPlayer('p1').update(rpm, speed);

        // Car & camera
        syncCarWithCamera(delta);

        // Finish check
        if (raceState === 'racing' && (Math.abs(playerTravelZ) + 2.25) >= RACE_FINISH_DISTANCE_METERS) finishRace();

        // World streaming
        const camZ = camera ? camera.position.z : CAMERA_BASE_POS.z;
        window.GameScene.recycleStreamPool(pools.roadSegments, STREAM_SEGMENT_LENGTH, camera);
        window.GameScene.recycleStreamPool(pools.streetLightPairs, STREET_LIGHT_STEP, camera);
        window.GameScene.recycleStreamPool(pools.decorations, DECORATION_STEP, camera);
        window.GameScene.updateStreetLightVisibility(pools.streetLightPairs, camera);

        // Atmosphere lights
        if (atmLights && carMesh) {
            policeLightTime += delta;
            const pos = carMesh.position;
            window.GameScene.updateAtmosphereLights(
                atmLights,
                { x: pos.x, y: pos.y, z: pos.z },
                { x: pos.x, y: pos.y, z: pos.z },
                policeLightTime
            );
        }

        // Smoke
        if (carMesh) window.GameScene.spawnWheelSmoke(scene, smokeParticles, carMesh, penaltyBrakeTimer, raceState);
        window.GameScene.updateSmoke(scene, smokeParticles, delta);

        if (renderer && scene && camera) renderer.render(scene, camera);
    })();

    // ── Boot ──────────────────────────────────────────────────────────────────
    createRpmMeter();
    if (gearMeterEl) gearMeterEl.innerHTML = 'N';
    initThree();
}

// Entry point
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}