# Measurement : Throughput test

## Pipeline overview

```
GET /api/stream           → token issued (KV-gated)
GET /api/stream/<token>   → 8 parallel streams opened
chunk events              → logged to chunkLog with timestamps
750ms ticker              → live samples emitted via onSample
BASE_DURATION (14s)       → preliminary stats computed
adaptive extension        → 0–6s added if still ramping
controller.abort()        → all streams terminated
bucketEvents()            → final sample array computed
computeStats()            → final stats returned
```

Implemented in `assets/js/measurement/throughput/measureDownlink.js` and `functions/api/stream/`.

---

## Constants

```js
const BASE_DURATION  = 14_000;  // ms — minimum test duration
const MAX_DURATION   = 24_000;  // ms — maximum test duration
const BUCKET_MS      = 750;     // ms — bucketing window
const PARALLEL       = 8;       // parallel streams
const RAMP_WINDOW    = 5;       // buckets used in ramp detection sliding window
```

Server-side (globals.js):
```js
export const TOTAL_BYTES          = 100 * 1024 * 1024;  // 100 MB per stream
export const CHUNK_SIZE           = 64  * 1024;          // 64 KB per write
export const TOKEN_TTL_MS         = 30  * 1000;          // 30s token validity
export const MAX_STREAMS_PER_TOKEN = 8;                  // matches PARALLEL
export const DAILY_TOKEN_LIMIT    = 100;                 // global daily cap
export const COUNTER_TTL_SECONDS  = 25 * 60 * 60;       // KV key expiry
```

---

## Token issuance: `GET /api/stream`

**File:** `functions/api/stream/index.js`

1. Reads KV namespace `LIBREPROBE_THROUGHPUT_RL` from env. Returns 500 if not bound.
2. Calls `canIssueToken(kv)` — reads today's UTC counter from KV (`daily:YYYY-MM-DD`). Returns 429 if count ≥ `DAILY_TOKEN_LIMIT`.
3. Calls `issueToken(kv)` — increments counter, generates `crypto.randomUUID()`, stores token in the in-memory `activeTokens` Map with expiry and stream counter.
4. Returns `{ ok: true, token }`.

**KV counter key format:** `daily:YYYY-MM-DD` (UTC). Expires after `COUNTER_TTL_SECONDS` (25 hours) for automatic cleanup.

**Isolate caveat:** `activeTokens` is in-memory per isolate. The global daily cap is enforced in KV (shared across isolates), but token validation happens in-memory on whichever isolate received the token request. Cloudflare may route stream requests to a different isolate, in which case the token will not be found and the stream will be rejected with 403. This is an accepted limitation at current scale.

---

## Stream worker: `GET /api/stream/[token]`

**File:** `functions/api/stream/[token].js`

1. Calls `validateAndConsumeStream(token)` — checks token exists in `activeTokens`, is not expired, and has not exhausted its stream count. Increments `streamsOpened`. If `streamsOpened >= maxStreams`, deletes the token (fully consumed).
2. Returns 403 if validation fails.
3. Creates a `TransformStream`. The write loop runs in a detached async IIFE:
   - Writes `CHUNK_SIZE` (64 KB) chunks of pre-generated random bytes
   - Checks `active` flag on each iteration — set to false on `request.signal` abort
   - Stops when `sent >= TOTAL_BYTES` (100 MB) or aborted
4. Returns the readable end of the TransformStream as the response body with `Content-Encoding: identity` (no compression) and `Cache-Control: no-store`.

The chunk is pre-allocated once (`new Uint8Array(CHUNK_SIZE)`) and filled with `crypto.getRandomValues()` before the loop. The same buffer is reused for all writes — the content is incompressible regardless of whether it changes between writes.

---

## Client: stream pump and chunk logging

**File:** `assets/js/measurement/throughput/measureDownlink.js`

Token fetch:
```js
const res  = await fetch(TOKEN_ENDPOINT, { cache: "no-store" });
const body = await res.json();
// 429 → throws with server message
// missing token → throws
token = body.token;
```

8 stream pumps launched simultaneously:
```js
Promise.all(Array.from({ length: PARALLEL }, () => pump(streamUrl)))
```

Each `pump()`:
1. Opens `fetch(url, { cache: "no-store", signal: controller.signal })`
2. Gets a `ReadableStreamDefaultReader`
3. On each `reader.read()`:
   - Records `t = performance.now() - testStart`
   - Increments `totalBytesRef.value`
   - Pushes `{ t, bytes: value.byteLength }` to `chunkLog`
4. Exits cleanly on `AbortError`

`chunkLog` is a shared flat array written to by all 4 pumps concurrently. JavaScript's single-threaded event loop makes this safe — no chunk entry can be partially written.

