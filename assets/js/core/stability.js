import { Sampler } from "./scheduler.js";
import { probeRTT } from "./latency.js";

/**
 * Statistical helpers
 */

function average(values) {
    const valid = values.filter(v => v !== null);
    if (!valid.length) return null;
    return valid.reduce((a,b)=>a+b,0)/valid.length;
}

function stddev(values, mean) {
    const valid = values.filter(v => v !== null);
    if (!valid.length) return null;
    const variance = valid
        .map(v => (v - mean) ** 2)
        .reduce((a,b)=>a+b,0) / valid.length;
    return Math.sqrt(variance);
}

function min(values) {
    const valid = values.filter(v => v !== null);
    return valid.length ? Math.min(...valid) : null;
}

function max(values) {
    const valid = values.filter(v => v !== null);
    return valid.length ? Math.max(...valid) : null;
}


/**
 * Run a latency sampling session
 * @param {number} durationMs total measurement time
 * @param {number} intervalMs time between probes
 */
export async function measureStability(durationMs = 5000, intervalMs = 100) {

    const sampler = new Sampler(intervalMs);

    const samples = await sampler.run(async () => {
        return await probeRTT();
    }, durationMs);

    const values = samples.map(s => s.v);

    const avg = average(values);
    const jitter = avg !== null ? stddev(values, avg) : null;

    return {
        duration: durationMs,
        interval: intervalMs,
        samples,          // raw timeline [{t,v}]
        avg,
        jitter,
        min: min(values),
        max: max(values),
        loss: values.filter(v=>v===null).length / values.length
    };
}
