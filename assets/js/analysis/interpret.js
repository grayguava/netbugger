/**
 * Convert diagnosis findings into readable explanations
 * No measurement logic here — only wording.
 */

const MESSAGES = {

    remote_pop:
        "Your traffic is reaching a faraway network exchange. This increases reaction time even if bandwidth is high.",

    suboptimal_peering:
        "Your ISP is routing traffic through a non-local exchange. Latency is higher than necessary.",

    bufferbloat:
        "Your connection becomes overloaded under traffic. Interactive apps (calls, games) will lag during uploads or downloads.",

    variable_latency:
        "Latency fluctuates. This usually indicates congestion or wireless interference.",

    packet_loss:
        "Packets are being retransmitted. This causes freezing, voice glitches, or slow page loads.",

    cold_start_penalty:
        "New connections take unusually long to establish. This often happens with carrier-grade NAT or mobile networks.",

    delayed_setup:
        "Connection setup is slightly slower than normal but not critical.",

    queue_limited:
        "Responsiveness is limited by delay rather than bandwidth capacity.",

    tor_exit:
        "Traffic is passing through an anonymity relay network. Measurements reflect the relay path, not your ISP.",

    healthy:
        "No significant connection problems detected. Performance should feel responsive."
};


/**
 * Convert findings into readable report
 */
export function interpret(findings) {

    return findings.map(f => ({
        severity: f.severity,
        message: MESSAGES[f.code] || "Unknown network behavior detected.",
        code: f.code
    }));
}


/**
 * Produce a short summary sentence
 */
export function summarize(findings) {

    const highest = findings.reduce((a,b) =>
        severityRank(b.severity) > severityRank(a.severity) ? b : a
    , findings[0]);

    return interpret([highest])[0].message;
}


/**
 * severity ordering
 */
function severityRank(level) {
    return {
        ok:0,
        info:1,
        low:2,
        medium:3,
        high:4
    }[level] ?? 0;
}
