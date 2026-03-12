# Interpretation : Connection info

## Overview

Unlike the stability and throughput tests, connection info has no scoring or verdict logic. Interpretation here means: rendering the merged data object to the DOM, detecting special network conditions (Tor), and visualising the client↔edge path on the map.

**File:** `assets/js/apps/connectionInfoRenderer.js`

---

## Renderer

`load()` calls `getConnectionInfo()` and writes each field to the DOM by ID using `safe()`:

```js
function safe(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton');
  el.textContent = value ?? '—';
}
```

The null-guard (`if (!el) return`) means the renderer handles both the home page and the info page with the same call — fields that don't exist on a given page are silently skipped. On error, `banner.style.display = 'flex'` and all skeleton states remain.

### DOM field mapping

| DOM id | Source | Page |
|---|---|---|
| `hero-ip` | `client.ip` | home, info |
| `hero-location` | `client.region` + `client.country` | home, info |
| `hf-originASOrg` | `network.originAsOrg` | home |
| `hf-asn` | `network.asn` | home |
| `hf-tls` | `protocol.tlsVersion` | home |
| `hf-http` | `protocol.httpVersion` | home |
| `kv-colo` | `edge.colo` | home |
| `kv-edge-city` | `edge.city` | home |
| `kv-edge-country` | `edge.country` | home |
| `kv-ray` | `edge.rayId` | home |
| `cl-ip` | `client.ip` | info |
| `cl-city` | `client.city` | info |
| `cl-region` | `client.region` | info |
| `cl-country` | `client.country` | info |
| `cl-continent` | `client.continent` | info |
| `cl-timezone` | `client.timezone` | info |
| `net-originASOrg` | `network.originAsOrg` | info |
| `net-asn` | `network.asn` | info |
| `proto-tls-badge` | `protocol.tlsVersion` | info |
| `proto-http-badge` | `protocol.httpVersion` | info |
| `edge-colo` | `edge.colo` | info |
| `edge-city` | `edge.city` | info |
| `edge-country` | `edge.country` | info |
| `edge-country-code` | `edge.countryCode` | info |
| `edge-ray` | `edge.rayId` | info |

`net-asn` receives special handling — after `safe()` sets the text content, the element's `href` is set to `https://bgp.tools/as/<asn>` and the arrow SVG is re-injected into `innerHTML` (since `safe()` clears it via `textContent`).

### Status pill

```js
function updateStatus(success, colo) {
  const msg = success ? `Connected · ${colo ?? '—'}` : 'Connection failed';
  // sets .ok or .err class on status dot elements
  // sets text on status text elements
}
```

Applied to both `#hero-status-dot` / `#hero-status-text` (present on both pages).

---

## Tor detection

```js
if (torBanner) torBanner.classList.toggle('visible', c.country === 'T1');
```

`T1` is Cloudflare's sentinel value for Tor exit nodes in `cf.country`. When detected, `#tor-banner` is made visible. The country display value is remapped via:

```js
const fmtCountry = c => c === 'T1' ? 'Tor Network' : c;
```

Applied to `hero-location`, `cl-country`.

The info page tor banner includes an additional note that location and device details reflect the exit node, not the actual origin. The home page banner is shorter.

---

## Map

Rendered with Leaflet using CARTO Voyager raster tiles. Initialised once per map element and cached on `mapEl._mapInstance` to avoid re-initialisation on refresh. Dynamic layers (markers, polyline) are stored in `mapEl._dynamicLayers`, cleared, and redrawn on each `load()` call.

### Marker icons

Two custom `L.divIcon` markers are created via `makeIcon()`:

- **Client marker** — label `▸ You`, subtitle shows `city, region` or IP fallback, green colour (`#3a8a3a`)
- **Edge marker** — label `⬡ Cloudflare — <colo>`, subtitle shows edge city, orange colour (`#e8821a`)

### Polyline

A dashed green polyline (`#00ff88`, `dashArray: '6, 6'`) is drawn between client and edge coordinates when both are present.

### Zoom

Zoom level after `fitBounds` is capped based on Euclidean distance between client and edge coordinates:

| Distance (degrees) | maxZoom |
|---|---|
| < 1 | 10 |
| < 5 | 8 |
| < 15 | 7 |
| < 40 | 6 |
| ≥ 40 | 5 |

This is a rough approximation — Euclidean distance in lat/lon degrees does not account for projection distortion, particularly at high latitudes. At zoom levels 5–10 the error is not user-visible.

If only one coordinate set is present, `map.setView()` is called directly: zoom 6 for client-only, zoom 5 for edge-only.

---

## Caveats

- **Geolocation accuracy** — `client.city`, `client.region`, `client.country` come from Cloudflare's GeoIP database. VPN and proxy users see the exit node location. Tor users see the exit node with a `T1` country code and a banner.
- **Client coordinates are city-level** — `client.latitude` and `client.longitude` represent the approximate centre of the resolved city, not the user's device location.
- **Edge location accuracy** — `edge.city` and coordinates come from the static `cloudflare-edge-locations.json`. If Cloudflare adds or relocates a PoP and the dataset is not updated, the displayed location will be stale or null.
- **ASN reflects the requesting IP** — for corporate, university, or mobile carrier networks, `network.asn` is the institution's or carrier's ASN, not the upstream ISP.
- **TLS and HTTP version are edge-only** — they reflect the connection between the client and the Cloudflare edge, not any upstream hop between Cloudflare and an origin server.
- **Ray ID changes on every request** — it is unique per request and has no persistent meaning. It is useful for correlating with Cloudflare support logs but is not a stable identifier.