---

## Live sample emission

A `setInterval` ticker fires every `BUCKET_MS` (750ms) while the test runs:

```js
tickerHandle = setInterval(() => {
  const now = performance.now() - testStart;
  const completedIdx = Math.floor(now / BUCKET_MS) - 1;
  // emit all completed buckets not yet emitted
  for (let i = lastEmittedBucket + 1; i <= completedIdx; i++) {
    // sum bytes in chunkLog where t falls in [i*BUCKET_MS, (i+1)*BUCKET_MS)
    // compute mbps, call onSample({ t, mbps, MBps })
  }
}, BUCKET_MS);
```

Only fully elapsed buckets are emitted. The current in-progress bucket is never emitted live — it would produce an artificially low rate because its window is not yet complete.

---

## Bucket computation: `bucketEvents`

Takes the full `chunkLog` and total `durationMs`. Groups bytes by 750ms bucket index:

```js
const idx = Math.floor(t / BUCKET_MS);
buckets.set(idx, (buckets.get(idx) ?? 0) + bytes);
```

Filters and converts:

- Skips bucket 0 if empty (stream not yet open at t=0)
- Skips any bucket with < 25% fill (`fill < 0.25`) — prevents the final partial bucket from producing an artificially low or high reading, but captures more data than the previous 50% threshold
- Computes effective window for the final bucket: `Math.max(fill * BUCKET_MS, 100)` — uses weighted calculation with 100ms minimum to avoid division artifacts
- Converts to Mbps: `(bytes * 8) / (effectiveMs * 1000)`

Returns array of `{ t, mbps, MBps }` where `t` is the bucket end time in seconds.

---

## Ramp detection: `isStillRamping`

```js
function isStillRamping(vals) {
  if (vals.length < 4) return true;
  const rises = vals.filter((v, i) => i > 0 && v > vals[i - 1]).length;
  return rises / (vals.length - 1) >= 0.75;
}
```

Returns true if ≥ 75% of consecutive bucket pairs are still increasing. Applied to post-ramp values after the main computation to determine if speed had plateaued by test end. The higher threshold (vs. previous 60%) reduces false positives from normal variance.

---

## Adaptive duration

After `BASE_DURATION` elapses:

1. Compute preliminary bucket samples from current `chunkLog`
2. Identify ramp threshold: median of second-half samples × 0.90
3. Find ramp index: first 3-bucket window averaging ≥ ramp threshold
4. Check `isStillRamping` on post-ramp values
5. Compute `rampRatio = ramp_ms / BASE_DURATION`

Extension logic:
- If still ramping and `rampRatio > 0.50` → extend to `MAX_DURATION` (full 6s extension)
- If `rampRatio > 0.40` → partial extension: `min(6000, round(((ramp_ms - 5600) * 1.5) / 1000) * 1000)` ms
- Otherwise → no extension

Remaining time after extension decision is awaited, then `controller.abort()` terminates all streams.

---

## Statistics: `computeStats`

Input: array of bucket samples `{ t, mbps }`.

**Ramp detection (final):**
```
roughSustained = median of second half of vals
rampThreshold  = roughSustained * 0.90
rampIdx        = first index where 3-bucket rolling average >= rampThreshold
postRampVals   = vals.slice(rampIdx) — or all vals if no ramp detected
```

**Computed metrics:**

| Metric | Formula |
|---|---|
| `sustained_mbps` | median (p50) of `postRampVals` (sorted) |
| `peak_mbps` | p95 of all vals (sorted) |
| `p99_mbps` | p99 of all vals (sorted) |
| `average_mbps` | arithmetic mean of all vals |
| `variance_mbps` | population stddev (standar deviation) of all vals |
| `variance_post_mbps` | population stddev of `postRampVals` (if ≥ 2 samples, else `variance_mbps`) |
| `ramp_ms` | `samples[rampIdx].t * 1000` |
| `still_ramping` | `isStillRamping(postRampVals)` |

All percentiles use: `sorted[max(0, ceil(p * n) - 1)]`

**Return value:**
```js
{
  sustained_mbps, sustained_MBps,
  peak_mbps,      peak_MBps,
  p99_mbps,       p99_MBps,
  average_mbps,   average_MBps,
  variance_mbps,  variance_MBps,
  variance_post_mbps, variance_post_MBps,
  ramp_ms,        // ms or null
  still_ramping,  // boolean
  duration_ms,    // total test wall time
  bytes_total,    // total bytes received across all streams
  streams,        // PARALLEL (8)
  samples,        // bucket sample array
}
```

`MBps` variants: `mbps / 8`, rounded to 3 decimal places.