# What and Why : Stability test

## What it measures

The stability test measures the quality of the connection between the browser and the Cloudflare edge server handling the current session. It produces three classes of output:

- **Round-trip time (RTT)** — how long a request takes to leave the browser, reach the edge, and return. Measured as TTFB (time to first byte) against `/api/ping`.
- **Jitter** — how much RTT varies between probes. Expressed as population standard deviation (σ) across all valid samples.
- **Handshake overhead** — the cost of establishing a new connection (cold RTT) versus reusing an existing one (warm RTT), and the delta between them.

## Why these metrics

**RTT** is the foundational metric for connection quality. It sets a floor on interactive response time — no application can respond faster than the round-trip to its server. Median RTT is used rather than mean because it is resistant to outliers; a single spike does not distort the central tendency.

**Jitter** matters because average latency alone is misleading. A connection with 40ms median RTT and 35ms σ will feel worse than one with 60ms median and 2ms σ. Real-time applications — voice, video, gaming — are sensitive to variance, not just level. Standard deviation captures the spread of the full distribution rather than just the worst case.

**p90** is reported alongside median to expose tail behaviour. p90/median ratio is used as a spike indicator — a high ratio means at least 1 in 10 requests experiences significantly worse latency than the median suggests. This is the primary signal for bufferbloat and intermittent congestion.

**Handshake delta** (cold − warm) isolates connection setup cost from steady-state RTT. A high delta on an otherwise low-latency connection points to DNS resolution or TLS negotiation overhead, not path distance. A low delta on a high-latency connection confirms the path itself is the bottleneck.

## Why 100 probes at 100ms

100 probes produces a statistically stable distribution for median and p90 computation at a reasonable time cost. p90 requires at least 10 samples to be meaningful; 100 means the p90 value represents the 10th-worst probe, not an edge case.

100ms interval is a deliberate balance:
- Short enough to detect bursty congestion events that resolve within seconds
- Long enough that consecutive probes do not queue behind each other on a high-latency connection
- Matches the typical codec frame interval for voice (10–20ms) and video (33–100ms) applications, making jitter readings directly comparable to what those applications experience

Total test duration is at minimum ~10 seconds. On connections where probe RTT exceeds 100ms, the sampler's drift correction fires the next probe immediately after the previous one completes, so duration scales with latency.

## Why TTFB and not total latency

`/api/ping` returns HTTP 204 with no body. TTFB and total latency are nearly identical in this case. TTFB is preferred because it is recorded the moment response headers arrive — it excludes any body transfer time and is a cleaner signal of round-trip network cost. Total latency is also recorded by `probeRTT` but is not used in statistics.

## Why `/api/ping` and not an existing endpoint

A dedicated no-body 204 endpoint eliminates response size as a variable. Using an endpoint that returns data (such as `/api/info`) would conflate network RTT with server processing time and response serialisation. The ping endpoint does nothing except return headers.