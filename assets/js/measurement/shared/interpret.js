const T = {
  rtt: {
    excellent:  30,
    great:      60,
    good:      100,
    acceptable: 150,
    high:       250,
  },
  jitter: {
    stableRatio:     0.08,
    stableAbs:       8,    // ms
    okRatio:         0.15,
    okAbs:           20,   // ms
    noticeableRatio: 0.30,
    noticeableAbs:   30,   // ms
    badAbs:          60,   // ms
  },
  spike: {
    clean:    1.30,
    ok:       1.60,
    notable:  2.00,
  },
  warm: {
    fast:  80,
    ok:   150,
    slow: 250,
  },
  delta: {
    normal:   80,
    elevated: 150,
  },
};


function jitterLevel(jitter, median) {
  if (jitter == null || median == null) return "unknown";
  const r = median > 0 ? jitter / median : 0;
  if (jitter >= T.jitter.badAbs        && r >= T.jitter.noticeableRatio) return "bad";
  if (jitter >= T.jitter.noticeableAbs || r >= T.jitter.okRatio)         return "noticeable";
  if (jitter >= T.jitter.stableAbs     || r >= T.jitter.stableRatio)     return "ok";
  return "stable";
}

function spikeLevel(p90, median) {
  if (p90 == null || median == null || median === 0) return "unknown";
  const r = p90 / median;
  if (r >= T.spike.notable) return "severe";
  if (r >= T.spike.ok)      return "notable";
  if (r >= T.spike.clean)   return "ok";
  return "clean";
}

function rttLevel(median) {
  if (median == null)                  return "unknown";
  if (median <= T.rtt.excellent)       return "excellent";
  if (median <= T.rtt.great)           return "great";
  if (median <= T.rtt.good)            return "good";
  if (median <= T.rtt.acceptable)      return "acceptable";
  if (median <= T.rtt.high)            return "high";
  return "severe";
}



function isServerBottleneck(warm, jitter, median, p90) {
  if (warm == null || warm < T.warm.slow) return false;
  if (median == null || median >= 120) return false;
  const jL = jitterLevel(jitter, median);
  const sL = spikeLevel(p90, median);
  const pathStable = (jL === "stable" || jL === "ok") && (sL === "clean" || sL === "ok");
  return pathStable;
}



function scoreUsecases(median, jitter, p90) {
  const jL = jitterLevel(jitter, median);
  const sL = spikeLevel(p90, median);
  const rL = rttLevel(median);

  const jBad    = jL === "bad";
  const jHigh   = jL === "noticeable" || jBad;
  const jStrict = jL !== "stable" && jL !== "ok";
  const sBad    = sL === "severe";
  const sHigh   = sL === "notable" || sBad;
  const sMed    = sL === "ok" || sHigh;

  return [
    {
      label: "Web Browsing",
      status: rL === "severe" || jBad
            ? "poor"
            : rL === "high"
            ? "ok"
            : "good",
    },
    {
      label: "Video Streaming",
      status: rL === "severe" || sBad
            ? "poor"
            : rL === "high" || sHigh
            ? "ok"
            : "good",
    },
    {
      label: "Video Calls",
      status: jBad || (jitter != null && jitter > 50) || rL === "severe"
            ? "poor"
            : jHigh || (jitter != null && jitter > 25) || rL === "high"
            ? "ok"
            : "good",
    },
    {
      label: "Online Gaming",
      status: rL === "severe" || rL === "high" || rL === "acceptable" || jBad
            ? "poor"
            : jHigh || sHigh
            ? "ok"
            : "good",
    },
    {
      label: "Remote Desktop",
      status: rL === "severe" || rL === "high" || jBad || sBad
            ? "poor"
            : rL === "acceptable" || jStrict || sMed
            ? "ok"
            : "good",
    },
  ];
}



