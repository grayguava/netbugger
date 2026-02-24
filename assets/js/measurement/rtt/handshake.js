import { probeRTT } from "./probe.js";

/**
 * Cold vs Warm HTTP handshake measurement.
 *
 * "Cold" is best-effort.
 * Browser may reuse:
 *  - DNS cache
 *  - TLS session
 *  - HTTP/2 connection
 *
 * So cold is not guaranteed raw TCP cold start.
 */

export async function measureHandshake(
  endpoint = "/api/ping"
) {
  const cold = await probeRTT(endpoint);

  // Warm connection
  for (let i = 0; i < 4; i++) {
    await probeRTT(endpoint);
  }

  const warm = await probeRTT(endpoint);

  return {
    cold: cold.latency,
    warm: warm.latency,
    coldSuccess: cold.success,
    warmSuccess: warm.success
  };
}