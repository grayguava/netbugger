# Interpretation : Stability test

## Overview

After `runHealthTest()` completes, `interpret(result)` is called with the full result object. It returns `{ verdict, findings }`.

**File:** `assets/js/measurement/shared/interpret.js`

```js
export function interpret(result) {
  const lat = result?.latency   ?? {};
  const hs  = result?.handshake ?? {};

  const median = lat.median     ?? null;
  const jitter = lat.jitter_std ?? null;
  const p90    = lat.p90        ?? null;
  const cold   = hs.cold        ?? null;
  const warm   = hs.warm        ?? null;

  const verdictBase = deriveVerdict(median ?? 0, jitter ?? 0, p90 ?? median ?? 0, warm,
    cold != null && warm != null ? cold - warm : null);

  const usecases = scoreUsecases(median ?? 0, jitter ?? 0, p90 ?? median ?? 0);

  const findings = buildFindings(median, jitter, p90, cold, warm, hs.coldSuccess, hs.warmSuccess);

  return { verdict: { ...verdictBase, usecases }, findings };
}
```

---

## Thresholds

All thresholds are defined in the `T` constant at the top of `interpret.js`.

### RTT (`T.rtt`)

| Level | Condition |
|---|---|
| `excellent` | median ≤ 30 ms |
| `great` | median ≤ 60 ms |
| `good` | median ≤ 100 ms |
| `acceptable` | median ≤ 150 ms |
| `high` | median ≤ 250 ms |
| `severe` | median > 250 ms |

### Jitter (`T.jitter`)

Jitter is evaluated against both an absolute value and a ratio relative to median. This prevents a high-latency connection from being flagged for large absolute jitter that is proportionally normal.

| Level | Condition |
|---|---|
| `stable` | σ < 8 ms **and** ratio < 8% |
| `ok` | σ < 20 ms **and** ratio < 15% |
| `noticeable` | σ ≥ 20 ms **or** ratio ≥ 15% |
| `bad` | σ ≥ 60 ms **and** ratio ≥ 30% |

`bad` requires both conditions — absolute and ratio — to prevent misclassifying a 200ms connection with 65ms σ (33% ratio, which is noticeable but not catastrophic for that latency level).

### Spike (`T.spike`)

Spike level is derived from the ratio `p90 / median`.

| Level | Condition |
|---|---|
| `clean` | ratio < 1.30 |
| `ok` | ratio < 1.60 |
| `notable` | ratio < 2.00 |
| `severe` | ratio ≥ 2.00 |

### Warm RTT (`T.warm`)

| Level | Condition |
|---|---|
| `fast` | warm < 80 ms |
| `ok` | warm < 150 ms |
| `slow` | warm ≥ 250 ms |

### Delta (`T.delta`)

| Level | Condition |
|---|---|
| `normal` | delta < 80 ms |
| `elevated` | delta ≥ 150 ms |

---

## Server bottleneck detection: `isServerBottleneck`

Returns `true` when all three conditions hold:

1. `warm >= 250 ms` — server is responding slowly even on an established connection
2. `median < 120 ms` — the network path itself is not the issue
3. Jitter level is `stable` or `ok` **and** spike level is `clean` or `ok` — delivery is consistent

When true, the verdict attributes the high RTT to server-side processing rather than the network path. The consequence text is adjusted accordingly and a distinct finding card is generated.

---

## Verdict: `deriveVerdict`

Evaluates inputs in priority order. First matching condition wins.

| Condition | Level | Headline |
|---|---|---|
| jitter `bad` **and** spike `severe` | `bad` | Severely unstable connection |
| jitter `bad` | `bad` | Highly unstable — excessive jitter |
| spike `severe` | `bad` | Frequent severe latency spikes |
| server bottleneck detected | `ok` | Network path is fine — server responding slowly |
| RTT `severe` + (jitter noisy or spike warning) | `bad` | Very high latency with instability |
| RTT `severe` | `slow` | Very high latency — stable signal |
| RTT `high` + (jitter noisy or spike warning) | `unstable` | High latency and inconsistent delivery |
| RTT `high` | `slow` | High latency — stable delivery |
| jitter noisy or spike warning | `unstable` | Unstable delivery |
| RTT `acceptable` | `ok` | Acceptable latency |
| RTT `good` or better | `great` | Low latency and stable |

Verdict levels displayed in UI:

| Level | UI label |
|---|---|
| `great` | All good |
| `ok` | Looks good |
| `slow` | High latency |
| `unstable` | Unstable |
| `bad` | Problems found |

---

## Use-case scoring: `scoreUsecases`

Five use cases are scored independently as `good`, `ok`, or `poor` based on combinations of RTT level, jitter level, and spike level.

| Use case | `poor` | `ok` | `good` |
|---|---|---|---|
| Web Browsing | RTT `severe` or jitter `bad` | RTT `high` | otherwise |
| Video Streaming | RTT `severe` or spike `severe` | RTT `high` or spike `notable` | otherwise |
| Video Calls | jitter `bad` or jitter > 50ms or RTT `severe` | jitter noticeable or jitter > 25ms or RTT `high` | otherwise |
| Online Gaming | RTT `severe`/`high`/`acceptable` or jitter `bad` | jitter noticeable or spike notable | otherwise |
| Remote Desktop | RTT `severe`/`high` or jitter `bad` or spike `severe` | RTT `acceptable` or jitter not stable/ok or spike notable/worse | otherwise |