function deriveVerdict(median, jitter, p90, warm, delta) {
  const jL = jitterLevel(jitter, median);
  const sL = spikeLevel(p90, median);
  const rL = rttLevel(median);
  const serverFault = isServerBottleneck(warm, jitter, median, p90);

  const jBad   = jL === "bad";
  const jNoisy = jL === "noticeable" || jBad;
  const sBad   = sL === "severe";
  const sWarn  = sL === "notable" || sBad;

  if (jBad && sBad) {
    return {
      level:       "bad",
      headline:    "Severely unstable connection",
      consequence: "Round-trip times are erratic and spiking constantly. Calls will cut out, gaming will produce lag spikes, and streams will buffer unpredictably. Something is actively wrong with the path.",
    };
  }

  if (jBad) {
    return {
      level:       "bad",
      headline:    "Highly unstable — excessive jitter",
      consequence: "Even if average latency looks acceptable, the large swing between round-trips will cause choppy calls, stuttering in games, and unreliable real-time applications.",
    };
  }

  if (sBad) {
    return {
      level:       "bad",
      headline:    "Frequent severe latency spikes",
      consequence: "At least 1 in 10 requests takes significantly longer than normal. The average is misleading — real-world interactions will feel unpredictably slow.",
    };
  }

  if (serverFault) {
    return {
      level:       "ok",
      headline:    "Network path is fine — server responding slowly",
      consequence: `Your connection is stable. Warm RTT is ${warm?.toFixed(0) ?? "—"} ms — the delay is in server processing, not the network. Local performance for other services should be unaffected.`,
    };
  }

  if (rL === "severe") {
    return jNoisy || sWarn
      ? {
          level:       "bad",
          headline:    "Very high latency with instability",
          consequence: "Latency is extremely high and delivery is inconsistent. Almost all interactive applications will struggle. Check if you are routing through a distant server or VPN.",
        }
      : {
          level:       "slow",
          headline:    "Very high latency — stable signal",
          consequence: "The network path is unusually long. Streaming and downloads will work, but anything real-time — gaming, calls, remote desktop — will feel significantly delayed.",
        };
  }

  if (rL === "high") {
    return jNoisy || sWarn
      ? {
          level:       "unstable",
          headline:    "High latency and inconsistent delivery",
          consequence: "Both latency and jitter are elevated. Calls will be noticeably delayed and may break up. Gaming is not viable. Streaming should work if buffered.",
        }
      : {
          level:       "slow",
          headline:    "High latency, stable delivery",
          consequence: "Latency is above comfortable levels for real-time use. Calls will feel slightly delayed and gaming will be sluggish, but streaming and browsing are unaffected.",
        };
  }

  if (rL === "acceptable") {
    return jNoisy || sWarn
      ? {
          level:       "ok",
          headline:    "Acceptable latency, unsteady delivery",
          consequence: "Latency is in a tolerable range but jitter or spikes add unpredictability. Calls will generally work but may occasionally break up. Competitive gaming will feel off.",
        }
      : {
          level:       "ok",
          headline:    "Acceptable latency",
          consequence: "Low enough for most applications. Casual gaming and calls will work. Competitive gaming will feel slightly sluggish compared to a lower-latency connection.",
        };
  }

  if (jNoisy || sWarn) {
    return {
      level:       "ok",
      headline:    "Good latency, inconsistent delivery",
      consequence: "Base latency is solid, but jitter or spikes are degrading the experience for real-time applications. Calls and gaming will work but may occasionally feel rough.",
    };
  }

  if (rL === "excellent" || rL === "great") {
    return {
      level:       "great",
      headline:    rL === "excellent" ? "Excellent — low latency, rock-solid" : "Fast and stable",
      consequence: rL === "excellent"
        ? "Sub-30ms with consistent delivery. Ideal for competitive gaming, video calls, remote desktop, and anything latency-sensitive."
        : "Low latency and steady delivery. Comfortable for gaming, calls, and real-time applications.",
    };
  }

  return {
    level:       "ok",
    headline:    "Good connection",
    consequence: "Solid for browsing, streaming, and video calls. Gaming is comfortable for most titles, though competitive play may notice the latency.",
  };
}



