let CF_EDGE_MAP = null;

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
    CF_EDGE_MAP = {};
    return CF_EDGE_MAP;
  }
}

export async function getConnectionInfo(endpoint = "/api/info") {
  try {
    const [res, edgeMap] = await Promise.all([
      fetch(endpoint + "?t=" + crypto.randomUUID(), { cache: "no-store" }),
      loadEdgeMap()
    ]);

    if (!res.ok) throw new Error("info request failed");

    const raw = await res.json();

    const colo = raw.edge?.colo ?? null;
    const popMeta = colo && edgeMap[colo] ? edgeMap[colo] : null;

    return {
      client: raw.client ?? {},
      network: raw.network ?? {},
      protocol: raw.protocol ?? {},
      edge: {
        colo,
        rayId: raw.edge?.rayId ?? null,
        city: popMeta?.city ?? null,
        country: popMeta?.country ?? null,
        countryCode: popMeta?.countryCode ?? null,
        latitude: popMeta?.latitude ?? null,
        longitude: popMeta?.longitude ?? null
      }
    };

  } catch (e) {
    console.error("Connection info error:", e);
    return { error: true };
  }
}