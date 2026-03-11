const T = {
  sustained: {
    exceptional: 500,
    excellent:   200,
    fast:        100,
    adequate:     50,
    moderate:     25,
    slow:         10,
    poor:          3,
  },
  variance: {
    stable:   0.10,
    ok:       0.20,
    variable: 0.35,
  },
  peak_gap: {
    notable: 0.30, 
    severe:  0.50, 
  },
  ramp: {
    fast:     1500,
    normal:   4000,
    slow:     9000,
  },
};


function scoreUsecases(sustained, vr) {
  const s = sustained;


  return [
    {
      label:  "Web Browsing",
      status: s >= 10 && vr < T.variance.variable ? "good"
            : s >= 3  ? "ok"
            : "poor",
    },
    {
      label:  "HD Streaming",
      status: s >= 15 && vr < T.variance.ok       ? "good"
            : s >= 8  && vr < T.variance.variable  ? "ok"
            : "poor",
    },
    {
      label:  "4K Streaming",
      status: s >= 35 && vr < T.variance.ok        ? "good"
            : s >= 18 && vr < T.variance.variable  ? "ok"
            : "poor",
    },
    {
      label:  "Video Calls",
      status: s >= 10 && vr < T.variance.stable    ? "good"
            : s >= 5  && vr < T.variance.ok        ? "ok"
            : "poor",
    },
    {
      label:  "Large Downloads",
      status: s >= 100  ? "good"
            : s >= 25   ? "ok"
            : "poor",
    },
    {
      label:  "Cloud Gaming",
      status: s >= 35 && vr < T.variance.stable    ? "good"
            : s >= 15 && vr < T.variance.ok        ? "ok"
            : "poor",
    },
  ];
}


function getTier(s) {
  if (s >= T.sustained.exceptional) return "exceptional";
  if (s >= T.sustained.excellent)   return "excellent";
  if (s >= T.sustained.fast)        return "fast";
  if (s >= T.sustained.adequate)    return "adequate";
  if (s >= T.sustained.moderate)    return "moderate";
  if (s >= T.sustained.slow)        return "slow";
  if (s >= T.sustained.poor)        return "poor";
  return "unusable";
}

const TIER_CSS = {
  exceptional: "great",
  excellent:   "great",
  fast:        "great",
  adequate:    "ok",
  moderate:    "slow",
  slow:        "bad",
  poor:        "bad",
  unusable:    "bad",
};


function deriveVerdict(sustained, vr, stillRamping) {
  const tier = getTier(sustained);

  const rampNote = stillRamping
    ? " Speed was still climbing at the end of the test — actual capacity may be higher."
    : "";

  const verdicts = {
    exceptional: {
      headline:    "Near-gigabit throughput",
      consequence: "No realistic workload will saturate this connection. Multiple simultaneous 4K streams, large transfers, and cloud backups will all run concurrently without noticeable impact." + rampNote,
    },
    excellent: {
      headline:    vr < T.variance.ok
                     ? "Excellent speed, rock-solid delivery"
                     : "Excellent speed, minor variance",
      consequence: vr < T.variance.ok
                     ? "Multi-device 4K, fast downloads, and video calls all run without contention. This is comfortably above what most households need." + rampNote
                     : "More than fast enough for any single workload. Occasional speed fluctuations are unlikely to be user-visible at this throughput." + rampNote,
    },
    fast: {
      headline:    vr < T.variance.ok
                     ? "Fast and consistent"
                     : "Fast, but delivery is uneven",
      consequence: vr < T.variance.ok
                     ? "4K streaming and large downloads will be smooth. This tier handles most household use cases well." + rampNote
                     : "4K will generally work, but speed swings may occasionally cause buffering during peaks. Variance is the limiting factor here, not raw speed." + rampNote,
    },
    adequate: {
      headline:    vr < T.variance.ok
                     ? "Adequate — covers the basics comfortably"
                     : "Adequate speed, inconsistent delivery",
      consequence: vr < T.variance.ok
                     ? "Single 4K stream, HD video, and normal downloads will be fine. Simultaneous heavy use across multiple devices will start to show." + rampNote
                     : "Speed is sufficient for most tasks, but variance means 4K may stutter and downloads will be less predictable than the headline number suggests." + rampNote,
    },
    moderate: {
      headline:    "Moderate — workable but limited",
      consequence: "Reliable HD streaming and general browsing. 4K is marginal and will likely buffer. Large file downloads will take noticeably longer than on faster connections." + rampNote,
    },
    slow: {
      headline:    "Slow — below modern expectations",
      consequence: "HD video should work most of the time. 4K is not viable. File downloads and cloud syncing will feel sluggish. Multiple concurrent users will compete." + rampNote,
    },
    poor: {
      headline:    "Poor — significantly below average",
      consequence: "SD video and light browsing only. HD streaming will buffer frequently. Any file download over ~100 MB will take several minutes." + rampNote,
    },
    unusable: {
      headline:    "Unusable for most modern tasks",
      consequence: "Basic web pages will load slowly. Video streaming is not practical. This level of throughput suggests a connection issue, not just a slow plan." + rampNote,
    },
  };

  return {
    level: tier,
    css:   TIER_CSS[tier],
    ...verdicts[tier],
  };
}


