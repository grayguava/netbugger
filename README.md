# Libreprobe

**See your connection. Understand your connection.**

Libreprobe is a network visibility and performance testing tool that shows not just how fast your connection is — but how reliably it actually works in real life.

Most speed tests focus on peak numbers. Libreprobe focuses on behavior: stability, consistency, and real-world usability.

![Homepage](./screenshots/homepage.png)

Live at https://libreprobe.qzz.io

---
## When should you use Libreprobe?

Use it when:

- Calls lag even though your speed looks fine  
- Gaming feels inconsistent or spiky  
- Streaming buffers randomly  
- Downloads stall or fluctuate  
- You suspect routing or ISP issues  
- You're debugging network or application performance  

Libreprobe helps answer a simple question:

**Is your connection actually working well — or just looking fast?**

---

## What makes it different

Most speed tests measure burst throughput.

Libreprobe measures sustained delivery quality.

Most tools show averages.

Libreprobe shows variance, jitter, and consistency.

Most tools give numbers.

Libreprobe explains what they mean in real-world terms — calls, streaming, gaming, and browsing.

---
## Example

Your ISP says: **200 Mbps**

But:

- Calls stutter  
- Games lag  
- Streams buffer  

Libreprobe might show:

- Good speed  
- High jitter  

Meaning:

The problem isn’t bandwidth — it’s delivery stability.

This is exactly the kind of issue Libreprobe is designed to reveal.

---
## How Libreprobe works

Libreprobe combines connection visibility with performance measurement and behavioral interpretation.

---
## What it does

### Visibility  
On page load, a Cloudflare Worker reads the headers attached to your request and returns them to your browser: IP, geolocation, ISP, ASN, TLS/HTTP versions, and the edge PoP handling your traffic.

No lookup services. No third-party APIs. The data comes directly from the infrastructure serving you.

---
### Throughput test  
Measures sustained download capacity using parallel streams and chunk-event bucketing.

Reports:

- Sustained speed (p75 post-ramp)  
- Peak speed (p95)  
- Variance and consistency  
- Ramp time  
- Transfer stats  

Designed to reflect real-world capacity — not juts short-lived burst speed.

---
### Stability test  
Sends 100 probes at 100 ms intervals and measures:

- Median RTT  
- Jitter  
- p90 latency  
- Cold vs. warm handshake overhead  

Results are visualised as live RTT and jitter charts with real-world interpretation.

---
## Who it’s for

Libreprobe is useful for:

**Everyday users**  
Trying to understand why their connection feels slow or unreliable.

**Gamers and streamers**  
Who care about stability, not just speed.

**Developers and IT professionals**  
Debugging performance, routing, or infrastructure issues.

**Students and learners**  
Trying to understand how real-world networks behave.

---
## Pages

| Route | Description |
|---|---|
| `/` | Your IP, location, ASN, TLS/HTTP version, client↔edge map |
| `/info/` | Full connection breakdown — device, network, and edge |
| `/throughput/` | Sustained download test with live chart and advanced metrics |
| `/stability/` | Latency and jitter test with live RTT and jitter charts |

![Info page](./screenshots/infopage.png)

![Throughput](./screenshots/throughput.png)

![Stability](./screenshots/stability.png)

---

## Methodology (short)

Libreprobe prioritises realistic measurement over synthetic benchmarks.

- Multi-stream sustained throughput testing  
- Post-ramp variance modelling  
- Percentile-based latency analysis  
- Fixed-interval RTT probing  
- Behaviour-focused interpretation layer  

For full details, metric definitions, and caveats see:

[`docs/methodology/`](./docs/methodology/)

---
## Stack

- Runtime — Cloudflare Workers (V8 isolates)  
- Hosting — Cloudflare Pages  
- Connection data — Cloudflare request headers (`CF-Ray`, `CF-IPCountry`, etc.)  
- Map — OpenStreetMap via CARTO, rendered with Leaflet  
- Charts — Apache ECharts  
- Frontend — Vanilla JS (ES modules), no framework, no build step  

---
## Project structure

High-level layout:

```
libreprobe/
├── index.html                             # Home — visibility overview + map
├── info.html                              # Full connection info
├── throughput.html                        # Throughput test
├── stability.html                         # Stability test
├── screenshots/                           # README screenshots
│
├── assets/
│   ├── data/
│   │   └── cloudflare-edge-locations.json # IATA PoP → city + coordinates
│   │
│   ├── graphics/
│   │   ├── icon.svg
│   │   └── Logo.png
│   │
│   ├── js/
│   │   ├── apps/
│   │   │   ├── connectionInfoRenderer.js  # Renders connection data + Leaflet map
│   │   │   ├── getThroughput.js           # Throughput test UI and orchestration
│   │   │   └── getStability.js            # Stability test UI and orchestration
│   │   │
│   │   └── measurement/
│   │       ├── environment/
│   │       │   └── getConnectionInfo.js   # Fetches and parses edge headers
│   │       ├── rtt/
│   │       │   ├── handshake.js           # Cold and warm handshake measurement
│   │       │   ├── probe.js               # Single RTT probe
│   │       │   └── stability.js           # 100-probe RTT measurement loop
│   │       ├── shared/
│   │       │   ├── interpret.js           # Stability result interpretation
│   │       │   ├── interpretThroughput.js # Throughput result interpretation
│   │       │   └── sampler.js             # Shared sampling utilities
│   │       └── throughput/
│   │           └── measureDownlink.js     # Parallel stream download measurement
│   │
│   └── vendor/
│       ├── leaflet/                       # Leaflet.js + CSS
│       └── echarts/                       # ECharts (minified)
│
└── functions/
    └── api/
        ├── info/index.js                  # Connection info endpoint
        ├── ping/index.js                  # Latency probe endpoint
        └── stream/                        # Throughput stream endpoint
            ├── index.js
            ├── globals.js
            ├── shared.js
            └── [token].js
```

---

## Deployment

Libreprobe is a fully static site with Cloudflare Workers functions.  
No frontend build step required.

The `functions/api/` directory is deployed automatically by Cloudflare Pages as Workers.

For full deployment instructions and self-hosting notes see:

[`docs/deployment/`](./docs/deployment/)

---
## Privacy

Libreprobe is stateless.

- No accounts  
- No analytics  
- No tracking  
- No stored results  

Connection metadata is processed in memory to generate responses and discarded immediately.

Full policy: https://libreprobe.qzz.io/privacy/

---
## License

MIT — see LICENSE