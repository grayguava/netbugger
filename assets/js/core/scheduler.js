/**
 * High precision sampling scheduler
 * Keeps consistent intervals regardless of execution delay.
 *
 * Why not setInterval?
 * Because setInterval accumulates drift:
 *   100ms → 105 → 110 → 130 → inaccurate jitter measurement
 *
 * This scheduler compensates drift by scheduling next tick
 * relative to original timeline, not previous execution time.
 */

export class Sampler {

    constructor(intervalMs = 100) {
        this.interval = intervalMs;
        this.running = false;
        this._samples = [];
    }

    /**
     * Run a function repeatedly with precise timing
     * @param {Function} fn async or sync function returning a value
     * @param {number} durationMs total run duration
     * @returns {Promise<Array>} collected results
     */
    async run(fn, durationMs) {

        if (this.running)
            throw new Error("Sampler already running");

        this.running = true;
        this._samples = [];

        const start = performance.now();
        let expected = start;

        while (true) {

            const now = performance.now();
            if (now - start >= durationMs) break;

            // execute measurement
            try {
                const value = await fn();
                this._samples.push({
                    t: now - start,
                    v: value
                });
            } catch (e) {
                this._samples.push({
                    t: now - start,
                    v: null,
                    error: true
                });
            }

            // compute next scheduled time
            expected += this.interval;

            // drift compensation
            const delay = Math.max(0, expected - performance.now());

            await sleep(delay);
        }

        this.running = false;
        return this._samples;
    }

    stop() {
        this.running = false;
    }
}


/**
 * simple sleep helper
 */
export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
