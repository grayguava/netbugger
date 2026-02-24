/*
 * Fetch Cloudflare edge connection metadata
 * Loads PoP map dynamically (no JSON module import)
 */

let CF_EDGE_MAP = null;

/**
 * Load Cloudflare PoP map once (cached in memory)
 */
async function loadEdgeMap() {
  if (CF_EDGE_MAP) return CF_EDGE_MAP;

  try {
    const res = await fetch("/assets/data/cloudflare-edge-locations.json", {
      cache: "force-cache"
    });

    if (!res.ok) throw new Error("Failed to load edge map");

    CF_EDGE_MAP = await res.json();
    return CF_EDGE_MAP;

  } catch (err) {
    console.error("Edge map load failed:", err);
    CF_EDGE_MAP = {}; // fallback to empty object
    return CF_EDGE_MAP;
  }
}


/**
 * Fetch connection information from backend
 */
export async function getConnectionInfo(endpoint = "/api/info") {

  try {
    const [infoRes, edgeMap] = await Promise.all([
      fetch(endpoint + "?t=" + crypto.randomUUID(), {
        cache: "no-store"
      }),
      loadEdgeMap()
    ]);

    if (!infoRes.ok)
      throw new Error("info request failed");

    const data = await infoRes.json();

    // Ray ID from response header
    const rayId = infoRes.headers.get("CF-Ray");

    const colo = data.colo ?? null;
    const popMeta = colo && edgeMap[colo] ? edgeMap[colo] : null;

    return {

      /* ---------- Edge Info ---------- */
      colo,
      rayId: rayId ?? null,

      edgeCity: popMeta?.city ?? null,
      edgeCountry: popMeta?.country ?? null,
      edgeCountryCode: popMeta?.countryCode ?? null,
      edgeLat: popMeta?.latitude ?? null,
      edgeLon: popMeta?.longitude ?? null,

      popFallback: !popMeta && !!colo,

      /* ---------- Client Info ---------- */
      clientIp: data.clientIp ?? null,
      clientCity: data.city ?? null,
      clientRegion: data.region ?? null,
      clientCountry: data.country ?? null,
      clientContinent: data.continent ?? null,
      clientTimezone: data.timezone ?? null,
      clientLat: data.clientLat ?? null,
      clientLon: data.clientLon ?? null,

      /* ---------- Network Info ---------- */
      asn: data.asn ?? null,
      isp: data.isp ?? null,
      tls: data.tls ?? null,
      http: data.http ?? null
    };

  } catch (e) {
    console.error("Connection info error:", e);

    return {
      error: true
    };
  }
}