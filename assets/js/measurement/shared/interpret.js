const T = {
  rtt:    { great: 50,   ok: 150  },   // median ms
  jitter: { ok: 0.20,   bad: 0.50 },   // σ / median
  spike:  { ok: 1.50,   bad: 2.20 },   // p90 / median
  warm:   { ok: 120,    bad: 300  },   // absolute warm ms
  delta:  { high: 180   },             // cold − warm ms
};


function isServerBottleneck(warm, jRatio, sRatio, delta) {
  if (warm == null || warm < T.warm.bad) return false;
  const pathIsStable = jRatio < T.jitter.ok && sRatio < T.spike.ok;
  const deltaIsSmall = delta != null && Math.abs(delta) < 100;
  return pathIsStable && deltaIsSmall;
}


function scoreUsecases(median, jitter, p90) {
  const jR = (median > 0) ? jitter / median : 0;
  const sR = (median > 0) ? p90 / median    : 1;

  function grade(score) {
    return score >= 2 ? "good" : score >= 1 ? "ok" : "poor";
  }

  const browsing  = (median < 300 ? 2 : median < 700 ? 1 : 0)
                  + (sR < 1.6 ? 1 : 0);

  const streaming = (sR < 1.6 ? 2 : sR < 2.2 ? 1 : 0)
                  + (jR < 0.30 ? 1 : 0);

  const gaming    = (median < 60 ? 2 : median < 130 ? 1 : 0)
                  + (jR < 0.20 ? 1 : 0);

  const calls     = (jR < 0.20 ? 2 : jR < 0.40 ? 1 : 0)
                  + (median < 150 ? 1 : 0);

  return [
    { label: "Browsing",  status: grade(browsing)  },
    { label: "Streaming", status: grade(streaming) },
    { label: "Gaming",    status: grade(gaming)    },
    { label: "Calls",     status: grade(calls)     },
  ];
}


function deriveVerdict(median, jitter, p90, warm, delta) {
  const jR = (median > 0) ? jitter / median : 0;
  const sR = (median > 0) ? p90 / median    : 1;
  const serverFault = isServerBottleneck(warm, jR, sR, delta);

  if (jR >= T.jitter.bad || sR >= T.spike.bad) {
    return {
      level: "bad",
      headline: "Severely unstable connection",
      consequence: "Calls will cut out, gaming will lag, and streams will buffer unpredictably.",
    };
  }

  if (serverFault) {
    return {
      level: "bad",
      headline: "Server is responding slowly",
      consequence: "Your network path is fine. The server itself is the bottleneck.",
    };
  }

  if (median > T.rtt.ok && (jR >= T.jitter.ok || sR >= T.spike.ok)) {
    return {
      level: "unstable",
      headline: "Slow and inconsistent",
      consequence: "High latency with added jitter. Real-time apps will struggle significantly.",
    };
  }

  if (median > T.rtt.ok) {
    return {
      level: "slow",
      headline: "High latency, stable signal",
      consequence: "Browsing and streaming will work fine. Gaming and calls will feel delayed.",
    };
  }

  if (jR >= T.jitter.ok || sR >= T.spike.ok) {
    return {
      level: "ok",
      headline: "Good, with occasional instability",
      consequence: "Most things will work well. Calls and gaming may occasionally stutter.",
    };
  }

  if (median <= T.rtt.great) {
    return {
      level: "great",
      headline: "Fast and stable",
      consequence: "Excellent for everything — gaming, calls, streaming, browsing.",
    };
  }

  return {
    level: "ok",
    headline: "Good connection",
    consequence: "Solid for browsing, streaming, and calls. Gaming is playable.",
  };
}


