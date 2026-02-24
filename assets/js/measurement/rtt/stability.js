import { Sampler } from "../shared/sampler.js";
import { probeRTT } from "./probe.js";

/**
 * Compute statistics from numeric RTT samples
 */
function computeStats(values) {
  const valid = values.filter(v => v !== null);

  if (!valid.length) {
    return {
      avg: null,
      jitter: null,
      min: null,
      max: null,
      loss: 1
    };
  }

  const avg =
    valid.reduce((a, b) => a + b, 0) / valid.length;

  const variance =
    valid.map(v => (v - avg) ** 2)
         .reduce((a, b) => a + b, 0) / valid.length;

  return {
    avg,
    jitter: Math.sqrt(variance),
    min: Math.min(...valid),
    max: Math.max(...valid),
    loss: (values.length - valid.length) / values.length
  };
}


/**
 * Run RTT stability measurement session
 *
 * @param {number} durationMs
 * @param {number} intervalMs
 * @param {Function} onSample callback ({ latency })
 */
export async function measureRTT(
  durationMs = 5000,
  intervalMs = 100,
  onSample
) {
  const sampler = new Sampler(intervalMs);

  const samples = await sampler.run(async () => {
    const result = await probeRTT();

    if (onSample && result.latency != null) {
      onSample({ latency: result.latency });
    }

    return result.latency;
  }, durationMs);

  const values = samples.map(s => s.v);

const stats = computeStats(values);

return {
  duration: durationMs,
  interval: intervalMs,
  samples,
  ...stats
};
}