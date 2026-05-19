// multiplayer.js — 2-player mode
// Depends on: shared/constants.js, shared/meter.js, shared/physics.js, shared/scene.js
//             cars.js, assets.js, sound.js

function initMultiApp() {
    const C = window.GAME_CONSTANTS;
    const { RACE_COUNTDOWN_SECONDS, RACE_FINISH_DISTANCE_METERS, CAMERA_BASE_POS,
        STREAM_SEGMENT_LENGTH, STREET_LIGHT_STEP, DECORATION_STEP, STREAM_DIRECTION,
        SHIFT_PENALTY_BRAKE_LIGHT, SHIFT_PENALTY_BRAKE_HEAVY,
        SHIFT_PENALTY_DURATION_LIGHT, SHIFT_PENALTY_DURATION_HEAVY,
        SHIFT_PENALTY_TORQUE_LIGHT, SHIFT_PENALTY_TORQUE_HEAVY } = C;

    const CAR_BASE_POS_Z = -122;

    // ── URL params ────────────────────────────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const p1CarName = urlParams.get('p1') || 'car1';
    const p2CarName = urlParams.get('p2') || 'car2';
    const CAR_SPECS  = (window.CarCatalog && window.CarCatalog.specs) || {};

    // Load sound for p1 engine
    const p1SoundPath = (CAR_SPECS[p1CarName] && CAR_SPECS[p1CarName].vehicle.soundPath) || '../sounds/car1.ogg';
    window.SoundManager.load(p1SoundPath);
    window.SoundManager.setupVolumeButton();

    // ── Player class ──────────────────────────────────────────────────────────
    class Player {
        constructor(id, carName, meterSelector, gearSelector) {
            this.id   = id;
            this.spec = CAR_SPECS[carName] || CAR_SPECS.car1;
            this.carName = carName;

            this.gear  = 0;
            this.speed = 0;
            this.rpm   = this.spec.engine.rpmIdle;
            this.travelZ = 0;
            this.isAccelerating = false;
            this.finished  = false;
            this.finishTime = 0;
            this.mesh = null;

            this.clutchTimer     = 0;
            this.clutchTorqueBoost = 0;
            this.penaltyBrakeTimer = 0;
            this.penaltyBrakeLevel = 0;
            this.penaltyTorqueFactor = 1;

            this.shiftWindows = window.GamePhysics.calculateShiftWindows(this.spec);
            this.launchWindow = window.GamePhysics.calculateLaunchWindow(this.spec);

            this.gearEl = document.querySelector(gearSelector + ' div');
            const meterEl = document.querySelector(meterSelector);
            this.rpmMeter = null;
            if (meterEl) {
                meterEl.innerHTML = '';
                this.rpmMeter = new window.Meter(meterEl, {
                    value: this.spec.engine.rpmIdle,
                    valueMin: 0,
                    valueMax: this.spec.engine.rpmMax,
                    valueStep: 1000,
                    valueUnit: '<div>RPM</div><span>x1000</span>',
                    angleMin: 30, angleMax: 330,
                    labelUnit: 'Km/h',
                    labelFormat: v => Math.round(v / 1000),
                    needleFormat: () => Math.round(this.speed),
                    valueRed: this.spec.engine.rpmRedzone
                });
            }
        }

        updateUI() {
            if (this.rpmMeter) this.rpmMeter.setValue(this.rpm);
            if (this.gearEl) {
                this.gearEl.innerHTML = this.gear === 0 ? 'N' : this.gear;
                this.rpm > this.spec.engine.rpmRedzone
                    ? this.gearEl.classList.add('redzone')
                    : this.gearEl.classList.remove('redzone');
            }
            if (!this.rpmMeter) return;
            const maxGear = this.spec.vehicle.gears.length - 1;
            if (this.gear === 0) {
                this.launchWindow
                    ? this.rpmMeter.setWindow(this.launchWindow.min, this.launchWindow.max, this.launchWindow.target, this.rpm)
                    : this.rpmMeter.setWindow(null, null);
            } else if (this.gear >= maxGear) {
                this.rpmMeter.setWindow(null, null);
            } else {
                const sw = this.shiftWindows[this.gear];
                sw ? this.rpmMeter.setWindow(sw.min, sw.max, sw.target, this.rpm)
                   : this.rpmMeter.setWindow(null, null);
            }
        }

        setPenalty(level) {
            if (level === 'light') {
                this.penaltyBrakeTimer   = Math.max(this.penaltyBrakeTimer,   SHIFT_PENALTY_DURATION_LIGHT);
                this.penaltyBrakeLevel   = Math.max(this.penaltyBrakeLevel,   SHIFT_PENALTY_BRAKE_LIGHT);
                this.penaltyTorqueFactor = Math.min(this.penaltyTorqueFactor, SHIFT_PENALTY_TORQUE_LIGHT);
            } else {
                this.penaltyBrakeTimer   = Math.max(this.penaltyBrakeTimer,   SHIFT_PENALTY_DURATION_HEAVY);
                this.penaltyBrakeLevel   = Math.max(this.penaltyBrakeLevel,   SHIFT_PENALTY_BRAKE_HEAVY);
                this.penaltyTorqueFactor = Math.min(this.penaltyTorqueFactor, SHIFT_PENALTY_TORQUE_HEAVY);
            }
        }

        gearUp() {
            if (raceState !== 'racing') return;
            if (this.gear >= this.spec.vehicle.gears.length - 1) return;
            const prev = this.gear;
            const sw = this.shiftWindows[prev];
            if (sw) {
                if (this.rpm < sw.min) this.setPenalty(sw.min - this.rpm > 800 ? 'heavy' : 'light');
                else if (this.rpm > sw.max) this.setPenalty(this.rpm - sw.max > 500 ? 'heavy' : 'light');
            }
            this.gear++;
            this.engageGear(prev, this.gear);
        }

        engageGear(prevGear, nextGear) {
            if (prevGear !== 0 || nextGear <= 0) return;
            const { gears, transmitionRatio, wheelDiameter } = this.spec.vehicle;
            const targetRpm = gears[nextGear] !== 0
                ? this.speed / (60 * transmitionRatio * gears[nextGear] * (Math.PI * wheelDiameter / 1000))
                : 0;
            const diff = this.rpm - targetRpm;
            if (diff > 200) {
                this.clutchTimer = this.spec.clutch.engageTime;
                this.clutchTorqueBoost = (diff / this.spec.engine.rpmMax) * this.spec.clutch.boostMultiplier;
            } else if (diff < -200) {
                this.speed = Math.max(0, this.speed - Math.abs(diff) * this.spec.clutch.slipDrag);
            }
        }
    }

    // ── Players ───────────────────────────────────────────────────────────────
    const p1 = new Player('p1', p1CarName, '.meter--rpm.meter--p1', '.meter--gear.meter--p1');
    const p2 = new Player('p2', p2CarName, '.meter--rpm.meter--p2', '.meter--gear.meter--p2');

    // ── Race state ─────────────────────────────────────────────────────────────
    let raceState = 'loading';
    let raceElapsedTime = 0;
    let countdownLeft = RACE_COUNTDOWN_SECONDS;
    let assetsLoaded = { p1Car: false, p2Car: false };
    let smokeParticles = [];
    const pools = { roadSegments: [], streetLightPairs: [], decorations: [] };

    function checkAllAssetsLoaded() {
        if (assetsLoaded.p1Car && assetsLoaded.p2Car && raceState === 'loading') {
            raceState = 'countdown';
            document.getElementById('raceCountdown').classList.remove('hidden');
            window.SoundManager.getPlayer('p1').play(p1.rpm, p1.speed);
            window.SoundManager.getPlayer('p2').play(p2.rpm, p2.speed);
        }
    }

    function checkWinner() {
        if (raceState === 'finished') return;
        if (!p1.finished && !p2.finished) return;
        const winner   = p1.finished ? p1 : p2;
        const winLabel = p1.finished ? 'PLAYER 1' : 'PLAYER 2';
        document.getElementById('raceWinner').textContent = winLabel + ' WINS';
        document.getElementById('raceFinishTime').textContent = 'Time: ' + winner.finishTime.toFixed(2) + 's';
        document.getElementById('raceFinish').classList.remove('hidden');
        raceState = 'finished';
        window.SoundManager.stopAll();
    }

    // ── 3D scene ──────────────────────────────────────────────────────────────
    let scene, camera, renderer;
    let atmLights = null;
    let policeLightTime = 0;

    function loadCarModels() {
        if (!window.CarCatalog) return;

        function loadFor(player, flag) {
            const opts = {
                mode: 'sim',
                onModelLoaded() {
                    if (player.mesh) scene.remove(player.mesh);
                    player.mesh = window.CarCatalog.createCarMesh(THREE, player.carName, player.spec, { mode: 'sim' });
                    if (player.mesh) { applySimScale(player.mesh); scene.add(player.mesh); }
                    assetsLoaded[flag] = true;
                    checkAllAssetsLoaded();
                }
            };
            player.mesh = window.CarCatalog.createCarMesh(THREE, player.carName, player.spec, opts);
            if (player.mesh) { applySimScale(player.mesh); scene.add(player.mesh); assetsLoaded[flag] = true; checkAllAssetsLoaded(); }
        }

        loadFor(p1, 'p1Car');
        loadFor(p2, 'p2Car');
    }

    function applySimScale(mesh) {
        if (mesh && !mesh.userData.simScaleApplied) {
            mesh.scale.multiplyScalar(2.2);
            mesh.userData.simScaleApplied = true;
        }
    }

    function initThree() {
        ({ scene, camera, renderer } = window.GameScene.initThree(null, 60));
        atmLights = window.GameScene.setupAtmosphereLights(scene, { d: 16 }, { x: 0, y: -0.5, z: CAR_BASE_POS_Z });
        window.GameScene.buildRoadAndLights(scene, pools);
        window.GameScene.createFinishLine(scene, CAR_BASE_POS_Z - RACE_FINISH_DISTANCE_METERS);
        loadCarModels();
    }

    // ── Physics update ────────────────────────────────────────────────────────
    function updatePhysics(p, delta) {
        const { gears, transmitionRatio, wheelDiameter, mass, brakeTorqueMax } = p.spec.vehicle;
        const { rpmMax, rpmIdle } = p.spec.engine;

        // Braking
        let brakeTorque = 0;
        if (p.finished) {
            brakeTorque = brakeTorqueMax;
        } else if (p.penaltyBrakeTimer > 0) {
            p.penaltyBrakeTimer = Math.max(0, p.penaltyBrakeTimer - delta);
            brakeTorque = brakeTorqueMax * p.penaltyBrakeLevel;
        } else {
            p.penaltyBrakeLevel = 0; p.penaltyTorqueFactor = 1;
        }

        // Engine torque
        const torque = (raceState === 'racing' && p.isAccelerating && p.rpm < rpmMax)
            ? window.GamePhysics.torqueByRpm(p.rpm, p.spec.engine)
            : -(p.rpm * p.rpm / 1000000);

        // Transmission
        let wheelTorque, acceleration;
        if (gears[p.gear] === 0) {
            wheelTorque  = -brakeTorque;
            acceleration = 20 * wheelTorque / (wheelDiameter * mass / 2);
        } else {
            const ratio = transmitionRatio * gears[p.gear];
            wheelTorque = torque / ratio - brakeTorque;
            if (raceState === 'racing' && p.penaltyTorqueFactor < 1) wheelTorque *= p.penaltyTorqueFactor;
            if (p.clutchTimer > 0) {
                wheelTorque += p.clutchTorqueBoost;
                p.clutchTimer = Math.max(0, p.clutchTimer - delta);
                if (p.clutchTimer === 0) p.clutchTorqueBoost = 0;
            }
            acceleration = 20 * wheelTorque / (wheelDiameter * mass / 2);
        }

        p.speed = Math.max(0, p.speed + acceleration * delta);
        if (raceState === 'finished') p.speed = 0;

        // RPM
        if (gears[p.gear] === 0) {
            if (p.isAccelerating) p.rpm += p.spec.clutch.revUpRate * delta;
            else p.rpm += (rpmIdle - p.rpm) * p.spec.clutch.idleReturnRate * delta;
            p.rpm = Math.max(600, Math.min(rpmMax, p.rpm));
        } else {
            p.rpm = p.speed / (60 * transmitionRatio * gears[p.gear] * (Math.PI * wheelDiameter / 1000));
        }
        if (p.rpm < rpmIdle) p.rpm = rpmIdle;
        if (raceState === 'finished') p.rpm = rpmIdle;

        // Travel & finish
        p.travelZ += (p.speed / 3.6) * delta * STREAM_DIRECTION;
        if (!p.finished && (Math.abs(p.travelZ) + 2.25) >= RACE_FINISH_DISTANCE_METERS) {
            p.finished = true;
            p.finishTime = raceElapsedTime;
            checkWinner();
        }
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    function loop() {
        requestAnimationFrame(loop);
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        // Countdown
        if (raceState === 'countdown') {
            countdownLeft = Math.max(0, countdownLeft - delta);
            document.getElementById('raceCountdown').textContent = Math.ceil(countdownLeft);
            p1.gear = 0; p1.speed = 0;
            p2.gear = 0; p2.speed = 0;
            if (countdownLeft <= 0) {
                raceState = 'racing';
                document.getElementById('raceCountdown').classList.add('hidden');
                p1.gear = 1; p2.gear = 1;
            }
        } else if (raceState === 'racing') {
            raceElapsedTime += delta;
            p1.isAccelerating = true; p1.isBraking = false;
            p2.isAccelerating = true; p2.isBraking = false;
        }

        // Physics
        updatePhysics(p1, delta);
        updatePhysics(p2, delta);
        p1.updateUI();
        p2.updateUI();

        // Sound
        window.SoundManager.getPlayer('p1').update(p1.rpm, p1.speed);
        window.SoundManager.getPlayer('p2').update(p2.rpm, p2.speed);

        // Camera (follow the leading car)
        const leaderZ = Math.min(p1.travelZ, p2.travelZ); // most negative = furthest ahead
        const gap = Math.abs(p1.travelZ - p2.travelZ);
        const targetFov = gap < 45 ? 60 + Math.min(gap * 0.7, 30) : 60;
        camera.fov += (targetFov - camera.fov) * delta * 4;
        camera.updateProjectionMatrix();
        camera.position.set(CAMERA_BASE_POS.x, CAMERA_BASE_POS.y, CAMERA_BASE_POS.z + leaderZ);
        camera.lookAt(-300, -60, 10 + leaderZ);

        // Car mesh positions + wheels
        function syncCar(p, offsetX) {
            if (!p.mesh) return;
            p.mesh.position.set(offsetX, -0.5, CAR_BASE_POS_Z + p.travelZ);
            p.mesh.rotation.y = Math.PI;
            if (p.mesh.userData.wheels) {
                const radius = p.spec.vehicle.wheelDiameter / 2;
                const angVel = (p.speed / 3.6) / radius;
                p.mesh.userData.wheels.forEach(w => {
                    w.rotation[w.userData.axleName || 'x'] += angVel * delta;
                });
            }
        }
        syncCar(p1, 2);
        syncCar(p2, -2);

        // Streaming
        window.GameScene.recycleStreamPool(pools.roadSegments, STREAM_SEGMENT_LENGTH, camera);
        window.GameScene.recycleStreamPool(pools.streetLightPairs, STREET_LIGHT_STEP, camera);
        window.GameScene.recycleStreamPool(pools.decorations, DECORATION_STEP, camera);
        window.GameScene.updateStreetLightVisibility(pools.streetLightPairs, camera);

        // Atmosphere
        if (atmLights) {
            policeLightTime += delta;
            const midZ = CAR_BASE_POS_Z + (p1.travelZ + p2.travelZ) / 2;
            const trailingZ = CAR_BASE_POS_Z + Math.max(p1.travelZ, p2.travelZ);
            window.GameScene.updateAtmosphereLights(
                atmLights,
                { x: 0, y: -0.5, z: midZ },
                { x: 0, y: -0.5, z: trailingZ },
                policeLightTime
            );
        }

        // Smoke
        window.GameScene.spawnWheelSmoke(scene, smokeParticles, p1.mesh, p1.penaltyBrakeTimer, raceState);
        window.GameScene.spawnWheelSmoke(scene, smokeParticles, p2.mesh, p2.penaltyBrakeTimer, raceState);
        window.GameScene.updateSmoke(scene, smokeParticles, delta);

        renderer.render(scene, camera);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    const UI_SELECTORS = '#restartRaceBtn,#menuRaceBtn,.btn-volume,.race-btn';
    function isUITarget(e) { return e.target.closest && e.target.closest(UI_SELECTORS); }

    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (k === 'w' || e.key === 'ArrowUp') {
            window.SoundManager.resume();
        }
        if (k === 'w') p1.isAccelerating = true;
        if (k === 'd') p1.gearUp();
        if (e.key === 'ArrowUp') p2.isAccelerating = true;
        if (e.key === 'ArrowRight') p2.gearUp();
    });
    window.addEventListener('keyup', e => {
        if (e.key.toLowerCase() === 'w') p1.isAccelerating = false;
        if (e.key === 'ArrowUp') p2.isAccelerating = false;
    });

    function handleTouchStart(clientX) {
        window.SoundManager.resume();
        if (clientX < window.innerWidth / 2) {
            if (raceState === 'racing') p1.gearUp(); else p1.isAccelerating = true;
        } else {
            if (raceState === 'racing') p2.gearUp(); else p2.isAccelerating = true;
        }
    }
    function handleTouchEnd(clientX) {
        if (clientX < window.innerWidth / 2) p1.isAccelerating = false;
        else p2.isAccelerating = false;
    }

    window.addEventListener('touchstart', e => {
        if (isUITarget(e)) return;
        e.preventDefault();
        for (const t of e.changedTouches) handleTouchStart(t.clientX);
    }, { passive: false });
    window.addEventListener('touchend', e => {
        if (isUITarget(e)) return;
        for (const t of e.changedTouches) handleTouchEnd(t.clientX);
    }, { passive: false });
    window.addEventListener('touchcancel', e => {
        for (const t of e.changedTouches) handleTouchEnd(t.clientX);
    }, { passive: false });
    window.addEventListener('mousedown', e => { if (isUITarget(e)) return; handleTouchStart(e.clientX); });
    window.addEventListener('mouseup',   e => { if (isUITarget(e)) return; handleTouchEnd(e.clientX); });

    document.getElementById('restartRaceBtn').onclick = () => window.location.reload();
    document.getElementById('menuRaceBtn').onclick = () => window.location.href = '../index.html';

    // ── Boot ──────────────────────────────────────────────────────────────────
    initThree();
    loop();
}

initMultiApp();
