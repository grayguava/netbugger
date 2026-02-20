/**
 * Fetch Cloudflare edge connection metadata
 * Pure data retrieval — no interpretation
 */

export async function getConnectionInfo(endpoint="/api/diagnostics/info") {

    try {
        const res = await fetch(endpoint + "?t=" + crypto.randomUUID(), {
            cache: "no-store"
        });

        if (!res.ok)
            throw new Error("info request failed");

        const data = await res.json();

        return {
    colo: data.colo ?? null,
    city: data.city ?? null,
    country: data.country ?? null,
    asn: data.asn ?? null,
    isp: data.isp ?? null,
    tls: data.tls ?? null,
    http: data.http ?? null,

    clientLat: data.clientLat ?? null,
    clientLon: data.clientLon ?? null,
    edgeLat: data.edgeLat ?? null,
    edgeLon: data.edgeLon ?? null
};
        

} catch (e) {
    return {
        colo: null,
        city: null,
        country: null,
        asn: null,
        isp: null,
        tls: null,
        http: null,

        clientLat: null,
        clientLon: null,
        
        error: true
    };
    }
}


/**
 * Monitor POP changes over time
 * returns array of {time, colo}
 */

export async function trackPOP(durationMs=30000, intervalMs=5000) {

    const history = [];
    const start = performance.now();

    while (performance.now() - start < durationMs) {

        const info = await getConnectionInfo();
        history.push({
            t: performance.now() - start,
            colo: info.colo
        });

        await new Promise(r=>setTimeout(r, intervalMs));
    }

    return history;
}
