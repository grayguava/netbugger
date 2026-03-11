# Libreprobe

**See your connection. Test your connection.**

A network visibility and performance testing tool. Libreprobe shows you what your ISP, device, and Cloudflare's network know about your connection — and lets you measure how well it actually performs.

Live at [libreprobe.qzz.io](https://libreprobe.qzz.io)

![Homepage](./screenshots/homepage.png)

---

## What it does

**Visibility** — On page load, a Cloudflare Worker reads the headers attached to your request and returns them to your browser: your IP, geolocation, ISP, ASN, TLS and HTTP versions, and the edge PoP handling your traffic. No lookup services, no third-party APIs — the data comes directly from the infrastructure serving you.

**Throughput test** — Measures sustained download capacity using parallel streams and chunk-event bucketing. Reports sustained speed (p75 post-ramp), peak (p95), variance, ramp time, and transfer stats. Designed to reflect real-world capacity rather than burst speed.

**Stability test** — Sends 100 probes at 100ms intervals and measures round-trip time, jitter, p90 latency, and cold vs. warm handshake overhead. Results are visualised as a live RTT chart and a per-interval jitter chart.

For measurement methodology, metric definitions, and known caveats see [`docs/methodology/index.md`](./docs/methodology/index.md).

---

## Pages

| Route | Description |
|---|---|
| `/` | Your IP, location, ASN, TLS/HTTP version, client↔edge map |
| `/info/` | Full connection breakdown — device, network, and edge columns |
| `/throughput/` | Download speed test with live chart and advanced metrics |
| `/stability/` | Latency and jitter test with live RTT and jitter charts |

![Info page](./screenshots/infopage.png)

![Throughput](./screenshots/throughput.png)

![Stability](./screenshots/stability.png)

---

## Stack

- **Runtime** — Cloudflare Workers (V8 isolates)
- **Hosting** — Cloudflare Pages
- **Connection data** — Cloudflare request headers (`CF-Ray`, `CF-IPCountry`, `CF-Connecting-IP`, etc.)
- **Edge location map** — Static JSON mapping IATA PoP codes to city and coordinates
- **Map** — OpenStreetMap via CARTO, rendered with [Leaflet](https://leafletjs.com)
- **Charts** — [Apache ECharts](https://echarts.apache.org)
- **Frontend** — Vanilla JS, ES modules, no framework, no build step

---

## Project structure

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

Libreprobe is a fully static site with Cloudflare Workers functions — no build step required for the frontend. The `functions/api/` directory is deployed automatically by Cloudflare Pages as Workers.

For full deployment instructions, environment requirements, and self-hosting notes see [`docs/deployment/index.md`](./docs/deployment/index.md).

---

## Privacy

Libreprobe is stateless. No data is stored, no accounts exist, no analytics run. Connection metadata is processed in memory to generate the API response and discarded when the response is sent.

See [libreprobe.qzz.io/privacy/](https://libreprobe.qzz.io/privacy/) for the full policy.

---

## License

MIT — see [LICENSE](./LICENSE)