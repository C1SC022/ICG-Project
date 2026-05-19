// Meter — RPM gauge widget used in both singleplayer and multiplayer HUDs.
// Depends on: nothing (pure DOM)

window.Meter = function Meter($elm, config) {
    let $needle, $value, $windowLayer;
    let lastWindowMin = null, lastWindowMax = null;

    const steps = (config.valueMax - config.valueMin) / config.valueStep;
    const angleStep = (config.angleMax - config.angleMin) / steps;
    const margin = 15; // label offset in %

    function value2angle(value) {
        return (value / (config.valueMax - config.valueMin)) * (config.angleMax - config.angleMin) + config.angleMin;
    }

    function makeElement(parent, className, innerHtml, style) {
        const e = document.createElement('div');
        e.className = className;
        if (innerHtml) e.innerHTML = innerHtml;
        if (style) { for (const prop in style) e.style[prop] = style[prop]; }
        parent.appendChild(e);
        return e;
    }

    this.setValue = function (v) {
        $needle.style.transform = 'translate3d(-50%, 0, 0) rotate(' + Math.round(value2angle(v)) + 'deg)';
        $value.innerHTML = config.needleFormat(v);
    };

    this.setWindow = function (minValue, maxValue, targetValue, currentValue) {
        if (!$windowLayer) return;
        if (minValue == null || maxValue == null) {
            $windowLayer.innerHTML = '';
            lastWindowMin = null; lastWindowMax = null;
            return;
        }
        if (lastWindowMin === minValue && lastWindowMax === maxValue) return;
        lastWindowMin = minValue; lastWindowMax = maxValue;
        $windowLayer.innerHTML = '';

        const startValue = Math.max(config.valueMin, Math.min(minValue, maxValue));
        const endValue = Math.min(config.valueMax, Math.max(minValue, maxValue));
        const startAngle = value2angle(startValue);
        const endAngle = value2angle(endValue);

        for (let a = startAngle; a <= endAngle; a += 1.5) {
            makeElement($windowLayer, 'shift-window-tick shift-window-tick--orange', '', {
                left: (50 - 47 * Math.sin(a * (Math.PI / 180))) + '%',
                top: (50 + 47 * Math.cos(a * (Math.PI / 180))) + '%',
                transform: 'translate3d(-50%, 0, 0) rotate(' + (a + 180) + 'deg)'
            });
        }

        if (typeof targetValue !== 'undefined') {
            const span = endValue - startValue;
            if (span > 0) {
                const cur = (typeof currentValue !== 'undefined') ? currentValue : targetValue;
                const closeness = Math.max(0, Math.min(1, 1 - Math.abs(cur - targetValue) / Math.max(1, span)));
                const greenSpan = Math.max(25, span * (0.5 * (1 - closeness)));
                const greenMin = Math.max(startValue, targetValue - greenSpan / 2);
                const greenMax = Math.min(endValue, targetValue + greenSpan / 2);
                const greenStartAngle = value2angle(greenMin);
                const greenEndAngle = value2angle(greenMax);
                for (let a = greenStartAngle; a <= greenEndAngle; a += 1.5) {
                    makeElement($windowLayer, 'shift-window-tick shift-window-tick--green', '', {
                        left: (50 - 47 * Math.sin(a * (Math.PI / 180))) + '%',
                        top: (50 + 47 * Math.cos(a * (Math.PI / 180))) + '%',
                        transform: 'translate3d(-50%, 0, 0) rotate(' + (a + 180) + 'deg)'
                    });
                }
            }
        }
    };

    // Build gauge DOM
    makeElement($elm, 'label label-unit', config.valueUnit);
    $windowLayer = makeElement($elm, 'shift-window-layer');

    for (let n = 0; n < steps + 1; n++) {
        const value = config.valueMin + n * config.valueStep;
        const angle = config.angleMin + n * angleStep;
        const redzoneClass = value > config.valueRed ? ' redzone' : '';

        // Skip label text on the very last tick when there are more than 8 steps
        // (avoids overlap with the RPM/X1000 unit text at the bottom of the dial)
        const isLastTickOverflow = (n === steps && steps > 8);
        makeElement($elm, 'grad grad--' + n + redzoneClass, isLastTickOverflow ? '' : config.labelFormat(value), {
            left: (50 - (50 - margin) * Math.sin(angle * (Math.PI / 180))) + '%',
            top: (50 + (50 - margin) * Math.cos(angle * (Math.PI / 180))) + '%'
        });
        makeElement($elm, 'grad-tick grad-tick--' + n + redzoneClass, '', {
            left: (50 - 50 * Math.sin(angle * (Math.PI / 180))) + '%',
            top: (50 + 50 * Math.cos(angle * (Math.PI / 180))) + '%',
            transform: 'translate3d(-50%, 0, 0) rotate(' + (angle + 180) + 'deg)'
        });

        const angleHalf = angle + angleStep / 2;
        if (angleHalf < config.angleMax) {
            makeElement($elm, 'grad-tick grad-tick--half grad-tick--' + n + redzoneClass, '', {
                left: (50 - 50 * Math.sin(angleHalf * (Math.PI / 180))) + '%',
                top: (50 + 50 * Math.cos(angleHalf * (Math.PI / 180))) + '%',
                transform: 'translate3d(-50%, 0, 0) rotate(' + (angleHalf + 180) + 'deg)'
            });
        }
        const angleQuarter = angle + angleStep / 4;
        if (angleQuarter < config.angleMax) {
            makeElement($elm, 'grad-tick grad-tick--quarter grad-tick--' + n + redzoneClass, '', {
                left: (50 - 50 * Math.sin(angleQuarter * (Math.PI / 180))) + '%',
                top: (50 + 50 * Math.cos(angleQuarter * (Math.PI / 180))) + '%',
                transform: 'translate3d(-50%, 0, 0) rotate(' + (angleQuarter + 180) + 'deg)'
            });
        }
        const angleThreeQ = angle + angleStep * 3 / 4;
        if (angleThreeQ < config.angleMax) {
            makeElement($elm, 'grad-tick grad-tick--quarter grad-tick--' + n + redzoneClass, '', {
                left: (50 - 50 * Math.sin(angleThreeQ * (Math.PI / 180))) + '%',
                top: (50 + 50 * Math.cos(angleThreeQ * (Math.PI / 180))) + '%',
                transform: 'translate3d(-50%, 0, 0) rotate(' + (angleThreeQ + 180) + 'deg)'
            });
        }
    }

    $needle = makeElement($elm, 'needle', '', {
        transform: 'translate3d(-50%, 0, 0) rotate(' + value2angle(config.value) + 'deg)'
    });
    makeElement($elm, 'needle-axle');
    makeElement($elm, 'label label-value',
        '<div>' + config.labelFormat(config.value) + '</div><span>' + config.labelUnit + '</span>');
    $value = $elm.querySelector('.label-value div');
};
