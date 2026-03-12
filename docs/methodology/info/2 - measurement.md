# Measurement : Connection info

## Pipeline overview

```
GET /api/info                        → worker reads request.cf + headers
loadEdgeMap()                        → fetch cloudflare-edge-locations.json (force-cache)
Promise.all([api, edgeMap])          → both resolve
raw.edge.colo lookup in edgeMap      → city, country, countryCode, lat, lon enriched
merged object returned               → { client, network, protocol, edge }
```

Implemented across `functions/api/info/index.js` and `assets/js/measurement/environment/getConnectionInfo.js`.

---

## Worker: `GET /api/info`

**File:** `functions/api/info/index.js`

Reads from two sources on the incoming request:

- `request.cf` — Cloudflare's request context object, populated automatically for every Worker invocation
- Request headers — `CF-Connecting-IP` and `CF-Ray`

Returns a single JSON object with `Cache-Control: no-store`.

### Response shape

```js
{
  client: {
    ip:        string | null,  // CF-Connecting-IP header
    city:      string | null,  // cf.city
    region:    string | null,  // cf.region
    country:   string | null,  // cf.country — ISO 3166-1 alpha-2, or "T1" for Tor exit nodes
    continent: string | null,  // cf.continent
    timezone:  string | null,  // cf.timezone — IANA tz string e.g. "Europe/Warsaw"
    latitude:  string | null,  // cf.latitude — city-level, not device-level
    longitude: string | null   // cf.longitude — city-level, not device-level
  },
  network: {
    asn:         number | null, // cf.asn
    originAsOrg: string | null  // cf.asOrganization
  },
  protocol: {
    tlsVersion:  string | null, // cf.tlsVersion e.g. "TLSv1.3"
    httpVersion: string | null  // cf.httpProtocol e.g. "HTTP/2"
  },
  edge: {
    colo:  string | null,       // cf.colo — IATA PoP code e.g. "WAW"
    rayId: string | null        // CF-Ray header
  }
}
```

The Worker exposes only `colo` and `rayId` for the edge. City, country, and coordinates are not available from `request.cf` and are resolved client-side via the edge map.

All fields use `?? null` — if Cloudflare does not populate a field for a given request, the field is explicitly null rather than undefined or absent.

---

## Edge map: `cloudflare-edge-locations.json`

**File:** `assets/data/cloudflare-edge-locations.json`

Static JSON object keyed by IATA PoP code. Each entry:

```js
{
  "WAW": {
    "city":        string,  // human-readable city name
    "country":     string,  // full country name
    "countryCode": string,  // ISO 3166-1 alpha-2
    "latitude":    number,  // PoP approximate coordinates
    "longitude":   number
  },
  ...
}
```

Loaded once per session via `loadEdgeMap()` with `cache: "force-cache"`. If the fetch fails or returns a non-ok status, `CF_EDGE_MAP` is set to `{}` and all edge enrichment fields resolve to null — the rest of the data is unaffected.

---

## Client-side merge: `getConnectionInfo`

**File:** `assets/js/measurement/environment/getConnectionInfo.js`

```js
export async function getConnectionInfo(endpoint = "/api/info") {
  const [res, edgeMap] = await Promise.all([
    fetch(endpoint + "?t=" + crypto.randomUUID(), { cache: "no-store" }),
    loadEdgeMap()
  ]);

  const raw    = await res.json();
  const colo   = raw.edge?.colo ?? null;
  const popMeta = colo && edgeMap[colo] ? edgeMap[colo] : null;

  return {
    client:   raw.client   ?? {},
    network:  raw.network  ?? {},
    protocol: raw.protocol ?? {},
    edge: {
      colo,
      rayId:       raw.edge?.rayId      ?? null,
      city:        popMeta?.city        ?? null,
      country:     popMeta?.country     ?? null,
      countryCode: popMeta?.countryCode ?? null,
      latitude:    popMeta?.latitude    ?? null,
      longitude:   popMeta?.longitude   ?? null
    }
  };
}
```

If `colo` is null or not found in the edge map, all enriched edge fields are null. The function does not throw in this case — partial data is returned.

On any fetch or parse error, returns `{ error: true }`.

### Merged object shape

```js
{
  client: {
    ip, city, region, country, continent, timezone, latitude, longitude
  },
  network: {
    asn, originAsOrg
  },
  protocol: {
    tlsVersion, httpVersion
  },
  edge: {
    colo,        // from Worker
    rayId,       // from Worker
    city,        // from edge map
    country,     // from edge map
    countryCode, // from edge map
    latitude,    // from edge map
    longitude    // from edge map
  }
}
```

`client.latitude` and `client.longitude` come from the Worker (`request.cf`) and represent the approximate centre of the resolved city — city-level granularity, not device location. `edge.latitude` and `edge.longitude` come from the static edge map and represent the PoP's approximate geographic position.