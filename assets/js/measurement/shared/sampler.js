export class Sampler {

    constructor(intervalMs = 100) {
        this.interval = intervalMs;
        this.running = false;
        this._samples = [];
    }

    async run(fn, durationMs) {

        if (this.running)
            throw new Error("Sampler already running");

        this.running = true;
        this._samples = [];

        const start = performance.now();
        let expected = start;

        while (this.running) {

            const now = performance.now();
            if (now - start >= durationMs)
                break;

            try {
                const value = await fn();
                const sampleTime = performance.now();

                this._samples.push({
                    t: sampleTime - start,
                    v: value
                });

            } catch (e) {
                const sampleTime = performance.now();

                this._samples.push({
                    t: sampleTime - start,
                    v: null,
                    error: true
                });
            }

            expected += this.interval;

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

export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}