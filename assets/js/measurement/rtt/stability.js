import { probeRTT } from "./probe.js";
import { Sampler } from "../shared/sampler.js";

const FIXED_SAMPLES = 100;

function computeStats(allValues) {
  const total = allValues.length;
  const valid = allValues.filter(v => v !== null);

  if (!valid.length) {
    return {
      samples: 0,
      attempts: total,
      median: null,
      p90: null,
      min: null,
      max: null,
      jitter_std: null,
      loss: 1
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const n = sorted.length;

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  const p90Index = Math.ceil(0.9 * n) - 1;
  const p90 = sorted[Math.max(0, p90Index)];

  const min = sorted[0];
  const max = sorted[n - 1];

  const avg = valid.reduce((a, b) => a + b, 0) / n;

  const variance =
    valid.map(v => (v - avg) ** 2)
         .reduce((a, b) => a + b, 0) / n;

  const jitter_std = Math.sqrt(variance);

  return {
    samples: n,
    attempts: total,
    median,
    p90,
    min,
    max,
    jitter_std,
    loss: (total - n) / total
  };
}

export async function measureRTT({
  endpoint = "/api/ping",
  intervalMs = 100,
  onSample
} = {}) {

  const sampler = new Sampler(intervalMs);

  const raw = await sampler.run(async () => {
    const result = await probeRTT(endpoint);

    const ttfb = result.success && result.ttfb != null
      ? result.ttfb
      : null;

    if (ttfb !== null && onSample) {
      onSample({ ttfb, latency: result.latency });
    }

    return ttfb;
  }, FIXED_SAMPLES);

  const allValues = raw.map(s => s.v);

  return {
    samples: FIXED_SAMPLES,
    intervalMs,
    durationMs: raw.length ? raw[raw.length - 1].t : 0,
    ...computeStats(allValues),
    raw: allValues
  };
}