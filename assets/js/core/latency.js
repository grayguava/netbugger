/**
 * Single RTT probe to edge
 * Returns round trip time in milliseconds
 */

export async function probeRTT(endpoint = "/api/diagnostics/ping") {

    const url = endpoint + "?t=" + crypto.randomUUID();

    const start = performance.now();

    try {
        const res = await fetch(url, {
            cache: "no-store",
            keepalive: false
        });

        // force body consumption so timing includes transfer completion
        await res.arrayBuffer();

    } catch (e) {
        // network error / packet loss
        return null;
    }

    return performance.now() - start;
}


/**
 * Cold + warm latency measurement
 * First request includes TCP/TLS setup
 * Following ones represent steady-state
 */

export async function measureHandshake(endpoint = "/api/diagnostics/network/ping") {

    const cold = await probeRTT(endpoint);

    // warm connection stabilization
    for (let i = 0; i < 4; i++)
        await probeRTT(endpoint);

    const warm = await probeRTT(endpoint);

    return {
        cold,
        warm
    };
}
