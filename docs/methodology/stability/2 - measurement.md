# Measurement : Stability test

## Pipeline overview

Three phases run sequentially on test start:

```
getConnectionInfo()      → result.info
measureHandshake()       → result.handshake
measureRTT({ onSample }) → result.latency
```

Orchestrated by `runHealthTest()` in `assets/js/apps/getStability.js`.

`getConnectionInfo()` runs first to populate edge server identity. `measureHandshake()` runs before the main RTT loop — the warm-up probes it fires establish a connection that `measureRTT` then inherits, so the 100-probe run starts with an already-warm connection.

---

## Worker: `/api/ping`

**File:** `functions/api/ping/index.js`

```js
export async function onRequestGet() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" }
  });
}
```

Returns HTTP 204 with no body. `Cache-Control: no-store` prevents any intermediate cache from serving a stored response. Each probe appends a `crypto.randomUUID()` query param as an additional cache-bust.

---

## Atomic probe: `probeRTT`

**File:** `assets/js/measurement/rtt/probe.js`

Called by both `measureHandshake` and `measureRTT`. Each invocation:

1. Constructs URL: `endpoint + "?t=" + crypto.randomUUID()`
2. Records `t0 = performance.now()`
3. Calls `fetch(url, { cache: "no-store", keepalive: false })`
4. Records `ttfb = performance.now() - t0` immediately after the response object resolves (headers received)
5. Calls `response.text()` to drain the body (empty for 204)
6. Records `totalLatency = performance.now() - t0` after body drain

`keepalive: false` prevents the browser from flagging the connection for reuse in a way that could suppress connection setup on subsequent probes — relevant specifically for the cold handshake probe.

**Return value:**
```js
{
  ttfb,          // ms from request start to first byte — primary RTT signal
  latency,       // ms from request start to body complete
  status,        // HTTP status code
  success,       // response.ok
  timestamp      // performance.now() at completion
}
```

On failure:
```js
{ ttfb: null, latency: null, status: null, success: false, timestamp, error: true }
```

---

## Handshake measurement: `measureHandshake`

**File:** `assets/js/measurement/rtt/handshake.js`

Constants:
```js
const WARMUP_PROBES       = 6;
const WARMUP_INTERVAL_MS  = 50;
```

Sequence:
1. `cold = probeRTT(endpoint)` — first ever probe to this endpoint in this session. Captures DNS + TCP + TLS + server processing.
2. Loop: 6 × `probeRTT()` with 50ms sleep between each. Establishes and exercises the connection.
3. `warm = probeRTT(endpoint)` — probe on an established, recently-used connection. Captures network RTT without setup overhead.

**Return value:**
```js
{
  cold,         // ttfb ?? latency from cold probe (ms)
  warm,         // ttfb ?? latency from warm probe (ms)
  coldSuccess,  // boolean
  warmSuccess,  // boolean
  coldStatus,   // HTTP status
  warmStatus    // HTTP status
}
```

`ttfb ?? latency` fallback: if TTFB is null but the request succeeded, total latency is used. In practice this should not occur since 204 has no body, but the fallback is defensive.

**Delta** is computed in the UI as `cold − warm`. Represents the overhead attributable to connection setup. Not returned by `measureHandshake` — derived at the call site.

---

## RTT measurement loop: `measureRTT`

**File:** `assets/js/measurement/rtt/stability.js`

```js
const FIXED_SAMPLES = 100;
```

Delegates iteration to `Sampler`. For each probe:
- Calls `probeRTT(endpoint)`
- If successful and TTFB is non-null, calls `onSample({ ttfb, latency })` for live chart updates
- Returns TTFB value or `null` to the sampler

---

## Sampler

**File:** `assets/js/measurement/shared/sampler.js`

Runs a fixed number of async callbacks at a target interval with drift correction.

```js
let expected = start;

for (let i = 0; i < count; i++) {
  const value = await fn();
  samples.push({ t: performance.now() - start, v: value });

  expected += intervalMs;
  const delay = Math.max(0, expected - performance.now());
  if (i < count - 1) await sleep(delay);
}
```

`expected` advances by `intervalMs` on every iteration unconditionally. After each probe, actual elapsed time is subtracted from `expected` to compute the delay before the next probe. If a probe takes longer than `intervalMs`, delay is clamped to 0 — the next probe fires immediately without adding a full interval on top of the overrun.

This prevents accumulated drift. Without correction, a series of 110ms probes at a 100ms target interval would produce a 110-second test instead of ~100 seconds.

Each sample: `{ t: elapsed_ms_from_start, v: ttfb_ms_or_null }`.

---

## Statistics: `computeStats`

**File:** `assets/js/measurement/rtt/stability.js`

Input: raw array of TTFB values (nulls included, representing failed probes).

```js
const valid  = allValues.filter(v => v !== null);
const sorted = [...valid].sort((a, b) => a - b);
const n      = sorted.length;
```

| Metric | Formula |
|---|---|
| `median` | `n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[floor(n/2)]` |
| `p90` | `sorted[ceil(0.9 * n) - 1]` |
| `min` | `sorted[0]` |
| `max` | `sorted[n - 1]` |
| `jitter_std` | `sqrt( sum((v - avg)²) / n )` — population standard deviation |
| `loss` | `(total - n) / total` |

Population standard deviation (÷ n) is used rather than sample standard deviation (÷ n−1) because the 100 probes are the complete population being described, not a sample drawn from a larger theoretical population.

**Return value:**
```js
{
  samples,     // valid probe count
  attempts,    // total probe count (including failures)
  median,      // ms
  p90,         // ms
  min,         // ms
  max,         // ms
  jitter_std,  // ms — population σ
  loss         // 0.0–1.0 packet loss ratio
}
```

Full return from `measureRTT` also includes:
```js
{
  intervalMs,   // 100
  durationMs,   // elapsed ms from first to last sample timestamp
  raw           // array of raw TTFB values including nulls
}
```