const TOKEN_ENDPOINT  = "/api/stream";
const STREAM_ENDPOINT = "/api/stream";
const BASE_DURATION   = 14_000;
const MAX_DURATION    = 20_000;
const BUCKET_MS       = 750;
const PARALLEL        = 4;
const RAMP_WINDOW     = 3;


function percentile(sorted, p) {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stddev(arr) {
  const mu = mean(arr);
  return Math.sqrt(arr.map(v => (v - mu) ** 2).reduce((a, b) => a + b, 0) / arr.length);
}
function toMBps(mbps) { return parseFloat((mbps / 8).toFixed(3)); }
function isStillRamping(vals) {
  if (vals.length < 3) return true;
  const rises = vals.filter((v, i) => i > 0 && v > vals[i - 1]).length;
  return rises / (vals.length - 1) >= 0.60;
}


function bucketEvents(chunkLog, durationMs) {
  if (!chunkLog.length) return [];
  const buckets = new Map();
  for (const { t, bytes } of chunkLog) {
    const idx = Math.floor(t / BUCKET_MS);
    buckets.set(idx, (buckets.get(idx) ?? 0) + bytes);
  }
  const samples = [];
  const maxIdx  = Math.floor(durationMs / BUCKET_MS);
  for (let i = 0; i <= maxIdx; i++) {
    const bucketStartMs = i * BUCKET_MS;
    const bytes = buckets.get(i) ?? 0;
    if (bytes === 0 && i === 0) continue;
    const fill = Math.min(1, (durationMs - bucketStartMs) / BUCKET_MS);
    if (fill < 0.50) continue;
    const effectiveMs = Math.min(BUCKET_MS, durationMs - bucketStartMs);
    const mbps = (bytes * 8) / (effectiveMs * 1000);
    samples.push({
      t:    parseFloat(((i + 1) * BUCKET_MS / 1000).toFixed(3)),
      mbps: parseFloat(mbps.toFixed(3)),
      MBps: toMBps(mbps),
    });
  }
  return samples;
}


function computeStats(samples) {
  if (!samples.length) return null;
  const vals = samples.map(s => s.mbps);
  const halfwayIdx     = Math.floor(vals.length / 2);
  const roughSustained = percentile([...vals.slice(halfwayIdx)].sort((a,b)=>a-b), 0.75);
  const rampThreshold  = roughSustained * 0.90;
  let rampIdx = null, ramp_ms = null;
  for (let i = 0; i <= vals.length - RAMP_WINDOW; i++) {
    const avg = vals.slice(i, i + RAMP_WINDOW).reduce((s,v) => s + v, 0) / RAMP_WINDOW;
    if (avg >= rampThreshold) { rampIdx = i + RAMP_WINDOW - 1; ramp_ms = samples[rampIdx].t * 1000; break; }
  }
  const postRampVals   = rampIdx != null ? vals.slice(rampIdx) : vals;
  const stillRamping   = isStillRamping(postRampVals);
  const sortedPost     = [...postRampVals].sort((a,b)=>a-b);
  const sorted_all     = [...vals].sort((a,b)=>a-b);
  const sustained_mbps = percentile(sortedPost, 0.75);
  const peak_mbps      = percentile(sorted_all, 0.95);
  const p99_mbps       = percentile(sorted_all, 0.99);
  const average_mbps   = mean(vals);
  const variance_mbps      = stddev(vals);
  const variance_post_mbps = postRampVals.length >= 2 ? stddev(postRampVals) : variance_mbps;
  return {
    sustained_mbps:       parseFloat(sustained_mbps.toFixed(2)),
    sustained_MBps:       toMBps(sustained_mbps),
    peak_mbps:            parseFloat(peak_mbps.toFixed(2)),
    peak_MBps:            toMBps(peak_mbps),
    p99_mbps:             parseFloat(p99_mbps.toFixed(2)),
    p99_MBps:             toMBps(p99_mbps),
    average_mbps:         parseFloat(average_mbps.toFixed(2)),
    average_MBps:         toMBps(average_mbps),
    variance_mbps:        parseFloat(variance_mbps.toFixed(2)),
    variance_MBps:        toMBps(variance_mbps),
    variance_post_mbps:   parseFloat(variance_post_mbps.toFixed(2)),
    variance_post_MBps:   toMBps(variance_post_mbps),
    ramp_ms:              ramp_ms != null ? Math.round(ramp_ms) : null,
    still_ramping:        stillRamping,
  };
}


export async function runThroughputTest({ onSample, onStatus } = {}) {
  onStatus?.("Requesting stream token…");
  let token;
  try {
    const res  = await fetch(TOKEN_ENDPOINT, { cache: "no-store" });
    const body = await res.json();
    if (res.status === 429) throw new Error(body.message ?? "Daily beta limit reached — try again tomorrow.");
    if (!body.ok || !body.token) throw new Error(body.error ?? "Token request failed");
    token = body.token;
  } catch (err) {
    throw err.message ? err : new Error("Could not obtain stream token: " + err);
  }

  onStatus?.("Opening streams…");
  const testStart     = performance.now();
  const chunkLog      = [];
  const totalBytesRef = { value: 0 };
  const controller    = new AbortController();

  async function pump(url) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const t = performance.now() - testStart;
        totalBytesRef.value += value.byteLength;
        chunkLog.push({ t, bytes: value.byteLength });
      }
    } catch (err) {
      if (err.name !== "AbortError") console.warn("[throughput] stream:", err.message);
    }
  }

  let lastEmittedBucket = -1;
  let tickerHandle = null;
  if (onSample) {
    tickerHandle = setInterval(() => {
      const now = performance.now() - testStart;
      const completedIdx = Math.floor(now / BUCKET_MS) - 1;
      if (completedIdx <= lastEmittedBucket) return;
      for (let i = lastEmittedBucket + 1; i <= completedIdx; i++) {
        const lo = i * BUCKET_MS, hi = lo + BUCKET_MS;
        let bytes = 0;
        for (const e of chunkLog) { if (e.t >= lo && e.t < hi) bytes += e.bytes; }
        if (bytes === 0) continue;
        const mbps = (bytes * 8) / (BUCKET_MS * 1000);
        onSample({ t: parseFloat((hi/1000).toFixed(3)), mbps: parseFloat(mbps.toFixed(3)), MBps: toMBps(mbps) });
        lastEmittedBucket = i;
      }
    }, BUCKET_MS);
  }

  const streamUrl   = `${STREAM_ENDPOINT}/${token}`;
  const streamsDone = Promise.all(Array.from({ length: PARALLEL }, () => pump(streamUrl)));

  onStatus?.("Measuring…");
  await new Promise(resolve => setTimeout(resolve, BASE_DURATION));

  const elapsed        = performance.now() - testStart;
  const prelim         = bucketEvents(chunkLog, elapsed);
  const prelimVals     = prelim.map(s => s.mbps);
  const halfIdx        = Math.floor(prelimVals.length / 2);
  const roughSustained = prelimVals.length >= 4
    ? percentile([...prelimVals.slice(halfIdx)].sort((a,b)=>a-b), 0.75) : null;

  let finalDuration = BASE_DURATION;
  if (roughSustained != null) {
    const rampThreshold = roughSustained * 0.90;
    let rampMs = null;
    for (let i = 0; i <= prelimVals.length - RAMP_WINDOW; i++) {
      const avg = prelimVals.slice(i, i + RAMP_WINDOW).reduce((s,v)=>s+v,0) / RAMP_WINDOW;
      if (avg >= rampThreshold) { rampMs = prelim[i + RAMP_WINDOW - 1].t * 1000; break; }
    }
    const postRamp = rampMs != null ? prelimVals.slice(prelim.findIndex(s => s.t * 1000 >= rampMs)) : [];
    const stillRamping = postRamp.length >= 2 ? isStillRamping(postRamp) : true;
    const rampRatio    = (rampMs ?? BASE_DURATION) / BASE_DURATION;
    if (stillRamping && rampRatio > 0.50) {
      finalDuration = MAX_DURATION;
    } else if (rampRatio > 0.40) {
      const ext = Math.min(MAX_DURATION - BASE_DURATION, Math.round(((rampMs - BASE_DURATION * 0.40) * 1.5) / 1000) * 1000);
      finalDuration = BASE_DURATION + Math.max(0, ext);
    }
  }

  const remaining = finalDuration - (performance.now() - testStart);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  controller.abort();
  await streamsDone;
  if (tickerHandle) clearInterval(tickerHandle);

  const duration_ms = Math.round(performance.now() - testStart);
  const samples     = bucketEvents(chunkLog, duration_ms);
  const stats       = computeStats(samples);
  return { ...stats, duration_ms, bytes_total: totalBytesRef.value, streams: PARALLEL, samples };
}