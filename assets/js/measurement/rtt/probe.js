/**
 * HTTP-level RTT probe.
 * Measures time from fetch start to response headers received.
 * This includes:
 *  - DNS (if uncached)
 *  - TCP handshake (if new connection)
 *  - TLS handshake (if new connection)
 *  - Request + response transit
 *
 * It does NOT measure ICMP or raw TCP RTT.
 */

export async function probeRTT(
  endpoint = "/api/ping"
) {
  const url = endpoint + "?t=" + crypto.randomUUID();
  const start = performance.now();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      keepalive: false
    });

    const latency = performance.now() - start;

    return {
      latency,
      success: response.ok,
      timestamp: performance.now()
    };

  } catch (err) {
    return {
      latency: null,
      success: false,
      timestamp: performance.now(),
      error: true
    };
  }
}