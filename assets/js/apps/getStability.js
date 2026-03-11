import { getConnectionInfo } from "../measurement/environment/getConnectionInfo.js";
import { measureHandshake }  from "../measurement/rtt/handshake.js";
import { measureRTT }        from "../measurement/rtt/stability.js";
import { interpret }         from "../measurement/shared/interpret.js";


export async function runHealthTest({
  stabilityInterval = 100,
  onLatencySample
} = {}) {

  const result = {
    info:      null,
    handshake: null,
    latency:   null,
    timestamp: Date.now()
  };

  result.info      = await getConnectionInfo();
  result.handshake = await measureHandshake();
  result.latency   = await measureRTT({
    intervalMs: stabilityInterval,
    onSample:   onLatencySample
  });

  return result;
}


export function init() {
  const runBtn   = document.getElementById("runBtn");
  const runDot   = document.getElementById("runDot");
  const runLabel = document.getElementById("runLabel");

  const refs = {
    median:   document.getElementById("val-median"),
    p90:      document.getElementById("val-p90"),
    min:      document.getElementById("val-min"),
    max:      document.getElementById("val-max"),
    jitter:   document.getElementById("val-jitter"),
    samples:  document.getElementById("val-samples"),
    cold:     document.getElementById("val-cold"),
    warm:     document.getElementById("val-warm"),
    delta:    document.getElementById("val-delta"),
    metaCold: document.getElementById("meta-cold"),
    metaWarm: document.getElementById("meta-warm"),
  };

  const liveIdle   = document.getElementById("liveIdle");
  const distIdle   = document.getElementById("distIdle");
  const liveTag    = document.getElementById("liveTag");
  const distTag    = document.getElementById("distTag");
  const statusDot  = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const verdictEl      = document.getElementById("verdict");
  const advancedToggle = document.getElementById("advancedToggle");
  const advancedPanel  = document.getElementById("advancedPanel");
  const advancedBtn    = document.getElementById("advancedBtn");

  let lastVerdict = null;


  const heroIdle        = document.getElementById("heroIdle");
  const heroRunning     = document.getElementById("heroRunning");
  const heroResult      = document.getElementById("heroResult");
  const heroRunSub      = document.getElementById("heroRunSub");
  const heroVerdictLabel = document.getElementById("heroVerdictLabel");
  const heroHeadline    = document.getElementById("heroHeadline");
  const heroConsequence = document.getElementById("heroConsequence");
  const heroUsecases    = document.getElementById("heroUsecases");

  function showHeroIdle() {
    heroIdle.hidden    = false;
    heroRunning.hidden = true;
    heroResult.hidden  = true;
  }

  function showHeroRunning(sub = "Collecting samples") {
    heroIdle.hidden    = true;
    heroRunning.hidden = false;
    heroResult.hidden  = true;
    if (heroRunSub) heroRunSub.textContent = sub;
  }

  const LEVEL_LABELS = {
    great:    "All good",
    ok:       "Looks good",
    slow:     "High latency",
    unstable: "Unstable",
    bad:      "Problems found",
  };

  function showHeroResult(verdict) {
    heroIdle.hidden    = true;
    heroRunning.hidden = true;
    heroResult.hidden  = false;

    heroVerdictLabel.textContent = LEVEL_LABELS[verdict.level] ?? verdict.level;
    heroVerdictLabel.className   = `hero-verdict-label hero-verdict-label--${verdict.level}`;
    heroHeadline.textContent     = verdict.headline;
    heroConsequence.textContent  = verdict.consequence;


    if (heroUsecases) {
      heroUsecases.innerHTML = verdict.usecases.map(u => `
        <div class="usecase-chip usecase-chip--${u.status}">
          <span class="usecase-dot"></span>
          <span class="usecase-label">${u.label}</span>
        </div>
      `).join("");
    }
  }


  let liveChart   = null;
  let distChart   = null;
  let liveSamples = [];

  const liveEl = document.getElementById("liveChart");
  const distEl = document.getElementById("distChart");


  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = {
    bg:    "transparent",
    grid:  css("--bg-5")  || "#222",
    line:  css("--ac-2")  || "#88c070",
    area:  css("--ac-7")  || "rgba(136,192,112,.08)",
    bar:   css("--ac-3")  || "#6daa55",
    med:   css("--ac-4")  || "#88c070",
    p90c:  css("--warn")  || "#d4a84b",
    muted: css("--bg-7")  || "#444",
    text:  css("--tx-5")  || "#777",
    label: css("--tx-3")  || "#bbb",
  };


  const fmtMs  = v => v != null ? v.toFixed(1) + " ms" : "—";
  const fmtPct = v => v != null ? (v * 100).toFixed(1) + "%" : "—";


  function setVal(el, text, cls = "") {
    el.textContent = text;
    el.className   = "metric-val" + (cls ? " " + cls : "");
    const card = el.closest(".metric-block");
    if (card && text !== "—") {
      card.classList.add("updated");
      setTimeout(() => card.classList.remove("updated"), 600);
    }
  }

  function setHandshakeVal(el, text, cls = "") {
    el.textContent = text;
    el.className   = "hs-val" + (cls ? " " + cls : "");
  }

  function resetVals() {
    ["median","p90","samples","min","max","jitter"].forEach(k => setVal(refs[k], "—", "dim"));
    setHandshakeVal(refs.cold, "—", "dim");
    setHandshakeVal(refs.warm, "—", "dim");
    refs.delta.textContent    = "—";
    refs.metaCold.textContent = "First probe — includes DNS + TCP + TLS";
    refs.metaWarm.textContent = "After 6 warm-up probes";
  }

  function setStatus(state, text) {
    statusDot.className    = "status-dot" + (state ? " " + state : "");
    statusText.textContent = text;
  }


  showHeroIdle();


  if (advancedBtn) {
    advancedBtn.addEventListener("click", () => {
      const open = advancedPanel?.classList.toggle("open");
      advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }


  function renderVerdict(result) {
    if (!verdictEl) return;

    const { verdict, findings } = lastVerdict;

    showHeroResult(verdict);


    const listEl = document.getElementById("verdictList");
    if (!listEl) return;
    listEl.innerHTML = "";

    for (const f of findings) {
      const card = document.createElement("div");
      card.className = `verdict-card verdict-card--${f.severity}`;
      card.innerHTML = `
        <div class="verdict-card-head">
          <span class="verdict-card-dot"></span>
          <span class="verdict-card-headline">${f.headline}</span>
        </div>
        <p class="verdict-card-detail">${f.detail}</p>
        ${f.tip ? `<p class="verdict-card-tip"><span class="verdict-card-tip-label">Tip</span>${f.tip}</p>` : ""}
      `;
      listEl.appendChild(card);
    }

  }

  function resetVerdict() {
    if (!verdictEl) return;
    const listEl = document.getElementById("verdictList");
    if (listEl) listEl.innerHTML = "";
  }


  function initLiveChart() {
    if (liveChart) liveChart.dispose();
    liveChart = echarts.init(liveEl, null, { renderer: "canvas" });
    liveChart.setOption({
      backgroundColor: C.bg,
      animation: false,
      grid: { top: 24, right: 24, bottom: 32, left: 52 },
      xAxis: {
        type: "value", min: 0,
        axisLabel: { color: C.text, fontFamily: "monospace", fontSize: 9, formatter: v => v + "s" },
        axisLine:  { lineStyle: { color: C.grid } },
        splitLine: { lineStyle: { color: C.grid, type: "dashed", opacity: .4 } }
      },
      yAxis: {
        type: "value",
        name: "ms", nameTextStyle: { color: C.text, fontSize: 9, fontFamily: "monospace" },
        axisLabel: { color: C.text, fontFamily: "monospace", fontSize: 9, formatter: v => v + "ms" },
        axisLine:  { lineStyle: { color: C.grid } },
        splitLine: { lineStyle: { color: C.grid, type: "dashed", opacity: .35 } }
      },
      series: [{
        type: "line", data: [], smooth: 0.25, symbol: "none",
        lineStyle: { color: C.line, width: 1.5 },
        areaStyle: { color: C.area },
        emphasis: { disabled: true }
      }],
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10,10,10,.9)", borderColor: C.grid,
        textStyle: { color: C.label, fontFamily: "monospace", fontSize: 11 },
        formatter: p => `${p[0].value[0].toFixed(2)}s &nbsp; <b>${p[0].value[1].toFixed(1)} ms</b>`
      }
    });
  }

  function pushLiveSample(ms, tSec) {
    if (!liveChart) return;
    liveSamples.push([tSec, parseFloat(ms.toFixed(2))]);
    liveChart.setOption({ series: [{ data: liveSamples }] });
    liveTag.textContent = `${liveSamples.length} samples`;
  }



  function annotateLiveChart(median, p90) {
    if (!liveChart || !liveSamples.length) return;

    const vals   = liveSamples.map(s => s[1]);
    const minIdx = vals.indexOf(Math.min(...vals));
    const maxIdx = vals.indexOf(Math.max(...vals));

    liveChart.setOption({
      series: [{
        markLine: {
          silent: true,
          symbol: "none",
          animation: true,
          animationDuration: 600,
          data: [
            median != null && {
              yAxis: median,
              lineStyle: { color: C.med, type: "solid", width: 1.5, opacity: 0.85 },
              label: {
                formatter: `med ${median.toFixed(1)}ms`,
                position: "insideEndBottom",
                color: C.med, fontFamily: "monospace", fontSize: 9, fontWeight: "bold"
              }
            },
            p90 != null && {
              yAxis: p90,
              lineStyle: { color: C.p90c, type: "dashed", width: 1.5, opacity: 0.75 },
              label: {
                formatter: `p90 ${p90.toFixed(1)}ms`,
                position: "insideEndTop",
                color: C.p90c, fontFamily: "monospace", fontSize: 9, fontWeight: "bold"
              }
            }
          ].filter(Boolean)
        },
        markPoint: {
          symbol: "circle",
          symbolSize: 5,
          animation: true,
          animationDuration: 400,
          label: { show: false },
          data: [
            {
              coord: liveSamples[maxIdx],
              itemStyle: { color: C.p90c, opacity: 0.8 },
              label: {
                show: true,
                formatter: () => vals[maxIdx].toFixed(0) + "ms",
                color: C.p90c, fontFamily: "monospace", fontSize: 9, offset: [0, -12]
              }
            },
            {
              coord: liveSamples[minIdx],
              itemStyle: { color: C.med, opacity: 0.8 },
              label: {
                show: true,
                formatter: () => vals[minIdx].toFixed(0) + "ms",
                color: C.med, fontFamily: "monospace", fontSize: 9, offset: [0, 12]
              }
            }
          ]
        }
      }]
    });
  }




  function renderJitterChart(jitterMean) {
    if (!liveSamples || liveSamples.length < 2) return;

    if (distChart) distChart.dispose();
    distChart = echarts.init(distEl, null, { renderer: "canvas" });

    const jitterData = [];
    for (let i = 1; i < liveSamples.length; i++) {
      const delta = Math.abs(liveSamples[i][1] - liveSamples[i - 1][1]);
      jitterData.push([liveSamples[i][0], parseFloat(delta.toFixed(2))]);
    }

    const meanJ = jitterMean ?? (jitterData.reduce((s, d) => s + d[1], 0) / jitterData.length);

    distChart.setOption({
      backgroundColor: C.bg,
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      grid: { top: 24, right: 24, bottom: 32, left: 52 },
      xAxis: {
        type: "value", min: 0,
        axisLabel: { color: C.text, fontFamily: "monospace", fontSize: 9, formatter: v => v + "s" },
        axisLine:  { lineStyle: { color: C.grid } },
        splitLine: { lineStyle: { color: C.grid, type: "dashed", opacity: .35 } }
      },
      yAxis: {
        type: "value", min: 0,
        name: "Δms", nameTextStyle: { color: C.text, fontSize: 9, fontFamily: "monospace" },
        axisLabel: { color: C.text, fontFamily: "monospace", fontSize: 9, formatter: v => v + "ms" },
        axisLine:  { lineStyle: { color: C.grid } },
        splitLine: { lineStyle: { color: C.grid, type: "dashed", opacity: .35 } }
      },
      series: [{
        type: "bar",
        data: jitterData,
        barMaxWidth: 8,
        itemStyle: {
          color: params => {

            return params.value[1] > meanJ * 3 ? C.p90c : C.muted;
          },
          borderRadius: [2, 2, 0, 0]
        },
        emphasis: { itemStyle: { opacity: 0.75 } },
        markLine: {
          silent: true,
          symbol: "none",
          data: [{
            yAxis: meanJ,
            lineStyle: { color: C.med, type: "dashed", width: 1, opacity: 0.65 },
            label: {
              formatter: `avg ${meanJ.toFixed(1)}ms`,
              position: "insideEndTop",
              color: C.med, fontFamily: "monospace", fontSize: 9
            }
          }]
        }
      }],
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10,10,10,.9)", borderColor: C.grid,
        textStyle: { color: C.label, fontFamily: "monospace", fontSize: 11 },
        formatter: p => `${p[0].value[0].toFixed(2)}s &nbsp; Δ<b>${p[0].value[1].toFixed(1)} ms</b>`
      }
    });

    distIdle.style.display = "none";
    distTag.textContent    = `${jitterData.length} deltas`;
  }


  window.addEventListener("resize", () => { liveChart?.resize(); distChart?.resize(); });


  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    runDot.classList.add("pulsing");
    runLabel.textContent = "Running…";

    liveSamples = [];
    lastVerdict = null;
    resetVals();
    resetVerdict();
    if (advancedToggle) advancedToggle.hidden = true;
    if (advancedPanel)  advancedPanel.classList.remove("open");
    if (advancedBtn)    advancedBtn.setAttribute("aria-expanded", "false");
    showHeroRunning("Collecting samples");
    liveIdle.style.display = "none";
    liveTag.textContent    = "0 samples";
    distTag.textContent    = "pending";
    distIdle.style.display = "flex";
    distIdle.textContent   = "Collecting samples…";
    if (distChart) { distChart.dispose(); distChart = null; }

    setStatus("ok", "Measuring…");
    initLiveChart();

    const testStart = performance.now();

    try {
      const result = await runHealthTest({
        stabilityInterval: 100,
        onLatencySample: ({ latency }) => {
          const tSec = parseFloat(((performance.now() - testStart) / 1000).toFixed(3));
          pushLiveSample(latency, tSec);
          if (heroRunSub) heroRunSub.textContent = `${liveSamples.length} samples collected`;
        }
      });

      const { handshake, latency } = result;

      // Latency stats
      setVal(refs.median, fmtMs(latency?.median));
      setVal(refs.p90,    fmtMs(latency?.p90),  latency?.p90 > 200 ? "warn" : "");
      setVal(refs.min,    fmtMs(latency?.min));
      setVal(refs.max,    fmtMs(latency?.max));
      setVal(refs.jitter, fmtMs(latency?.jitter_std));
      setVal(refs.samples,
        latency?.samples != null ? `${latency.samples} / ${latency.attempts}` : "—"
      );


      const cold = handshake?.cold ?? null;
      const warm = handshake?.warm ?? null;

      setHandshakeVal(refs.cold, fmtMs(cold), cold == null ? "dim" : "");
      setHandshakeVal(refs.warm, fmtMs(warm), warm == null ? "dim" : "");
      refs.metaCold.textContent = handshake?.coldSuccess === false
        ? "Probe failed" : "First probe — includes DNS + TCP + TLS";
      refs.metaWarm.textContent = handshake?.warmSuccess === false
        ? "Probe failed" : "After 6 warm-up probes";

      if (cold != null && warm != null) {
        const delta = cold - warm;
        refs.delta.textContent = (delta >= 0 ? "+" : "") + delta.toFixed(1) + " ms";
      }


      annotateLiveChart(latency?.median, latency?.p90);
      if (liveSamples.length >= 2) renderJitterChart(latency?.jitter_std);


      const { verdict, findings } = interpret(result);
      lastVerdict = { verdict, findings };
      renderVerdict(result);
      if (advancedToggle) advancedToggle.hidden = false;

      setStatus("ok",
        `Done · ${latency?.samples ?? 0} / ${latency?.attempts ?? 0} samples · ${(latency?.durationMs / 1000).toFixed(1)}s`
      );

    } catch (err) {
      showHeroIdle();
      setStatus("err", "Test failed: " + (err.message || err));

      if (liveChart) { liveChart.dispose(); liveChart = null; }
      liveIdle.style.display = "flex";
      liveIdle.textContent   = "Test failed — " + (err.message || err);
    }

    runBtn.disabled = false;
    runDot.classList.remove("pulsing");
    runLabel.textContent = "Run Again";
  });

}