/**
 * Convert classified conditions into probable network causes
 * Returns structured findings, not UI text
 */

export function diagnose(classified, info) {

    const findings = [];

    // --- Routing distance ---
    if (classified.distance === "very_far") {
        findings.push({
            type: "routing",
            severity: "high",
            code: "remote_pop",
            detail: "traffic terminating in distant region"
        });
    }
    else if (classified.distance === "far") {
        findings.push({
            type: "routing",
            severity: "medium",
            code: "suboptimal_peering",
            detail: "likely non-local exchange routing"
        });
    }

    // --- Stability / jitter ---
    if (classified.stability === "severely_unstable") {
        findings.push({
            type: "congestion",
            severity: "high",
            code: "bufferbloat",
            detail: "heavy queueing delay under load"
        });
    }
    else if (classified.stability === "unstable") {
        findings.push({
            type: "congestion",
            severity: "medium",
            code: "variable_latency",
            detail: "intermittent queue or wireless interference"
        });
    }

    // --- Packet loss ---
    if (classified.loss === "major" || classified.loss === "severe") {
        findings.push({
            type: "link",
            severity: "high",
            code: "packet_loss",
            detail: "significant packet retransmissions"
        });
    }

    // --- Handshake behaviour ---
    if (classified.handshake === "very_slow_start") {
        findings.push({
            type: "connection",
            severity: "medium",
            code: "cold_start_penalty",
            detail: "slow NAT/state establishment"
        });
    }
    else if (classified.handshake === "slow_start") {
        findings.push({
            type: "connection",
            severity: "low",
            code: "delayed_setup",
            detail: "slightly slow connection setup"
        });
    }

    // --- Capacity ---
    if (classified.capacity === "very_low" && classified.stability !== "stable") {
        findings.push({
            type: "throughput",
            severity: "medium",
            code: "queue_limited",
            detail: "flow limited by latency variation"
        });
    }

    // --- Tor / proxy detection ---
    if (info && info.isp && info.isp.toLowerCase().includes("tor")) {
        findings.push({
            type: "environment",
            severity: "info",
            code: "tor_exit",
            detail: "traffic routed through anonymity network"
        });
    }

    if (!findings.length) {
        findings.push({
            type: "status",
            severity: "ok",
            code: "healthy",
            detail: "no major network impairments detected"
        });
    }

    return findings;
}
