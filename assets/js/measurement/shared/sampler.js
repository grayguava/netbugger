export class Sampler {

  constructor(intervalMs = 100) {
    this.interval = intervalMs;
    this.running = false;
    this._samples = [];
  }

  async run(fn, count) {
    if (this.running)
      throw new Error("Sampler already running");

    this.running = true;
    this._samples = [];

    const start = performance.now();

    let expected = start;

    for (let i = 0; i < count && this.running; i++) {
      const probeStart = performance.now();

      try {
        const value = await fn();
        this._samples.push({
          t: performance.now() - start, 
          v: value
        });
      } catch (e) {
        this._samples.push({
          t: performance.now() - start,
          v: null,
          error: true
        });
      }

    expected += this.interval;
      const delay = Math.max(0, expected - performance.now());

      if (i < count - 1) {
        await sleep(delay);
      }
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