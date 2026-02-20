/**
 * Classify raw metrics into neutral condition labels
 * This does NOT explain causes — only describes behavior.
 */


/**
 * Latency distance classification
 */
export function classifyDistance(avg) {
    if (avg === null) return "unknown";
    if (avg < 40) return "local";
    if (avg < 120) return "regional";
    if (avg < 250) return "far";
    return "very_far";
}


/**
 * Stability classification using jitter
 */
export function classifyStability(jitter) {
    if (jitter === null) return "unknown";
    if (jitter < 15) return "stable";
    if (jitter < 40) return "moderate";
    if (jitter < 120) return "unstable";
    return "severely_unstable";
}


/**
 * Packet loss classification
 */
export function classifyLoss(loss) {
    if (loss === null) return "unknown";
    if (loss === 0) return "none";
    if (loss < 0.01) return "tiny";
    if (loss < 0.03) return "minor";
    if (loss < 0.10) return "major";
    return "severe";
}


/**
 * Connection setup behavior
 */
export function classifyHandshake(cold, warm) {
    if (cold === null || warm === null) return "unknown";

    const ratio = cold / warm;

    if (ratio < 1.5) return "normal";
    if (ratio < 3) return "slow_start";
    return "very_slow_start";
}


/**
 * Throughput capacity classification
 */
export function classifyCapacity(rateMBps) {
    if (rateMBps === null) return "unknown";
    if (rateMBps < 0.5) return "very_low";
    if (rateMBps < 1.5) return "low";
    if (rateMBps < 4) return "moderate";
    if (rateMBps < 10) return "high";
    return "very_high";
}


/**
 * Combine all classifications
 */
export function classifyAll({latency, handshake, stability, capacity}) {

    return {
        distance: classifyDistance(latency.avg),
        stability: classifyStability(latency.jitter),
        loss: classifyLoss(latency.loss),
        handshake: classifyHandshake(handshake.cold, handshake.warm),
        capacity: classifyCapacity(capacity.rateMBps)
    };
}
