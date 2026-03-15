const T = {
  sustained: { excellent: 500, fast: 100, good: 25, moderate: 5 },
  variance:  { ok: 0.15, bad: 0.35 },  // ratio = variance_post / sustained
  ramp:      { fast: 2000, slow: 5000 },
};


function scoreUsecases(sustained, vr) {
  const grade = n => n >= 2 ? "good" : n >= 1 ? "ok" : "poor";

  return [
    {
      label:  "Browsing",
      status: grade((sustained >= 5 ? 2 : sustained >= 1 ? 1 : 0) + (vr < T.variance.bad ? 1 : 0)),
    },
    {
      label:  "HD Video",
      status: grade((sustained >= 10 ? 2 : sustained >= 5 ? 1 : 0) + (vr < T.variance.ok ? 1 : 0)),
    },
    {
      label:  "4K Video",
      status: grade((sustained >= 50 ? 2 : sustained >= 25 ? 1 : 0) + (vr < T.variance.ok ? 1 : 0)),
    },
    {
      label:  "Large Files",
      status: grade((sustained >= 100 ? 2 : sustained >= 25 ? 1 : 0) + (sustained >= 10 ? 1 : 0)),
    },
  ];
}


function deriveVerdict(sustained, vr, stillRamping) {
  const s = sustained;

  const qualifier = stillRamping
    ? " (test ended before full speed was reached)"
    : "";

  if (s >= T.sustained.excellent) {
    return {
      level: "excellent",
      headline: "Exceptional download speed",
      consequence: "No bottleneck. Downloads, 4K streaming, and large transfers will be near-instant.",
    };
  }

  if (s >= T.sustained.fast) {
    return vr < T.variance.ok
      ? { level: "fast",
          headline: "Fast and consistent",
          consequence: "4K streaming and large downloads will be smooth. Live streams will hold quality." }
      : { level: "fast",
          headline: "Fast, but variable delivery",
          consequence: "4K streaming will generally work, though speed fluctuations may cause occasional buffering." };
  }

  if (s >= T.sustained.good) {
    if (stillRamping) {
      return {
        level: "good",
        headline: "Good speed after ramp-up",
        consequence: "Large downloads will be fast once started. Short transfers may feel slower while the connection accelerates.",
      };
    }
    return vr < T.variance.ok
      ? { level: "good",
          headline: "Good, steady throughput",
          consequence: "HD video and normal downloads will be reliable. Large files will take a few minutes." }
      : { level: "good",
          headline: "Good speed, inconsistent delivery",
          consequence: "HD video will generally work, but throughput variance may cause intermittent buffering." };
  }

  if (s >= T.sustained.moderate) {
    return {
      level: "moderate",
      headline: "Moderate download speed",
      consequence: "SD and HD video should work. Large files will be slow. 4K will buffer frequently.",
    };
  }

  return {
    level: "slow",
    headline: "Slow download speed",
    consequence: "Basic browsing will work. Video streaming will struggle. Large downloads will take a long time.",
  };
}


function buildFindings({ sustained, peak, variance_mbps, variance_post_mbps, ramp_ms, stillRamping }) {
  const findings = [];

  const vr_post    = sustained > 0 ? variance_post_mbps / sustained : 0;
  const vr_overall = sustained > 0 ? variance_mbps / sustained : 0;
  const ramped      = vr_overall - vr_post > 0.10; // ramp inflated overall by >10pp

  if (stillRamping) {
    findings.push({
      severity: "warn",
      headline: "Connection was still accelerating at test cutoff",
      detail: `Speed was climbing continuously through the end of the test. The sustained figure (${sustained.toFixed(1)} Mbps) is a floor estimate — real capacity is likely higher. Run the test on a less congested connection or at a different time for a complete picture.`,
      tip: null,
    });
  }

  if (vr_post >= T.variance.bad) {
    findings.push({
      severity: "err",
      headline: "Highly variable throughput",
      detail: `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — ${(vr_post * 100).toFixed(0)}% of sustained rate. Speed is erratic, which causes buffering and stalled downloads even when average looks acceptable.`,
      tip: "Check for other devices or apps consuming bandwidth. High variance on a wired connection may indicate ISP-level congestion or an overloaded router.",
    });
  } else if (vr_post >= T.variance.ok) {
    const rampNote = ramped
      ? ` (Overall variance of ${variance_mbps.toFixed(1)} Mbps includes the ramp period and overstates the issue.)`
      : "";
    findings.push({
      severity: "warn",
      headline: "Noticeable throughput variance",
      detail: `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — ${(vr_post * 100).toFixed(0)}% variance after the connection stabilised.${rampNote}`,
      tip: "Close background apps that may be competing for bandwidth.",
    });
  } else {
    findings.push({
      severity: "ok",
      headline: "Consistent throughput",
      detail: `Post-ramp standard deviation is ${variance_post_mbps.toFixed(1)} Mbps — speed held steady once the connection ramped up.`,
      tip: null,
    });
  }

  if (!stillRamping && peak != null && peak > 0) {
    const gap = (peak - sustained) / peak;
    if (gap > 0.40) {
      findings.push({
        severity: "warn",
        headline: "Large gap between peak and sustained speed",
        detail: `Peak hit ${peak.toFixed(1)} Mbps but sustained rate is ${sustained.toFixed(1)} Mbps — a ${(gap * 100).toFixed(0)}% drop. This suggests burst buffering, traffic shaping, or a link that can't hold its peak rate.`,
        tip: "Run the test at different times of day to check if this is congestion-related or persistent.",
      });
    }
  }

  if (ramp_ms != null) {
    if (ramp_ms > T.ramp.slow) {
      findings.push({
        severity: stillRamping ? "warn" : "warn",
        headline: "Slow ramp-up",
        detail: `Took ${(ramp_ms / 1000).toFixed(1)}s to reach 90% of measured rate. Short downloads start slowly while TCP congestion window opens — noticeable on page loads and small file transfers.`,
        tip: "Slow ramp-up on a fast connection often indicates bufferbloat or aggressive TCP congestion control. Check your router's queue settings.",
      });
    } else if (ramp_ms <= T.ramp.fast) {
      findings.push({
        severity: "ok",
        headline: "Fast ramp-up",
        detail: `Reached full speed in ${(ramp_ms / 1000).toFixed(1)}s — TCP slow-start resolved quickly. Downloads begin at near-full capacity almost immediately.`,
        tip: null,
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