Online Gaming has the strictest RTT requirement — anything above `good` (> 100ms) results in `poor`. Remote Desktop is strict on both jitter and spikes due to sensitivity to delivery consistency.

---

## Findings: `buildFindings`

Generates per-dimension finding cards. Each card:

```js
{
  severity: "ok" | "warn" | "err",
  headline: string,
  detail:   string,   // includes exact measured values
  tip:      string | null
}
```

Findings are generated for each dimension independently, then sorted by severity (`err` → `warn` → `ok`) before being returned.

### RTT findings

| RTT level | Severity | Note |
|---|---|---|
| `excellent` | `ok` | ≤ 30ms — ideal for all use cases |
| `great` | `ok` | ≤ 60ms — ideal for competitive gaming and real-time communication |
| `good` | `ok` | ≤ 100ms — comfortable, competitive gaming starts to feel sluggish |
| `acceptable` | `warn` | ≤ 150ms — tip: check Wi-Fi, check VPN |
| `high` (no server fault) | `warn` | ≤ 250ms — tip: run traceroute, check ISP routing |
| `severe` (no server fault) | `err` | > 250ms — tip: check VPN routing through distant country |

### Jitter findings

| Jitter level | Severity | Note |
|---|---|---|
| `bad` | `err` | Includes σ value and ratio — tip: wired connection, check uplink saturation |
| `noticeable` | `warn` | Includes σ value and ratio — tip: close background apps, check Wi-Fi band |
| `ok` | `ok` | Minor variance, unlikely to be user-visible |
| `stable` | `ok` | Round-trips are highly consistent |

### Spike findings

| Spike level | Severity | Note |
|---|---|---|
| `severe` | `err` | p90 ≥ 2× median — tip: bufferbloat, enable SQM/fq_codel |
| `notable` | `warn` | p90 60–100% above median — tip: queue management under load |
| `ok` | `ok` | Slight tail elevation, not user-visible |
| `clean` | no card | No finding generated |

### Handshake findings

Generated only when both cold and warm probes were attempted.

| Condition | Severity | Note |
|---|---|---|
| Probe failed (cold or warm) | `err` | Results should be disregarded |
| Server bottleneck detected | `err` | Attributes slow warm RTT to server processing, not network |
| `warm >= 250ms` (no server fault) | `warn` | High floor on interactive response times |
| `warm >= 150ms` (no server fault) | `warn` | Above comfortable threshold for real-time use |
| `delta >= 150ms` | `warn` | High DNS + TCP + TLS overhead — tip: verify HTTP/2, TLS session resumption |
| `delta >= 80ms` | `ok` | Moderate overhead — first-connection latency meaningfully higher than ongoing RTT |
| `delta < 80ms` | `ok` | Fast setup — cold connections nearly as fast as warm |

---

## Charts

### Live RTT chart

ECharts line chart. X axis: elapsed time in seconds. Y axis: TTFB in ms.

Updated live via `pushLiveSample()` as each `onSample` callback fires during the test. After completion, `annotateLiveChart()` adds:
- Solid median reference line
- Dashed p90 reference line
- Point marker on the minimum sample
- Point marker on the maximum sample

### Jitter chart

ECharts bar chart. Rendered after the run completes. X axis: elapsed time in seconds. Y axis: inter-sample RTT delta in ms.

Computed as:
```js
delta[i] = Math.abs(sample[i].ttfb - sample[i-1].ttfb)
```

This is **inter-sample delta jitter** — how much RTT changes between consecutive probes. Distinct from `jitter_std`:

- `jitter_std` — population standard deviation of all RTT values. Captures overall spread of the distribution.
- Inter-sample delta — captures how erratic the sequence is. A connection that alternates between 20ms and 80ms has high delta jitter but moderate `jitter_std`.

Bars exceeding `3 × mean delta jitter` are highlighted in the warning colour. A mean delta reference line is drawn.

---

## Caveats

- **Browser timer precision** — `performance.now()` resolution is typically 1ms with `crossOriginIsolated`, and coarsened to 5ms without it due to Spectre mitigations. Individual probe timings carry ±1–5ms inherent uncertainty. At 100ms intervals this is low relative noise, but handshake cold/warm deltas below ~10ms should not be treated as precise.
- **Cold probe reliability** — `keepalive: false` discourages connection reuse, but browser connection pool behaviour is not fully controllable from JS. If the browser has a recent cached connection to the same origin, cold TTFB may understate true cold-start cost including DNS resolution.
- **Single-path measurement** — all probes target the Cloudflare PoP currently serving the session. Results reflect that specific path. Routing anomalies on other paths, or congestion at a different peering point, will not appear.
- **Probe interference** — concurrent network activity inflates latency and jitter. The test cannot distinguish probe RTT from queueing delay caused by background transfers.
- **Duration on high-latency connections** — when probe RTT exceeds 100ms, the sampler's drift correction clamps delay to 0 and fires the next probe immediately. On a 200ms RTT connection, 100 probes take ~20 seconds minimum.