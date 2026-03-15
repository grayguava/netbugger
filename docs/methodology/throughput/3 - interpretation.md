# Interpretation : Throughput test

## Overview

After `runThroughputTest()` completes, `interpretThroughput(result)` is called. It returns `{ verdict, findings }`.

**File:** `assets/js/measurement/shared/interpretThroughput.js`

```js
export function interpretThroughput(result) {
  const sustained          = result?.sustained_mbps      ?? 0;
  const peak               = result?.peak_mbps           ?? null;
  const variance_mbps      = result?.variance_mbps       ?? 0;
  const variance_post_mbps = result?.variance_post_mbps  ?? variance_mbps;
  const ramp_ms            = result?.ramp_ms             ?? null;
  const stillRamping       = result?.still_ramping       ?? false;

  const vr = sustained > 0 ? variance_post_mbps / sustained : 0;

  return {
    verdict:  { ...deriveVerdict(sustained, vr, stillRamping), usecases: scoreUsecases(sustained, vr) },
    findings: buildFindings({ sustained, peak, variance_mbps, variance_post_mbps, ramp_ms, stillRamping }),
  };
}
```

`vr` (variance ratio) is `variance_post_mbps / sustained` — post-ramp standard deviation as a fraction of sustained speed. This is the primary consistency signal used throughout interpretation.

---

## Thresholds

All thresholds defined in `T` at the top of `interpretThroughput.js`.

### Sustained speed tiers (`T.sustained`)

| Tier | Condition |
|---|---|
| `exceptional` | sustained ≥ 500 Mbps |
| `excellent` | sustained ≥ 200 Mbps |
| `fast` | sustained ≥ 100 Mbps |
| `adequate` | sustained ≥ 50 Mbps |
| `moderate` | sustained ≥ 25 Mbps |
| `slow` | sustained ≥ 10 Mbps |
| `poor` | sustained ≥ 3 Mbps |
| `unusable` | sustained < 3 Mbps |

### Variance ratio (`T.variance`)

| Level | Condition |
|---|---|
| `stable` | vr < 0.10 (< 10% of sustained) |
| `ok` | vr < 0.20 (< 20% of sustained) |
| `variable` | vr ≥ 0.35 (≥ 35% of sustained) |

### Peak gap (`T.peak_gap`)

Ratio: `(peak - sustained) / peak`

| Level | Condition |
|---|---|
| `notable` | gap ≥ 0.30 (peak ≥ 43% above sustained) |
| `severe` | gap ≥ 0.50 (peak ≥ 2× sustained) |

### Ramp time (`T.ramp`)

| Level | Condition |
|---|---|
| `fast` | ramp_ms ≤ 1500 ms |
| `normal` | ramp_ms ≤ 4000 ms |
| `slow` | ramp_ms ≤ 9000 ms |
| (very slow) | ramp_ms > 9000 ms |

---

## Verdict: `deriveVerdict`

Takes `sustained`, `vr` (variance ratio), and `stillRamping`. Returns `{ level, css, headline, consequence }`.

Tier is derived from `getTier(sustained)`. Verdict text branches on `vr` for `excellent`, `fast`, and `adequate` tiers — these three tiers have two distinct headline/consequence pairs depending on whether delivery is consistent.

### Tier → CSS class mapping

| Tier | CSS class |
|---|---|
| `exceptional`, `excellent`, `fast` | `great` |
| `adequate` | `ok` |
| `moderate` | `slow` |
| `slow`, `poor`, `unusable` | `bad` |

### Still-ramping note

If `stillRamping` is true, all verdict consequence strings append: `" Speed was still climbing at the end of the test — actual capacity may be higher."`

### Verdict headlines by tier and variance

| Tier | vr < 0.20 | vr ≥ 0.20 |
|---|---|---|
| `exceptional` | Near-gigabit throughput | Near-gigabit throughput |
| `excellent` | Excellent speed, rock-solid delivery | Excellent speed, minor variance |
| `fast` | Fast and consistent | Fast, but delivery is uneven |
| `adequate` | Adequate — covers the basics comfortably | Adequate speed, inconsistent delivery |
| `moderate` | Moderate — workable but limited | (same) |
| `slow` | Slow — below modern expectations | (same) |
| `poor` | Poor — significantly below average | (same) |
| `unusable` | Unusable for most modern tasks | (same) |

---

## Use-case scoring: `scoreUsecases`

Six use cases scored as `good`, `ok`, or `poor`. Evaluated against `sustained` (Mbps) and `vr` (variance ratio).

| Use case | `good` | `ok` | `poor` |
|---|---|---|---|
| Web Browsing | s ≥ 10 and vr < 0.35 | s ≥ 3 | otherwise |
| HD Streaming | s ≥ 15 and vr < 0.20 | s ≥ 8 and vr < 0.35 | otherwise |
| 4K Streaming | s ≥ 35 and vr < 0.20 | s ≥ 18 and vr < 0.35 | otherwise |
| Video Calls | s ≥ 10 and vr < 0.10 | s ≥ 5 and vr < 0.20 | otherwise |
| Large Downloads | s ≥ 100 | s ≥ 25 | otherwise |
| Cloud Gaming | s ≥ 35 and vr < 0.10 | s ≥ 15 and vr < 0.20 | otherwise |

