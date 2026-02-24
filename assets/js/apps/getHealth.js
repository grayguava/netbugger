import { getConnectionInfo } from "../measurement/environment/getConnectionInfo.js";
import { measureHandshake } from "../measurement/rtt/handshake.js";
import { measureRTT } from "../measurement/rtt/stability.js";

/**
 * Health test runner (Latency-only version)
 * No throughput logic.
 * Clean and deterministic.
 */

export async function runHealthTest({
  stabilityDuration = 5000,
  stabilityInterval = 100,
  onLatencySample
} = {}) {

  const result = {
    info: null,
    handshake: null,
    latency: null,
    timestamp: Date.now()
  };

  // 1️⃣ Connection metadata
  result.info = await getConnectionInfo();

  // 2️⃣ Handshake measurement (best effort)
  result.handshake = await measureHandshake();

  // 3️⃣ Stability sampling
  result.latency = await measureRTT(
    stabilityDuration,
    stabilityInterval,
    onLatencySample
  );

  return result;
}