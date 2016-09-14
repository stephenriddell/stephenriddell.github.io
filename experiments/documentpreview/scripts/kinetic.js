function defValue(provided, def) {
    'use strict';
    return provided !== undefined ? provided : def;
}

!function (w) {
    'use strict';

    function rollingAverage(oldAverage, newValue) {
        return 0.9 * newValue + 0.1 * oldAverage;
    }

    var kineticDefaults = {
        offset: 0,
        snapFn: function (x) { return x; },
        restrictFn: function (x) { return x; },
        autoScrollThreshold: 10,
        easingFn: function (t) {
            var a = 0.008;
            var ease = 1 - (Math.exp(-t / 225) - a) / (1 - a);
            if (ease > 1) {
                ease = 1;
            }
            return ease;
        },
        moveFn: function (t, d) {
            return t + d;
        }
    };

    w.kinetic = function kinetic(opts) {
        var offset = defValue(opts.offset, 0);
        var velocity = 0; //currently tracked control velocity
        var timestamp = Date.now(); //most recent tracked time
        var target; //target positon to move to automatically
        var amplitude; //total amount of movement in current automatic movement
        var snapFn = //function to snap to items. Identity function for no snap.
            defValue(opts.snapFn, kineticDefaults.snapFn);
        var restrictFn =  //function to restrict range of values
            //(typically clamping or identity function - cylcical behaviour should be implemented by the renderer)
            defValue(opts.restrictFn, kineticDefaults.restrictFn);
        var easingFn = //easing function  for automated scrolling default exponential decay
            defValue(opts.easingFn, kineticDefaults.easingFn);
        var listeners =
            defValue(opts.listeners, []);
        var autoScrollThreshold =
            defValue(opts.autoScrollThreshold, kineticDefaults.autoScrollThreshold);
        var moveFn =
            defValue(opts.moveFn, kineticDefaults.moveFn);


        var autoScrollFn;
        autoScrollFn = function () {
            if (amplitude !== 0) { // amplitude === 0 implies no autoscrolling
                var now = Date.now();
                var timeDelta = now - timestamp;
                var delta = amplitude * (1 - easingFn(timeDelta));
                offset = target - delta;
                listeners.forEach(function (l) {
                    l(offset);
                });
                if (delta != 0) {
                    window.requestAnimationFrame(autoScrollFn);
                }
            }
        };

        var lastTrackedOffset = offset;
        var tracking = false;
        var trackTicker;
        var trackVelocity = function trackVelocity() {
            var now = Date.now();
            var timeDelta = now - timestamp;
            timestamp = now;
            var posDelta = offset - lastTrackedOffset;
            lastTrackedOffset = offset;

            var v = posDelta / (timeDelta + 1) * 1000; //units/second
            velocity = rollingAverage(velocity, v);
            if (velocity > 10000) { velocity = 10000; }
            if (velocity < -10000) { velocity = - 10000; }
            if (!tracking) {
                w.clearInterval(trackTicker);
            }
        };

        function moveBy(x) {
            amplitude = 0; // manual movement - no auto movement
            offset = restrictFn(moveFn(offset, x));
            if (!tracking) {
                tracking = true;
                velocity = 0;
                timestamp = Date.now();
                trackTicker = w.setInterval(trackVelocity, 20);
            }
            listeners.forEach(function (l) {
                l(offset);
            });
        }

        function release() {
            tracking = false;
            var now = Date.now();
            target = offset;
            if (velocity > autoScrollThreshold || velocity < -autoScrollThreshold) {
                amplitude = 0.5 * velocity;
                target = target + amplitude;
            }
            target = snapFn(restrictFn(target));
            amplitude = target - offset;
            timestamp = now;
            window.requestAnimationFrame(autoScrollFn);
        }

        function stop() {
            if (trackTicker) {
                w.clearInterval(trackTicker);
            }
            velocity = 0;
            release();
        }

        function offsetFn() {
            return offset;
        }

        return {
            moveBy: moveBy,
            release: release,
            stop: stop,
            offset: offsetFn
        };
    };
} (window);