function buildFindings(median, jitter, p90, cold, warm, coldOk, warmOk) {
  const findings = [];
  const jR = (median > 0) ? jitter / median : 0;
  const sR = (median > 0) ? p90 / median    : 1;
  const delta = (cold != null && warm != null) ? cold - warm : null;
  const serverFault = isServerBottleneck(warm, jR, sR, delta);

  if (median != null) {
    if (median <= T.rtt.great) {
      findings.push({
        severity: "ok",
        headline: "Low latency",
        detail: `${median.toFixed(1)} ms median — network delay is imperceptible.`,
        tip: null,
      });
    } else if (median > T.rtt.ok) {

      if (!serverFault) {
        findings.push({
          severity: "warn",
          headline: "High baseline latency",
          detail: `${median.toFixed(1)} ms median. The network path to this server is long or congested.`,
          tip: "Run a traceroute to identify where delay accumulates. Check if your ISP is routing traffic inefficiently.",
        });
      }
    }
  }

  if (jitter != null && median != null) {
    if (jR >= T.jitter.bad) {
      findings.push({
        severity: "err",
        headline: "Severe jitter",
        detail: `σ ${jitter.toFixed(1)} ms — ${(jR * 100).toFixed(0)}% of median RTT. Round-trips are wildly inconsistent.`,
        tip: "Switch to a wired connection if on Wi-Fi. Check for other devices saturating your uplink.",
      });
    } else if (jR >= T.jitter.ok) {
      findings.push({
        severity: "warn",
        headline: "Noticeable jitter",
        detail: `σ ${jitter.toFixed(1)} ms — ${(jR * 100).toFixed(0)}% variance. Enough to cause choppy audio and video.`,
        tip: "Close bandwidth-heavy background apps. On Wi-Fi, switching to 5 GHz or a wired connection helps.",
      });
    } else {
      findings.push({
        severity: "ok",
        headline: "Stable signal",
        detail: `σ ${jitter.toFixed(1)} ms — round-trips are consistent.`,
        tip: null,
      });
    }
  }

  if (p90 != null && median != null && median > 0) {
    if (sR >= T.spike.bad) {
      findings.push({
        severity: "err",
        headline: "Frequent latency spikes",
        detail: `p90 is ${p90.toFixed(1)} ms — ${((sR - 1) * 100).toFixed(0)}% above median. At least 1 in 10 requests hits a severely degraded path.`,
        tip: "This pattern is consistent with bufferbloat. Enable SQM/QoS on your router if available.",
      });
    } else if (sR >= T.spike.ok) {
      findings.push({
        severity: "warn",
        headline: "Occasional spikes",
        detail: `p90 ${p90.toFixed(1)} ms vs. ${median.toFixed(1)} ms median — spikes are infrequent but present.`,
        tip: null,
      });
    }
  }

  if (cold != null && warm != null) {
    if (!coldOk || !warmOk) {
      findings.push({
        severity: "err",
        headline: "Handshake probe failed",
        detail: "Connection setup could not be measured reliably.",
        tip: "Check server availability and whether your network blocks the probe endpoint.",
      });
    } else if (serverFault) {

      findings.push({
        severity: "err",
        headline: "Slow server response",
        detail: `Warm RTT ${warm.toFixed(1)} ms — high even after the connection is warm. Path is stable (σ ${jitter?.toFixed(1) ?? "?"} ms), so processing delay is server-side.`,
        tip: "Investigate server CPU load, database query time, or cold-start latency on serverless functions.",
      });
    } else if (delta != null && delta >= T.delta.high) {
      findings.push({
        severity: "warn",
        headline: "High connection setup cost",
        detail: `Cold start adds ${delta.toFixed(1)} ms over warm (${cold.toFixed(1)} ms vs. ${warm.toFixed(1)} ms). Repeated cold connections pay this each time.`,
        tip: "Ensure HTTP/2 or HTTP/3 is active so connections are reused. Verify TLS session resumption is configured on the server.",
      });
    } else if (delta != null) {
      findings.push({
        severity: "ok",
        headline: "Fast connection setup",
        detail: `${delta.toFixed(1)} ms overhead — DNS + TCP + TLS negotiated cleanly.`,
        tip: null,
      });
    }
  }

  const rank = { err: 0, warn: 1, ok: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return findings;
}


export function interpret(result) {
  const lat = result?.latency   ?? {};
  const hs  = result?.handshake ?? {};

  const median = lat.median     ?? null;
  const jitter = lat.jitter_std ?? null;
  const p90    = lat.p90        ?? null;
  const cold   = hs.cold        ?? null;
  const warm   = hs.warm        ?? null;
  const delta  = (cold != null && warm != null) ? cold - warm : null;

  const verdictBase = deriveVerdict(median ?? 0, jitter ?? 0, p90 ?? median ?? 0, warm, delta);
  const usecases    = scoreUsecases(median ?? 0, jitter ?? 0, p90 ?? median ?? 0);
  const findings    = buildFindings(median, jitter, p90, cold, warm, hs.coldSuccess, hs.warmSuccess);

  return {
    verdict: { ...verdictBase, usecases },
    findings,
  };
}