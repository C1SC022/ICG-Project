// Physics helpers shared by both singleplayer and multiplayer modes.
// Depends on: nothing (pure math)

window.GamePhysics = {
    /**
     * Gaussian-shaped engine torque curve.
     * @param {number} rpm
     * @param {object} engineSpec  { torqueMin, torqueMax, torquePeak, torqueSigma }
     */
    torqueByRpm(rpm, engineSpec) {
        const x = (rpm - engineSpec.torquePeak) / engineSpec.torqueSigma;
        return engineSpec.torqueMin + (engineSpec.torqueMax - engineSpec.torqueMin) * Math.exp(-0.5 * x * x);
    },

    /**
     * Calculates optimal RPM windows for each gear change.
     * @param {object} spec  Full car spec ({ vehicle, engine })
     * @returns {object}  { [gear]: { min, max, target } }
     */
    calculateShiftWindows(spec) {
        const windows = {};
        const { gears, transmitionRatio } = spec.vehicle;
        const { rpmIdle, rpmMax, rpmRedzone } = spec.engine;
        const maxGear = gears.length - 1;

        for (let g = 1; g < maxGear; g++) {
            const nextGear = g + 1;
            let shiftRpm = rpmMax;
            let foundCrossover = false;

            for (let testRpm = rpmIdle; testRpm <= rpmMax; testRpm += 25) {
                const nextRpm = testRpm * gears[g] / gears[nextGear];
                if (nextRpm < rpmIdle) continue;

                const curWheelTorque = this.torqueByRpm(testRpm, spec.engine) / (transmitionRatio * gears[g]);
                const nextWheelTorque = this.torqueByRpm(nextRpm, spec.engine) / (transmitionRatio * gears[nextGear]);

                if (nextWheelTorque >= curWheelTorque) {
                    shiftRpm = testRpm;
                    foundCrossover = true;
                    break;
                }
            }

            if (!foundCrossover) shiftRpm = rpmMax;

            if (shiftRpm >= rpmMax - 50) {
                windows[g] = { min: Math.max(rpmRedzone, rpmMax - 450), max: rpmMax, target: shiftRpm };
            } else {
                windows[g] = {
                    min: Math.max(rpmIdle, shiftRpm - 200),
                    max: Math.min(rpmMax, shiftRpm + 200),
                    target: shiftRpm
                };
            }
        }
        return windows;
    },

    /**
     * Calculates the optimal launch RPM window (neutral to 1st gear).
     * @param {object} spec  Full car spec
     * @returns {{ min, max, target } | null}
     */
    calculateLaunchWindow(spec) {
        const firstGear = spec.vehicle.gears[1];
        if (!firstGear) return null;

        const { rpmIdle, rpmMax } = spec.engine;
        const { transmitionRatio } = spec.vehicle;
        let maxLaunchTorque = -Infinity;
        const samples = [];

        for (let testRpm = rpmIdle; testRpm <= rpmMax; testRpm += 25) {
            const t = this.torqueByRpm(testRpm, spec.engine) / (transmitionRatio * firstGear);
            samples.push({ rpm: testRpm, torque: t });
            if (t > maxLaunchTorque) maxLaunchTorque = t;
        }

        const threshold = maxLaunchTorque * 0.95;
        let minRpm = rpmMax, maxRpm = rpmIdle, targetRpm = rpmMax;

        for (const s of samples) {
            if (s.torque >= threshold) {
                minRpm = Math.min(minRpm, s.rpm);
                maxRpm = Math.max(maxRpm, s.rpm);
            }
        }
        for (const s of samples) {
            if (s.torque === maxLaunchTorque) { targetRpm = s.rpm; break; }
        }
        return { min: minRpm, max: maxRpm, target: targetRpm };
    }
};
