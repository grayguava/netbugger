import { probeRTT } from "./probe.js";
import { sleep } from "../shared/sampler.js";


const WARMUP_PROBES = 6;
const WARMUP_INTERVAL_MS = 50;

export async function measureHandshake(
  endpoint = "/api/ping"
) {

  const cold = await probeRTT(endpoint);


  for (let i = 0; i < WARMUP_PROBES; i++) {
    await probeRTT(endpoint);
    await sleep(WARMUP_INTERVAL_MS);
  }

  const warm = await probeRTT(endpoint);

  return {

    cold: cold.ttfb ?? cold.latency,
    warm: warm.ttfb ?? warm.latency,
    coldSuccess: cold.success,
    warmSuccess: warm.success,
    coldStatus: cold.status,
    warmStatus: warm.status
  };
}