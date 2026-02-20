import { getConnectionInfo } from "../core/info.js";
import { measureHandshake } from "../core/latency.js";
import { measureStability } from "../core/stability.js";
import { measureEdgeRate } from "../core/edge-rate.js";

/**
 * Runs a clean baseline measurement with no artificial load
 * Order matters to avoid contaminating results.
 */

export async function runIdleTest(options = {}) {

    const {
        stabilityDuration = 5000,
        stabilityInterval = 100,
        rateDuration = 5
    } = options;

    const result = {
        info: null,
        handshake: null,
        latency: null,
        capacity: null,
        timestamp: Date.now()
    };

    // 1) environment info (safe anytime)
    result.info = await getConnectionInfo();

    // 2) handshake (needs cold connection)
    result.handshake = await measureHandshake();

    // 3) latency stability sampling
    result.latency = await measureStability(stabilityDuration, stabilityInterval);

    // 4) throughput last (disturbs queues)
    result.capacity = await measureEdgeRate(rateDuration);

    return result;
}
