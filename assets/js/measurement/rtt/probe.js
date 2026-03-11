export async function probeRTT(
  endpoint = "/api/ping"
) {

  const url = endpoint + "?t=" + crypto.randomUUID();

  const start = performance.now();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      keepalive: false,
    });

     const ttfb = performance.now() - start;

    await response.text();
    const totalLatency = performance.now() - start;

    return {
      ttfb,               
      latency: totalLatency,
      status: response.status,
      success: response.ok,
      timestamp: performance.now()
    };

  } catch (err) {
    return {
      ttfb: null,
      latency: null,
      status: null,
      success: false,
      timestamp: performance.now(),
      error: true
    };
  }
}