function buildFindings(median, jitter, p90, cold, warm, coldOk, warmOk) {
  const findings = [];
  const jL = jitterLevel(jitter, median);
  const sL = spikeLevel(p90, median);
  const rL = rttLevel(median);
  const delta = (cold != null && warm != null) ? cold - warm : null;
  const serverFault = isServerBottleneck(warm, jitter, median, p90);
  const jR = (median > 0 && jitter != null) ? jitter / median : 0;
  const sR = (median > 0 && p90 != null)    ? p90 / median    : 1;

  // ── RTT ──
  if (median != null) {
    if (rL === "excellent") {
      findings.push({
        severity: "ok",
        headline: "Excellent latency",
        detail:   `${median.toFixed(1)} ms median — well below the threshold where delay becomes perceptible. Ideal for any latency-sensitive application.`,
        tip:      null,
      });
    } else if (rL === "great") {
      findings.push({
        severity: "ok",
        headline: "Low latency",
        detail:   `${median.toFixed(1)} ms median — within the range considered ideal for competitive gaming and real-time communication.`,
        tip:      null,
      });
    } else if (rL === "good") {
      findings.push({
        severity: "ok",
        headline: "Good latency",
        detail:   `${median.toFixed(1)} ms median — comfortable for calls and casual gaming. Competitive gaming starts to feel slightly sluggish above 60 ms.`,
        tip:      null,
      });
    } else if (rL === "acceptable") {
      findings.push({
        severity: "warn",
        headline: "Elevated latency",
        detail:   `${median.toFixed(1)} ms median. Calls and casual gaming will work, but expect a perceptible delay. Competitive games will feel unresponsive at this level.`,
        tip:      "If you are on Wi-Fi, try a wired connection. Check if a VPN is active and routing traffic through a distant server.",
      });
    } else if (rL === "high" && !serverFault) {
      findings.push({
        severity: "warn",
        headline: "High baseline latency",
        detail:   `${median.toFixed(1)} ms median. The network path to this edge server is long or congested. Real-time applications will be degraded noticeably.`,
        tip:      "Run a traceroute to identify where delay accumulates. Check if your ISP is routing traffic through a suboptimal path.",
      });
    } else if (rL === "severe" && !serverFault) {
      findings.push({
        severity: "err",
        headline: "Severe baseline latency",
        detail:   `${median.toFixed(1)} ms median — far above what any real-time application can tolerate. Even web browsing will feel sluggish at this level.`,
        tip:      "This is unusually high for a wired or standard Wi-Fi connection. Check for a VPN routing through a distant country, or a severely congested network path.",
      });
    }
  }

  if (jitter != null && median != null) {
    if (jL === "bad") {
      findings.push({
        severity: "err",
        headline: "Severe jitter",
        detail:   `σ ${jitter.toFixed(1)} ms — ${(jR * 100).toFixed(0)}% of median RTT. Round-trip times are wildly inconsistent. Even when the average looks acceptable, individual packets are experiencing very different delays, which directly causes choppy audio, broken video calls, and lag spikes in games.`,
        tip:      "Switch to a wired connection if on Wi-Fi. Check for other devices saturating your uplink. On wired connections, a faulty cable or failing switch port can cause this pattern.",
      });
    } else if (jL === "noticeable") {
      findings.push({
        severity: "warn",
        headline: "Noticeable jitter",
        detail:   `σ ${jitter.toFixed(1)} ms — ${(jR * 100).toFixed(0)}% variance around median. This level of inconsistency is enough to cause occasional audio breakup in calls and micro-stutters in games. Streaming is usually unaffected due to buffering.`,
        tip:      "Close background apps competing for bandwidth. On Wi-Fi, interference or distance from the router is a common cause — try switching to 5 GHz or a wired connection.",
      });
    } else if (jL === "ok") {
      findings.push({
        severity: "ok",
        headline: "Mostly stable signal",
        detail:   `σ ${jitter.toFixed(1)} ms — minor variance, unlikely to be user-visible under normal conditions.`,
        tip:      null,
      });
    } else {
      findings.push({
        severity: "ok",
        headline: "Stable signal",
        detail:   `σ ${jitter.toFixed(1)} ms — round-trips are highly consistent. Jitter is not a concern.`,
        tip:      null,
      });
    }
  }

  if (p90 != null && median != null && median > 0) {
    if (sL === "severe") {
      findings.push({
        severity: "err",
        headline: "Frequent severe latency spikes",
        detail:   `p90 is ${p90.toFixed(1)} ms — ${((sR - 1) * 100).toFixed(0)}% above median. At least 1 in 10 requests hits a severely degraded path. The average latency is misleading; real interactions are frequently much worse.`,
        tip:      "This pattern is a classic sign of bufferbloat — your router's buffer is filling and queuing packets during bursts. Enable SQM or fq_codel on your router if available.",
      });
    } else if (sL === "notable") {
      findings.push({
        severity: "warn",
        headline: "Occasional latency spikes",
        detail:   `p90 ${p90.toFixed(1)} ms vs. ${median.toFixed(1)} ms median — ${((sR - 1) * 100).toFixed(0)}% above median at the 90th percentile. Spikes are infrequent but will be noticeable in games and calls.`,
        tip:      "If this occurs under load (e.g. while downloading), bufferbloat is likely. Try enabling queue management on your router.",
      });
    } else if (sL === "ok") {
      findings.push({
        severity: "ok",
        headline: "Minor occasional spikes",
        detail:   `p90 ${p90.toFixed(1)} ms vs. ${median.toFixed(1)} ms median — slight elevation at the tail, but not enough to cause user-visible issues in most applications.`,
        tip:      null,
      });
    }
  }


  if (cold != null && warm != null) {
    if (!coldOk || !warmOk) {
      findings.push({
        severity: "err",
        headline: "Handshake measurement failed",
        detail:   "Connection setup could not be measured reliably. Results for cold and warm RTT should be disregarded.",
        tip:      "Check whether your network or a browser extension is interfering with the probe request.",
      });
    } else if (serverFault) {
      findings.push({
        severity: "err",
        headline: "Server processing delay detected",
        detail:   `Warm RTT is ${warm.toFixed(1)} ms — high even after the connection is established and the path is stable (σ ${jitter?.toFixed(1) ?? "?"} ms). The delay is in server-side processing, not the network. Your local connection is fine.`,
        tip:      "This is a server-side issue. It may indicate high CPU load, slow database queries, or cold-start latency on serverless infrastructure.",
      });
    } else {

      if (warm >= T.warm.slow) {
        findings.push({
          severity: "warn",
          headline: "Slow warm RTT",
          detail:   `Warm RTT is ${warm.toFixed(1)} ms. Even after connection setup overhead is removed, round-trip time to the server is high. This sets a floor on interactive response times.`,
          tip:      "Check geographic distance to the edge server. Using a CDN endpoint closer to your location would reduce this.",
        });
      } else if (warm >= T.warm.ok) {
        findings.push({
          severity: "warn",
          headline: "Moderate warm RTT",
          detail:   `Warm RTT is ${warm.toFixed(1)} ms — above the comfortable threshold for real-time use. This reflects the baseline network distance to the server, independent of setup overhead.`,
          tip:      null,
        });
      }

      if (delta != null) {
        if (delta >= T.delta.elevated) {
          findings.push({
            severity: "warn",
            headline: "High connection setup overhead",
            detail:   `Cold start takes ${cold.toFixed(1)} ms vs. ${warm.toFixed(1)} ms warm — ${delta.toFixed(0)} ms overhead for DNS + TCP + TLS. Every cold connection pays this cost, which is noticeable on first page load, new domains, and connection re-establishment after idle periods.`,
            tip:      "Ensure HTTP/2 or HTTP/3 is active so connections are reused. Verify TLS session resumption (TLS 1.3 with 0-RTT or TLS 1.2 session tickets) is configured on the server.",
          });
        } else if (delta >= T.delta.normal) {
          findings.push({
            severity: "ok",
            headline: "Moderate connection setup overhead",
            detail:   `${delta.toFixed(0)} ms cold−warm overhead (${cold.toFixed(1)} ms vs. ${warm.toFixed(1)} ms). Acceptable but worth noting — first-connection latency is meaningfully higher than ongoing RTT.`,
            tip:      null,
          });
        } else {
          findings.push({
            severity: "ok",
            headline: "Fast connection setup",
            detail:   `${delta.toFixed(0)} ms overhead — DNS + TCP + TLS resolved cleanly. Cold connections are nearly as fast as warm ones.`,
            tip:      null,
          });
        }
      }
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

  const verdictBase = deriveVerdict(
    median ?? 0,
    jitter ?? 0,
    p90    ?? median ?? 0,
    warm,
    cold != null && warm != null ? cold - warm : null,
  );

  const usecases = scoreUsecases(
    median ?? 0,
    jitter ?? 0,
    p90    ?? median ?? 0,
  );

  const findings = buildFindings(
    median, jitter, p90,
    cold, warm,
    hs.coldSuccess, hs.warmSuccess,
  );

  return {
    verdict: { ...verdictBase, usecases },
    findings,
  };
}