Video Calls and Cloud Gaming have the strictest variance requirements (`stable`, vr < 0.10) because they are real-time and sensitive to delivery consistency. Large Downloads has no variance requirement — only throughput matters for sequential bulk transfer.

---

## Findings: `buildFindings`

Generates per-dimension finding cards sorted by severity (`err` → `warn` → `ok`).

Pre-computed before card generation:
```js
const vr_post    = sustained > 0 ? variance_post_mbps / sustained : 0;
const vr_overall = sustained > 0 ? variance_mbps      / sustained : 0;
const rampInflated = (vr_overall - vr_post) > 0.08;
```

`rampInflated` flags cases where overall variance is more than 8 percentage points higher than post-ramp variance — used to add a clarifying note to variance cards when ramp noise is inflating the overall figure.

### Still-ramping finding

Generated first if `stillRamping` is true. Severity `warn`. States the sustained figure is a floor estimate and explains causes.

### Variance findings

Based on `vr_post`:

| vr_post | Severity | Headline |
|---|---|---|
| ≥ 0.35 | `err` | Erratic throughput |
| ≥ 0.20 | `warn` | Noticeable throughput variance |
| ≥ 0.10 | `ok` | Mostly consistent throughput |
| < 0.10 | `ok` | Consistent throughput |

`warn` card includes a `rampInflated` note if the overall variance figure would otherwise be misleading.

### Peak gap findings

Only generated if: test is not still ramping, variance is not already `err`-flagged (`vr_post < 0.35`), and `peak` is non-null.

Gap ratio: `(peak - sustained) / peak`

| Gap | Severity | Headline |
|---|---|---|
| ≥ 0.50 | `warn` | Severe gap between peak and sustained speed |
| ≥ 0.30 | `warn` | Notable gap between peak and sustained speed |
| < 0.30 | no card | — |

### Ramp-time findings

Based on `ramp_ms`:

| ramp_ms | Severity | Headline |
|---|---|---|
| > 9000 ms | `warn` | Very slow ramp-up |
| > 4000 ms | `warn` | Slow ramp-up |
| ≤ 1500 ms | `ok` | Fast ramp-up |
| 1500–4000 ms | no card | — |

No finding is generated for the normal range (1.5–4s) — this is expected and unremarkable.

---

## DOM field mapping

| DOM id | Value |
|---|---|
| `val-sustained` | `sustained_mbps` + `sustained_MBps` |
| `val-peak` | `peak_mbps` + `peak_MBps` |
| `val-p99` | `p99_mbps` + `p99_MBps` |
| `val-average` | `average_mbps` + `average_MBps` |
| `val-variance` | `variance_mbps` ± with ratio |
| `val-variance-post` | `variance_post_mbps` ± with ratio |
| `val-ramp` | `ramp_ms` formatted as seconds |
| `val-still-ramping` | `still_ramping` boolean |
| `val-bytes` | `bytes_total` in MB |
| `val-duration` | `duration_ms` in seconds |
| `val-streams` | `streams` (always 8) |
| `val-samples` | `samples.length` |

Variance KV cells receive inline colour class: `err` if `variance_mbps / sustained > 0.35`, `warn` if > 0.15. Ramp KV cell receives `warn` if `ramp_ms > 5000`.

---

## Chart

ECharts line chart. X axis: elapsed time in seconds. Y axis: Mbps.

Updated live via `pushSample()` as `onSample` callbacks fire during the test. After completion, `annotateChart()` adds:
- Solid sustained reference line
- Dashed peak reference line
- Three background band areas (0–5 Mbps red tint, 5–25 Mbps amber tint, 25–100 Mbps green tint) — visual context for speed tier regions

---

## Caveats

- **Isolate token mismatch** — token issuance and stream serving may hit different Cloudflare Workers isolates. If they do, stream validation fails with 403 because `activeTokens` is not shared across isolates. At low traffic this is unlikely but possible.
- **Sustained vs. plan speed** — sustained speed reflects the path from the browser to the Cloudflare edge, not end-to-end ISP plan speed. Congestion between edge and origin, or between the user and the nearest PoP, will reduce measured throughput below the advertised plan rate.
- **Parallel stream overhead** — 8 streams compete for the same bottleneck link. On connections with strict per-flow rate limiting, 8 streams may saturate the link faster than a single stream would. On connections without per-flow limits, the streams combine to probe total capacity. The test is designed for the latter, which reflects the majority of residential connections.
- **100 MB cap per stream** — at very high speeds (≥ 570 Mbps sustained × 8 streams), all streams hit their 100 MB cap before the test duration ends. The test will not run out of data under typical broadband conditions but may on high-capacity enterprise links.
- **Browser scheduling** — `setInterval` live ticker and test duration timers are subject to browser timer throttling in background tabs. Running the test in a backgrounded or hidden tab may produce incorrect duration and live chart data. Results are still valid since `chunkLog` timestamps use `performance.now()`.