function buildFindings({ sustained, peak, variance_mbps, variance_post_mbps, ramp_ms, stillRamping }) {
  const findings = [];

  const vr_post    = sustained > 0 ? variance_post_mbps / sustained : 0;
  const vr_overall = sustained > 0 ? variance_mbps      / sustained : 0;
  // Did the ramp period meaningfully inflate overall variance?
  const rampInflated = (vr_overall - vr_post) > 0.08;

  if (stillRamping) {
    findings.push({
      severity: "warn",
      headline: "Speed was still climbing at test cutoff",
      detail:   `The measured sustained rate of ${sustained.toFixed(1)} Mbps is a floor estimate — the connection had not reached a stable plateau by the time the test ended. Real capacity is likely higher. This can happen on very fast connections or when background traffic is competing during the test.`,
      tip:      "Run the test again on an otherwise idle connection. If it still ramps indefinitely, your ISP may be using burst buffering.",
    });
  }

  if (vr_post >= T.variance.variable) {
    findings.push({
      severity: "err",
      headline: "Erratic throughput",
      detail:   `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — ${(vr_post * 100).toFixed(0)}% of sustained rate. Speed is highly inconsistent: even though the average looks passable, individual bursts and troughs are wide enough to cause buffering, stalled downloads, and visible lag in video calls.`,
      tip:      "Check for competing devices or apps. High variance on a wired connection often points to ISP-side congestion, a faulty cable, or an overloaded router. Try isolating the device.",
    });
  } else if (vr_post >= T.variance.ok) {
    const rampNote = rampInflated
      ? ` Overall variance of ${variance_mbps.toFixed(1)} Mbps includes the ramp period, which overstates the issue — post-ramp figure is more representative.`
      : "";
    findings.push({
      severity: "warn",
      headline: "Noticeable throughput variance",
      detail:   `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — ${(vr_post * 100).toFixed(0)}% variance after the connection stabilised.${rampNote} This is enough to cause occasional buffering in 4K video and inconsistent download speeds.`,
      tip:      "Close background apps competing for bandwidth. If you're on Wi-Fi, interference or distance from the router is a common cause.",
    });
  } else if (vr_post >= T.variance.stable) {
    findings.push({
      severity: "ok",
      headline: "Mostly consistent throughput",
      detail:   `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — ${(vr_post * 100).toFixed(0)}% variance. Delivery is largely steady, with minor fluctuations that are unlikely to be user-visible under normal conditions.`,
      tip:      null,
    });
  } else {
    findings.push({
      severity: "ok",
      headline: "Consistent throughput",
      detail:   `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — speed held flat once the connection stabilised. Streaming and downloads will get close to the headline rate reliably.`,
      tip:      null,
    });
  }

  const varianceAlreadyFlagged = vr_post >= T.variance.variable;
  if (!stillRamping && !varianceAlreadyFlagged && peak != null && peak > 0) {
    const gap = (peak - sustained) / peak;
    if (gap >= T.peak_gap.severe) {
      findings.push({
        severity: "warn",
        headline: "Severe gap between peak and sustained speed",
        detail:   `Peak reached ${peak.toFixed(1)} Mbps but sustained rate is only ${sustained.toFixed(1)} Mbps — a ${(gap * 100).toFixed(0)}% drop. This strongly suggests traffic shaping, burst buffering, or a connection that can briefly hit high speeds but cannot hold them under load.`,
        tip:      "ISPs sometimes advertise and briefly deliver burst speeds that aren't sustained. Run the test at different times — if the gap persists, it's likely a plan or ISP policy issue.",
      });
    } else if (gap >= T.peak_gap.notable) {
      findings.push({
        severity: "warn",
        headline: "Notable gap between peak and sustained speed",
        detail:   `Peak hit ${peak.toFixed(1)} Mbps but sustained rate settled at ${sustained.toFixed(1)} Mbps — a ${(gap * 100).toFixed(0)}% difference. Short downloads and first-load bursts will feel faster than longer transfers.`,
        tip:      "Run the test at different times of day to check if this is congestion-related or a consistent pattern.",
      });
    }
  }

  if (ramp_ms != null) {
    if (ramp_ms > T.ramp.slow) {
      findings.push({
        severity: "warn",
        headline: "Very slow ramp-up",
        detail:   `Took ${(ramp_ms / 1000).toFixed(1)}s to reach 90% of measured rate. While headline throughput may look acceptable, every short download — page assets, app updates, small file transfers — starts well below that rate. The real-world feel of this connection is slower than the sustained number suggests.`,
        tip:      "Slow ramp-up on a fast link usually means bufferbloat or conservative TCP congestion control. Check your router's queue management (look for fq_codel or CAKE settings).",
      });
    } else if (ramp_ms > T.ramp.normal) {
      findings.push({
        severity: "warn",
        headline: "Slow ramp-up",
        detail:   `TCP slow-start took ${(ramp_ms / 1000).toFixed(1)}s to resolve. Small files and quick page loads will feel slower than the sustained throughput implies.`,
        tip:      "May indicate bufferbloat. Consider enabling active queue management on your router.",
      });
    } else if (ramp_ms <= T.ramp.fast) {
      findings.push({
        severity: "ok",
        headline: "Fast ramp-up",
        detail:   `Reached full speed in ${(ramp_ms / 1000).toFixed(1)}s. TCP slow-start resolved quickly — even short downloads will start at close to full capacity.`,
        tip:      null,
      });
    }
  }

  const rank = { err: 0, warn: 1, ok: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return findings;
}



export function interpretThroughput(result) {
  const sustained          = result?.sustained_mbps      ?? 0;
  const peak               = result?.peak_mbps           ?? null;
  const variance_mbps      = result?.variance_mbps       ?? 0;
  const variance_post_mbps = result?.variance_post_mbps  ?? variance_mbps;
  const ramp_ms            = result?.ramp_ms             ?? null;
  const stillRamping       = result?.still_ramping       ?? false;

  const vr = sustained > 0 ? variance_post_mbps / sustained : 0;

  return {
    verdict: {
      ...deriveVerdict(sustained, vr, stillRamping),
      usecases: scoreUsecases(sustained, vr),
    },
    findings: buildFindings({ sustained, peak, variance_mbps, variance_post_mbps, ramp_ms, stillRamping }),
  };
}