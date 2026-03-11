import {runThroughputTest} from "../measurement/throughput/measureDownlink.js";
import {getConnectionInfo} from "../measurement/environment/getConnectionInfo.js";


export function mountThroughputApp({ interpretThroughput, echarts }) {
  const $ = id => document.getElementById(id);

  const runBtn          = $("runBtn");
  const runDot          = $("runDot");
  const runLabel        = $("runLabel");
  const heroIdle        = $("heroIdle");
  const heroRunning     = $("heroRunning");
  const heroRunningLive = $("heroRunningLive");
  const heroResult      = $("heroResult");
  const heroVerdictLabel = $("heroVerdictLabel");
  const heroSpeedMBps   = $("heroSpeedMBps");
  const heroSpeedMbps   = $("heroSpeedMbps");
  const heroHeadline    = $("heroHeadline");
  const heroConsequence = $("heroConsequence");
  const heroUsecases    = $("heroUsecases");
  const heroLimitMsg    = $("heroLimitMsg");
  const statusDot       = $("statusDot");
  const statusText      = $("statusText");
  const chartTag        = $("chartTag");
  const advancedToggle  = $("advancedToggle");
  const advancedPanel   = $("advancedPanel");
  const advancedBtn     = $("advancedBtn");
  const chartIdle       = $("chartIdle");

  const mRef = {
    sustained:    $("val-sustained"),
    peak:         $("val-peak"),
    p99:          $("val-p99"),
    average:      $("val-average"),
    variance:     $("val-variance"),
    variancePost: $("val-variance-post"),
    ramp:         $("val-ramp"),
    stillRamping: $("val-still-ramping"),
    bytes:        $("val-bytes"),
    duration:     $("val-duration"),
    streams:      $("val-streams"),
    samples:      $("val-samples"),
  };

  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let chart = null, liveSamples = [];

  function C() {
    return {
      grid:  cv("--bg-5") || "#222",
      line:  cv("--ac-3") || "#6daa55",
      warn:  cv("--warn") || "#d4a84b",
      text:  cv("--tx-5") || "#777",
      label: cv("--tx-3") || "#bbb",
    };
  }

  function initChart() {
    const el = $("speedChart");
    if (!el) return;
    if (chart) chart.dispose();
    const c = C();
    chart = echarts.init(el, null, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      animation: false,
      grid: { top: 28, right: 24, bottom: 32, left: 52 },
      xAxis: {
        type: "value", min: 0, name: "s", nameLocation: "end",
        nameTextStyle: { color: c.text, fontSize: 9, fontFamily: "monospace" },
        axisLabel: { color: c.text, fontFamily: "monospace", fontSize: 9, formatter: v => v + "s" },
        axisLine:  { lineStyle: { color: c.grid } },
        splitLine: { lineStyle: { color: c.grid, type: "dashed", opacity: .35 } },
      },
      yAxis: {
        type: "value", min: 0, name: "Mbps",
        nameTextStyle: { color: c.text, fontSize: 9, fontFamily: "monospace" },
        axisLabel: { color: c.text, fontFamily: "monospace", fontSize: 9 },
        axisLine:  { lineStyle: { color: c.grid } },
        splitLine: { lineStyle: { color: c.grid, type: "dashed", opacity: .35 } },
      },
      series: [{
        type: "line", data: [], smooth: 0.2, symbol: "none",
        lineStyle: { color: c.line, width: 2 },
        areaStyle: { color: { type: "linear", x:0,y:0,x2:0,y2:1, colorStops: [
          { offset: 0, color: "rgba(136,192,112,.18)" },
          { offset: 1, color: "rgba(136,192,112,.01)" },
        ]}},
        emphasis: { disabled: true },
      }],
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10,10,10,.92)", borderColor: c.grid,
        textStyle: { color: c.label, fontFamily: "monospace", fontSize: 11 },
        formatter: p => {
          const v = p[0].value;
          return `${v[0].toFixed(1)}s &nbsp; <b>${(v[1]/8).toFixed(2)} MB/s</b> &nbsp; ${v[1].toFixed(1)} Mbps`;
        },
      },
    });
    liveSamples = [];

    requestAnimationFrame(() => requestAnimationFrame(() => chart?.resize()));
  }

  function pushSample({ t, mbps }) {
    if (!chart) return;
    if (liveSamples.length === 0 && chartIdle) chartIdle.style.display = "none";
    liveSamples.push([t, parseFloat(mbps.toFixed(2))]);
    chart.setOption({ series: [{ data: liveSamples }] });
    if (chartTag) chartTag.textContent = `${liveSamples.length} samples`;
  }

  function annotateChart(sustained_mbps, peak_mbps) {
    if (!chart || !liveSamples.length) return;
    const c = C();
    chart.setOption({
      series: [{
        markLine: {
          silent: true, symbol: "none", animation: true, animationDuration: 600,
          data: [
            {
              yAxis: sustained_mbps,
              lineStyle: { color: c.line, type: "solid", width: 1.5, opacity: .85 },
              label: { formatter: `sustained ${sustained_mbps.toFixed(1)}`, position: "insideEndBottom",
                       color: c.line, fontFamily: "monospace", fontSize: 9, fontWeight: "bold" },
            },
            peak_mbps && {
              yAxis: peak_mbps,
              lineStyle: { color: c.warn, type: "dashed", width: 1.5, opacity: .7 },
              label: { formatter: `peak ${peak_mbps.toFixed(1)}`, position: "insideEndTop",
                       color: c.warn, fontFamily: "monospace", fontSize: 9 },
            },
          ].filter(Boolean),
        },
        markArea: {
          silent: true,
          data: [
            [{ yAxis: 0  }, { yAxis: 5,   itemStyle: { color: "rgba(200,70,70,.03)"   } }],
            [{ yAxis: 5  }, { yAxis: 25,  itemStyle: { color: "rgba(212,168,75,.03)"  } }],
            [{ yAxis: 25 }, { yAxis: 100, itemStyle: { color: "rgba(136,192,112,.02)" } }],
          ],
        },
      }],
    });
  }

  window.addEventListener("resize", () => chart?.resize());


  const fmtMs = ms => ms != null ? `${(ms/1000).toFixed(2)}s` : "—";

  function setMetric(el, mbps, MBps) {
    if (!el) return;
    if (mbps == null) {
      el.innerHTML = `<span class="mv-dash">—</span>`;
    } else {
      el.innerHTML =
        `<span class="mv-primary">${MBps.toFixed(2)}<em>MB/s</em></span>` +
        `<span class="mv-secondary">${mbps.toFixed(1)} Mbps</span>`;
    }
    const block = el.closest(".metric-block");
    if (block && mbps != null) {
      block.classList.add("updated");
      setTimeout(() => block.classList.remove("updated"), 600);
    }
  }

  function setKv(el, text, cls = "") {
    if (!el) return;
    el.textContent = text;
    el.className = "kv-val" + (cls ? " " + cls : "");
  }

  function resetAll() {
    // Metric val blocks
    Object.values(mRef).forEach(el => {
      if (!el) return;
      if (el.classList.contains("metric-val")) {
        el.innerHTML = `<span class="mv-dash">\u2014</span>`;
      } else {
        el.textContent = "\u2014";
        el.className   = "kv-val dim";
      }
    });
    // Hero result fields
    if (heroVerdictLabel)  { heroVerdictLabel.textContent = ""; heroVerdictLabel.className = "hero-verdict-label"; }
    if (heroSpeedMBps)       heroSpeedMBps.textContent  = "\u2014";
    if (heroSpeedMbps)       heroSpeedMbps.textContent   = "\u2014";
    if (heroHeadline)        heroHeadline.textContent     = "";
    if (heroConsequence)     heroConsequence.textContent  = "";
    if (heroUsecases)        heroUsecases.innerHTML       = "";
    // Chart tag
    if (chartTag) chartTag.textContent = "\u2014";
  }

  function setStatus(state, text) {
    if (statusDot)  statusDot.className    = "status-dot" + (state ? " " + state : "");
    if (statusText) statusText.textContent = text;
  }


  const LEVEL_CSS = { excellent:"great", fast:"great", good:"ok", moderate:"slow", slow:"bad" };

  function showHeroResult(result, verdict) {
    if (heroIdle)    heroIdle.hidden    = true;
    if (heroRunning) heroRunning.hidden = true;
    if (heroResult)  heroResult.hidden  = false;

    if (heroVerdictLabel) {
      heroVerdictLabel.textContent = verdict.level.toUpperCase();
      heroVerdictLabel.className   = `hero-verdict-label hero-verdict-label--${LEVEL_CSS[verdict.level] ?? "ok"}`;
    }

    if (heroSpeedMBps) heroSpeedMBps.textContent = result.sustained_MBps?.toFixed(2) ?? "—";
    if (heroSpeedMbps) heroSpeedMbps.textContent  = result.sustained_mbps?.toFixed(1) ?? "—";
    if (heroHeadline)    heroHeadline.textContent    = verdict.headline;
    if (heroConsequence) heroConsequence.textContent = verdict.consequence;

    if (heroUsecases) {
      heroUsecases.innerHTML = "";
      for (const { label, status } of verdict.usecases) {
        const chip = document.createElement("div");
        chip.className = `usecase-chip usecase-chip--${status}`;
        chip.innerHTML = `<span class="usecase-dot"></span>${label}`;
        heroUsecases.appendChild(chip);
      }
    }
  }


  function renderFindings(findings) {
    if (!findings?.length || !findingsList) return;
    findingsList.innerHTML = "";
    for (const f of findings) {
      const sev  = f.severity === "err" ? "err" : f.severity === "warn" ? "warn" : "ok";
      const card = document.createElement("div");
      card.className = `verdict-card verdict-card--${sev}`;
      card.innerHTML = `
        <div class="verdict-card-head">
          <span class="verdict-card-dot"></span>
          <span class="verdict-card-headline">${f.headline}</span>
        </div>
        <p class="verdict-card-detail">${f.detail}</p>
        ${f.tip ? `<p class="verdict-card-tip"><span class="verdict-card-tip-label">Tip</span>${f.tip}</p>` : ""}
      `;
      findingsList.appendChild(card);
    }
    if (findingsSection) findingsSection.hidden = false;
  }



  async function loadServerInfo() {
    if (!getConnectionInfo) return;
    const loading = $("serverInfoLoading");
    const content = $("serverInfoContent");
    const status  = $("serverInfoStatus");

    try {
      const info = await getConnectionInfo();
      if (info?.error) throw new Error("info unavailable");

      const set = (id, val, cls = "") => {
        const el = $(id);
        if (!el) return;
        el.textContent = val ?? "—";
        if (cls) el.classList.add(cls);
      };

      // Edge
      set("si-pop",      info.edge?.colo);
      set("si-city",     info.edge?.city);
      set("si-country",  info.edge?.country);
      set("si-provider", "Cloudflare");
      set("si-ray",      info.edge?.rayId);

      const location = [info.edge?.city, info.edge?.colo].filter(Boolean).join(" · ");
      if (status) status.textContent = location || "connected";

      if (loading) loading.hidden = true;
      if (content) content.hidden = false;

    } catch {
      if (loading) loading.textContent = "Couldn't load edge details right now";
      if (status)  status.textContent  = "—";
    }
  }

  loadServerInfo();


  if (advancedBtn) {
    advancedBtn.addEventListener("click", () => {
      const open = advancedPanel?.classList.toggle("open");
      advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }


  async function run() {
    if (runBtn)    runBtn.disabled      = true;
    if (runDot)    runDot.classList.add("pulsing");
    if (runLabel)  runLabel.textContent = "Running…";
    if (heroIdle)    heroIdle.hidden    = true;
    if (heroRunning) heroRunning.hidden = false;
    if (heroResult)  heroResult.hidden  = true;
    if (heroLimitMsg) heroLimitMsg.hidden = true;
    const fl = $("findingsList"); if (fl) fl.innerHTML = "";
    if (advancedToggle) advancedToggle.hidden = true;
    if (advancedPanel)  { advancedPanel.classList.remove("open"); }
    if (advancedBtn)    advancedBtn.setAttribute("aria-expanded", "false");
    // Reset + refetch edge info on every run
    const siLoading = $("serverInfoLoading");
    const siContent = $("serverInfoContent");
    const siStatus  = $("serverInfoStatus");
    if (siLoading) { siLoading.hidden = false; siLoading.textContent = "Fetching connection info…"; }
    if (siContent) siContent.hidden = true;
    if (siStatus)  siStatus.textContent = "—";
    loadServerInfo();
    resetAll();
    setStatus("ok", "Probing connection…");

    
    if (chartIdle) chartIdle.style.display = "";
    initChart();

    try {
      const result = await runThroughputTest({
        onSample({ t, mbps, MBps }) {
          pushSample({ t, mbps });
          const line = `${MBps.toFixed(2)} MB/s  ·  ${mbps.toFixed(1)} Mbps`;
          if (heroRunningLive) heroRunningLive.textContent = line;
          setStatus("ok", `${t.toFixed(1)}s — ${line}`);
        },
        onStatus(msg) {
          setStatus("ok", msg);
          if (heroRunningLive && msg !== "Measuring…") heroRunningLive.textContent = msg;
        },
      });

      const { verdict, findings } = interpretThroughput(result);
      showHeroResult(result, verdict);


      if (advancedToggle) advancedToggle.hidden = false;

      setMetric(mRef.sustained, result.sustained_mbps, result.sustained_MBps);
      setMetric(mRef.peak,      result.peak_mbps,      result.peak_MBps);
      setMetric(mRef.p99,       result.p99_mbps,       result.p99_MBps);
      setMetric(mRef.average,   result.average_mbps,   result.average_MBps);

      const vrPost = result.sustained_mbps > 0
        ? (result.variance_post_mbps / result.sustained_mbps * 100).toFixed(0) : null;
      const vrAll = result.sustained_mbps > 0
        ? (result.variance_mbps / result.sustained_mbps * 100).toFixed(0) : null;

      setKv(mRef.variance,
        result.variance_mbps != null
          ? `±${result.variance_mbps.toFixed(1)} Mbps  ·  ±${result.variance_MBps.toFixed(2)} MB/s${vrAll ? `  (${vrAll}%)` : ""}` : "—",
        result.variance_mbps / result.sustained_mbps > 0.35 ? "err"
          : result.variance_mbps / result.sustained_mbps > 0.15 ? "warn" : ""
      );
      setKv(mRef.variancePost,
        result.variance_post_mbps != null
          ? `±${result.variance_post_mbps.toFixed(1)} Mbps  ·  ±${result.variance_post_MBps.toFixed(2)} MB/s${vrPost ? `  (${vrPost}%)` : ""}` : "—"
      );
      setKv(mRef.ramp,
        result.ramp_ms != null ? fmtMs(result.ramp_ms) : "—",
        result.ramp_ms > 5000 ? "warn" : ""
      );
      setKv(mRef.stillRamping,
        result.still_ramping ? "Yes — speed still climbing at cutoff" : "No — plateau reached",
        result.still_ramping ? "warn" : ""
      );
      setKv(mRef.bytes,     result.bytes_total != null ? `${(result.bytes_total/1e6).toFixed(1)} MB` : "—");
      setKv(mRef.duration,  result.duration_ms != null ? fmtMs(result.duration_ms) : "—");
      setKv(mRef.streams,   result.streams?.toString() ?? "—");
      setKv(mRef.samples,   result.samples?.length?.toString() ?? "—");

      annotateChart(result.sustained_mbps, result.peak_mbps);
      renderFindings(findings);

      setStatus("ok",
        `Done · ${(result.bytes_total/1e6).toFixed(1)} MB · ${(result.duration_ms/1000).toFixed(1)}s · ${result.sustained_MBps.toFixed(2)} MB/s`
      );

    } catch (err) {
      const msg     = err.message || String(err);
      const isLimit = msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("tomorrow");

      const heroMsg  = isLimit
        ? "Due to server constraints, we can only run a limited number of tests each day. Today's capacity has been reached — please come back tomorrow."
        : "Something went wrong. Please try again in a moment.";
      const pillMsg  = isLimit
        ? "Capacity reached"
        : "Something went wrong";
      const chartMsg = isLimit
        ? "Capacity reached for today"
        : "No results to display";

      setStatus("err", pillMsg);
      if (heroRunning) heroRunning.hidden = true;
      if (heroResult)  heroResult.hidden  = true;
      if (isLimit && heroLimitMsg) {
        if (heroIdle) heroIdle.hidden = true;
        heroLimitMsg.hidden      = false;
        heroLimitMsg.textContent = heroMsg;
      } else {
        if (heroIdle) heroIdle.hidden = false;
      }
      if (chart) { chart.dispose(); chart = null; }
      if (chartIdle) { chartIdle.style.display = "flex"; chartIdle.textContent = chartMsg; }
    }

    if (runBtn)  runBtn.disabled       = false;
    if (runDot)  runDot.classList.remove("pulsing");
    if (runLabel) runLabel.textContent = "Run Again";
  }

  if (runBtn) runBtn.addEventListener("click", run);
  return { run };
}