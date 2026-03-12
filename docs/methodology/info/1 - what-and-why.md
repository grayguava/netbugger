# What and Why : Connection info

## What it shows

The connection info pages (`/` and `/info/`) surface the metadata that the network infrastructure already knows about the request before any application logic runs. Specifically:

- **Client identity** — IP address, approximate geolocation (city, region, country, continent, timezone)
- **Network** — ASN and organisation name of the IP's autonomous system
- **Protocol** — TLS version and HTTP version negotiated for this connection
- **Edge** — the Cloudflare PoP handling the request (IATA code, city, country, coordinates), and the Ray ID uniquely identifying this request

## Why `request.cf` and not a lookup service

Every request that reaches a Cloudflare Worker arrives with a `cf` object already populated by Cloudflare's infrastructure. This object contains geolocation, ASN, TLS, and routing data derived from Cloudflare's own databases and the connection itself — not from a third-party API call.

Using `request.cf` means:
- Zero additional latency — the data is present on the request object, no outbound lookup needed
- No third-party dependency — no external IP geolocation API to go down, rate-limit, or change its schema
- Data is authoritative for the Cloudflare layer — TLS version and HTTP protocol reflect the actual negotiated connection, not an inference

## Why client-side enrichment for edge location

The Worker's `request.cf` object exposes `cf.colo` — the IATA code of the PoP handling the request (e.g. `WAW`, `AMS`, `LAX`). It does not expose the PoP's city name, country, or coordinates.

Rather than making a secondary Worker call or embedding a large dataset in the Worker bundle, edge location metadata is resolved client-side by looking up the IATA code in `/assets/data/cloudflare-edge-locations.json`. This keeps the Worker response minimal and moves the enrichment cost to the client, where it is free.

## Why parallel fetch for API and edge map

`getConnectionInfo.js` fires both fetches simultaneously via `Promise.all`:

```js
const [res, edgeMap] = await Promise.all([
  fetch(endpoint + "?t=" + crypto.randomUUID(), { cache: "no-store" }),
  loadEdgeMap()
]);
```

The API response and the edge map are independent — neither depends on the other until the merge step. Fetching in parallel eliminates the serial wait that would occur if the edge map were fetched only after the API response arrived.

## Why `force-cache` for the edge map and `no-store` for the API

The edge map (`cloudflare-edge-locations.json`) is a static asset. Its content does not change between page loads. `force-cache` instructs the browser to serve it from cache if available, skipping the network entirely on repeat visits. This makes the parallel fetch effectively free after the first load.

The API endpoint (`/api/info`) returns live request metadata — it is different on every request by definition. `no-store` prevents the browser from caching the response and returning stale data on refresh. A `crypto.randomUUID()` query param is also appended as a secondary cache-bust in case an intermediate proxy ignores `no-store`.

## Why the edge map is a singleton

`getConnectionInfo.js` stores the loaded edge map in a module-level variable:

```js
let CF_EDGE_MAP = null;
```

Once loaded, subsequent calls to `loadEdgeMap()` return the cached object immediately without any fetch. This means the edge map is fetched at most once per page session, regardless of how many times the user refreshes connection data.