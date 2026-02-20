/* ── charts.js ──────────────────────────────────────────────
   Self-contained ECharts module for the Net Diagnostics dashboard.
   Owns all chart state. Exports three functions:

     initCharts()        — call once when dashboard is first revealed.
                           Sets up ResizeObservers on every chart div.
                           Safe to call even if divs have zero size yet —
                           the observers fire as soon as they get real px.

     feedCharts(report)  — call after each diagnostic run.
                           Extracts all relevant samples from the report
                           and updates every chart.

     resizeCharts()      — call if the layout changes externally
                           (e.g. panel open/close). Usually not needed.

   Depends on: window.echarts (ECharts loaded via <script> tag)
   No other external dependencies.
─────────────────────────────────────────────────────────── */

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  blue:   '#4d8ef0',
  amber:  '#e09a3a',
  green:  '#3dba7e',
  purple: '#b06ef0',
  grid:   '#1e2028',
  label:  '#3d4251',
};

/* ── State ───────────────────────────────────────────────── */
const instances = {};   // id → echarts instance
const data      = {};   // id → number[]
const MAX_PTS   = 120;  // rolling window size

const SPARKS = [
  { id: 'spark-lat',    color: C.blue   },
  { id: 'spark-jitter', color: C.amber  },
  { id: 'spark-tp',     color: C.green  },
  { id: 'spark-cold',   color: C.purple },
];

const FULLS = [
  { id: 'chart-latency', color: C.blue,  unit: 'ms'   },
  { id: 'chart-tp',      color: C.green, unit: 'MB/s' },
];

const ALL_CHARTS = [...SPARKS, ...FULLS];

/* ── Option builders ─────────────────────────────────────── */
function sparkOption(color, pts) {
  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 200,
    grid: { top: 2, right: 2, bottom: 2, left: 2 },
    xAxis: {
      type: 'category',
      show: false,
      boundaryGap: false,
      data: pts.map((_, i) => i),
    },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      data: pts,
      smooth: 0.4,
      symbol: 'none',
      lineStyle: { color, width: 1.5 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '2e' },
            { offset: 1, color: color + '04' },
          ],
        },
      },
    }],
  };
}

function fullOption(color, pts, unit) {
  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 200,
    grid: { top: 12, right: 16, bottom: 30, left: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#18191d',
      borderColor: '#272930',
      borderWidth: 1,
      textStyle: { color: '#b8bcc8', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 },
      formatter: p => `${(+(p[0]?.value ?? 0)).toFixed(2)} ${unit}`,
      axisPointer: { lineStyle: { color: '#33363f', type: 'dashed' } },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: pts.map((_, i) => i),
      axisLine: { lineStyle: { color: C.grid } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        fontFamily: 'JetBrains Mono,monospace',
        fontSize: 9,
        color: C.label,
        // Only label first and last tick
        formatter: (_, i) => {
          if (pts.length < 2) return '';
          if (i === 0) return 'oldest';
          if (i === pts.length - 1) return 'now';
          return '';
        },
      },
    },
    yAxis: {
      type: 'value',
      scale: false,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontFamily: 'JetBrains Mono,monospace',
        fontSize: 9,
        color: C.label,
      },
      splitLine: { lineStyle: { color: C.grid, width: 1 } },
    },
    series: [{
      type: 'line',
      data: pts,
      smooth: 0.35,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,   // dots appear on hover only
      lineStyle: { color, width: 1.5 },
      itemStyle: { color },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '26' },
            { offset: 1, color: color + '03' },
          ],
        },
      },
    }],
  };
}

/* ── Internal helpers ────────────────────────────────────── */
function isSpark(id) {
  return SPARKS.some(s => s.id === id);
}

function buildOption(cfg) {
  const pts = data[cfg.id] || [];
  return isSpark(cfg.id)
    ? sparkOption(cfg.color, pts)
    : fullOption(cfg.color, pts, cfg.unit);
}

function applyOption(id) {
  const inst = instances[id];
  if (!inst) return;
  const cfg = ALL_CHARTS.find(c => c.id === id);
  if (cfg) inst.setOption(buildOption(cfg), { notMerge: false });
}

function push(id, values) {
  const arr = Array.isArray(values) ? values : [values];
  if (!data[id]) data[id] = [];
  arr.forEach(v => {
    if (v == null || isNaN(v)) return;
    data[id].push(+v);
  });
  if (data[id].length > MAX_PTS) {
    data[id] = data[id].slice(-MAX_PTS);
  }
}

/* ── Exported API ────────────────────────────────────────── */

/**
 * initCharts()
 * Sets up a ResizeObserver on every chart div.
 * ECharts is initialized the moment a div first gets real pixel dimensions.
 * Safe to call before or after the dashboard is revealed.
 */
export function initCharts() {
  const ec = window.echarts;
  if (!ec) {
    console.error('[charts] ECharts not found. Add <script src="/assets/js/echarts.min.js"> before app.js.');
    return;
  }

  ALL_CHARTS.forEach(cfg => {
    const el = document.getElementById(cfg.id);
    if (!el) {
      console.warn(`[charts] Element #${cfg.id} not found in DOM.`);
      return;
    }

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;  // not visible yet

      if (!instances[cfg.id]) {
        // First real paint — initialize
        instances[cfg.id] = ec.init(el, null, { renderer: 'canvas' });
        // Apply any data that arrived before the chart was ready
        applyOption(cfg.id);
      } else {
        instances[cfg.id].resize();
      }
    });

    ro.observe(el);
  });
}

/**
 * feedCharts(report)
 * Extracts samples from the diagnostic report and updates all charts.
 * Can be called before initCharts() — data is stored and applied at init time.
 */
export function feedCharts(report) {
  const r = report.raw;

  // ── Latency ─────────────────────────────────────────────
  // Prefer raw sample arrays over the single average.
  // Log all keys on first call so the correct field name can be confirmed.
  if (!feedCharts._logged) {
    console.log('[charts] report.raw.latency:', r.latency);
    feedCharts._logged = true;
  }

  const latPts =
    r.latency.samples?.length   ? r.latency.samples   :
    r.latency.all?.length       ? r.latency.all        :
    r.latency.measurements?.length ? r.latency.measurements :
    r.latency.timings?.length   ? r.latency.timings    :
    r.latency.values?.length    ? r.latency.values     :
    [r.latency.avg];

  const jitterPts =
    r.latency.jitterSamples?.length ? r.latency.jitterSamples :
    [r.latency.jitter];

  // ── Push to rolling arrays ───────────────────────────────
  push('spark-lat',     latPts);
  push('spark-jitter',  jitterPts);
  push('spark-tp',      r.capacity.rateMBps);
  push('spark-cold',    r.handshake.cold);
  push('chart-latency', latPts);
  push('chart-tp',      r.capacity.rateMBps);

  // ── Refresh all initialized charts ──────────────────────
  ALL_CHARTS.forEach(cfg => applyOption(cfg.id));
}

/**
 * resizeCharts()
 * Force-resize all initialized charts.
 * Call this if an external layout change happens that the ResizeObserver
 * might not catch (rare).
 */
export function resizeCharts() {
  Object.values(instances).forEach(inst => {
    try { inst.resize(); } catch (_) {}
  });
}