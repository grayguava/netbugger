# What and Why : Throughput test

## What it measures

The throughput test measures the sustained download capacity of the connection from the browser to the Cloudflare edge. It reports:

- **Sustained speed** — the throughput the connection can hold under continuous load, not the peak it briefly reaches
- **Peak speed** — the highest burst the connection achieved during the test
- **Variance** — how consistently that speed is delivered over time, both across the full test and specifically after the connection has stabilised (post-ramp)
- **Ramp time** — how long TCP slow-start takes to reach full speed
- **p99** — the near-maximum speed achieved, excluding the single top percentile as an outlier

## Why sustained and not peak

Most speed tests report peak or short-burst speed. This overstates practical performance because TCP connections start slowly (slow-start), ISPs apply burst buffering that delivers high speeds briefly before throttling, and a single large download rarely sustains the peak rate seen at the start.

Sustained speed (p75 of post-ramp samples) reflects what the connection actually delivers during extended transfers. This is the number that matters for 4K streaming, large file downloads, and cloud backup — the workloads where throughput is the bottleneck.

## Why parallel streams

A single TCP stream is throttled by the TCP congestion window, which grows incrementally. A single stream therefore never fully utilises a high-capacity connection during a short test window. 4 parallel streams (`PARALLEL = 4`) allow each to independently probe capacity, and their combined throughput gives a realistic picture of what the connection can deliver to a multi-resource workload (a web page loading dozens of assets, or a browser downloading in parallel).

`MAX_STREAMS_PER_TOKEN = 4` on the server matches this constant, enforced per token.

## Why chunk-event bucketing

The browser's `fetch` Streams API fires `reader.read()` events as data arrives. Each chunk arrival is timestamped and logged with its byte count. These events are then bucketed into 750ms windows (`BUCKET_MS = 750`) and converted to Mbps for that window.

This approach is more accurate than a single start/end elapsed time because it captures speed variation over time rather than averaging across the full transfer. It is also more accurate than per-chunk instantaneous speed, which would produce noisy per-chunk readings that reflect TCP burst behaviour rather than sustained throughput.

## Why 750ms buckets

750ms is long enough to smooth out TCP burst-drain cycles (which typically occur at tens to hundreds of milliseconds) while short enough to capture real changes in throughput across a 14–20 second test. A 1s bucket would miss meaningful variance; a 250ms bucket would be dominated by TCP-level noise.

## Why adaptive duration

The baseline test duration is 14 seconds (`BASE_DURATION = 14_000`). After the baseline, the test checks whether the connection has finished ramping. If it is still ramping — speed is still climbing and has not plateaued — the test extends to a maximum of 20 seconds (`MAX_DURATION = 20_000`). If ramp-up consumed more than 40% of the baseline, duration is extended proportionally.

This ensures that on fast connections where slow-start takes longer to complete, the test collects enough post-ramp samples for the sustained speed calculation to be meaningful. A fixed 10-second test on a gigabit connection might spend 8 seconds in ramp-up and only 2 seconds at full speed, producing a misleading sustained figure.

## Why a token system

Each test opens 4 parallel streams, each capable of transferring up to 100 MB (`TOTAL_BYTES = 100 * 1024 * 1024`). Without a gate, a single user could exhaust significant bandwidth. The token system enforces:

- **Global daily cap** — 100 tests per UTC day (`DAILY_TOKEN_LIMIT = 100`), enforced via Cloudflare KV shared across all edge isolates
- **Per-token stream limit** — a token authorises exactly 4 stream opens (`MAX_STREAMS_PER_TOKEN = 4`), matching the client's `PARALLEL` constant
- **Token TTL** — tokens expire after 30 seconds (`TOKEN_TTL_MS = 30_000`), preventing a token from being reused after a test completes

## Why random bytes for stream payload

The stream worker sends chunks of `crypto.getRandomValues()` data. Random bytes are incompressible — they prevent any intermediate proxy, CDN layer, or browser compression optimisation from reducing the actual bytes transferred and producing an inflated throughput reading.