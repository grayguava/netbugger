/* ── connection.js ──────────────────────────────────────────
   Dashboard orchestrator. Owns: UI state, KPIs, meters,
   connection details, findings, run history, boot logic.
   Chart logic lives entirely in charts.js.
─────────────────────────────────────────────────────────── */
import { initCharts, feedCharts } from './charts/chart.js';
import { renderEdgeMap } from './map/map.js';

/* ── Utils ───────────────────────────────────────────────── */
const $     = id => document.getElementById(id);
const ms    = v  => `${(+v).toFixed(2)} ms`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct   = (v, max) => clamp((v / max) * 100, 0, 100).toFixed(1) + '%';

/* ── Clock ───────────────────────────────────────────────── */
function tick() {
  $('clock').textContent =
    new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
tick(); setInterval(tick, 1000);

/* ── Status LED ──────────────────────────────────────────── */
function setStatus(s) {
  $('led').className = 'led ' + s;
  $('led-label').textContent = { '': 'ready', ok: 'ready', running: 'running' }[s] || s;
}

/* ── Latency rating ──────────────────────────────────────── */
function latRating(avg) {
  if (avg < 30)  return { cls: 'ok',   label: 'Excellent' };
  if (avg < 80)  return { cls: 'ok',     label: 'Good'      };
  if (avg < 150) return { cls: 'warn', label: 'Moderate'  };
  return               { cls: 'err',  label: 'Poor'      };
}

/* ── Storage (archived reports) ──────────────────────────── */
function saveReport(r) {
  const id = crypto.randomUUID();
  localStorage.setItem('netreport:' + id, JSON.stringify(r));
  return id;
}
function loadReport(id) {
  const raw = localStorage.getItem('netreport:' + id);
  return raw ? JSON.parse(raw) : null;
}

/* ── Run history (session) ───────────────────────────────── */
const runHistory = [];

/* ── Chart init ──────────────────────────────────────────── */
// Called once at module load. ResizeObservers inside charts.js
// fire when divs first get real pixel dimensions — works regardless
// of connection speed or when the dashboard is revealed.
initCharts();

/* ── Render dashboard ────────────────────────────────────── */
function renderDashboard(report) {
  const r   = report.raw;
  const avg = r.latency.avg;
  const lr  = latRating(avg);


  /* KPIs */
  $('kpi-lat').textContent     = avg.toFixed(1);
  $('kpi-lat').className       = 'kpi-value ' + lr.cls;
  $('kpi-lat-sub').textContent = lr.label;

  $('kpi-jitter').textContent = r.latency.jitter.toFixed(1);
  $('kpi-jitter').className   = 'kpi-value ' + (r.latency.jitter > 20 ? 'warn' : '');

  $('kpi-tp').textContent      = r.capacity.rateMBps.toFixed(2);
  $('kpi-tp-unit').textContent = 'MB/s';

  $('kpi-cold').textContent = r.handshake.cold.toFixed(1);
  $('kpi-warm').textContent = r.handshake.warm.toFixed(1);

  /* Charts — one call, charts.js handles everything */
  feedCharts(report);

  /* Timing meters */
  $('meter-min-val').textContent  = ms(r.latency.min);
  $('meter-max-val').textContent  = ms(r.latency.max);
  $('meter-warm-val').textContent = ms(r.handshake.warm);
  $('meter-cold-val').textContent = ms(r.handshake.cold);

  /* Timing meters — absolute diagnostic scale */
function setMeter(el, value, max){
  const ratio = Math.min(value / max, 1);
  el.style.width = (ratio * 100).toFixed(1) + "%";
  el.style.setProperty("--p", ratio); // drives CSS hue color
}

/* realistic internet ceilings */
setMeter($('meter-min-fill'),  r.latency.min,      1000);
setMeter($('meter-max-fill'),  r.latency.max,      1000);
setMeter($('meter-warm-fill'), r.handshake.warm,    800);
setMeter($('meter-cold-fill'), r.handshake.cold,   2000);

  /* Connection details */
  $('det-pop').textContent     = r.info.colo;
  $('det-city').textContent    = r.info.city;
  $('det-country').textContent = r.info.country;
  $('det-isp').textContent     = r.info.isp;
  $('det-asn').textContent     = 'AS' + r.info.asn;
  $('det-http').textContent    = r.info.http;
  $('det-tls').textContent     = r.info.tls;
  $('det-ip').textContent      =
    r.info.clientIp || r.info.ip || r.info.clientIP || '—';

  $('proto-badge-http').textContent = r.info.http;
  $('proto-badge-tls').textContent  = r.info.tls;


  /* Map */
$('pop-city-label').textContent = `${r.info.city}, ${r.info.country}`;

/* reveal map UI */
const loading = $('map-loading');
const mapEl   = $('edge-map');

if (loading) loading.style.display = 'none';
if (mapEl)   mapEl.style.display   = 'block';

/* draw map only if coordinates exist */
if (
  r.info.clientLat != null &&
  r.info.clientLon != null &&
  r.info.colo
) {
  renderEdgeMap(
    [r.info.clientLat, r.info.clientLon],  // client from IP
    null,                                  // let map resolve POP
    r.info.colo,                           // label edge with POP
    r.info.colo
  );
}
  
  /* Findings */
  $('findings').innerHTML = report.messages.map(m => {
    const cls  = /error|fail|high|slow|poor/i.test(m.message) ? 'err'
               : /warn|degrad|elev/i.test(m.message)          ? 'warn' : 'ok';
    const icon = cls === 'err' ? '✗' : cls === 'warn' ? '!' : '✓';
    return `<div class="finding ${cls}">
      <span class="finding-icon text-dim">${icon}</span>
      <span>${m.message}</span>
    </div>`;
  }).join('');

  /* Classification table */
  $('classification').innerHTML = Object.entries(report.classification)
    .map(([k, v]) =>
      `<tr><td class="sk">${k}</td><td class="sv blue">${v}</td></tr>`)
    .join('');

  /* Run history table */
  runHistory.unshift({
    ts:     new Date().toISOString().slice(11, 19),
    colo:   r.info.colo,
    avg:    avg.toFixed(1),
    jitter: r.latency.jitter.toFixed(1),
    tp:     r.capacity.rateMBps.toFixed(2),
    rating: lr,
  });
  if (runHistory.length > 5) runHistory.pop();

  $('hist-body').innerHTML = runHistory.map(h => `
    <tr>
      <td>${h.ts}</td>
      <td>${h.colo}</td>
      <td>${h.avg} ms</td>
      <td>${h.jitter} ms</td>
      <td>${h.tp} MB/s</td>
      <td><span class="pill ${h.rating.cls}">${h.rating.label}</span></td>
    </tr>`).join('');

  /* Summary band */
  $('ts').textContent           =
    'Last updated: ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  $('summary-text').textContent = report.summary;
  const band = $('summary-band');
  band.className = 'card';
  if      (/good|excellent/i.test(report.summary)) band.classList.add('band-ok');
  else if (/poor|high|slow/i.test(report.summary)) band.classList.add('band-warn');
}

/* ── Error display ───────────────────────────────────────── */
function showError(msg) {
  $('summary-text').textContent = msg;
  $('summary-band').className   = 'card band-err';
  setStatus('');
  $('btn-run').disabled = false;
}

/* ── Run diagnostics ─────────────────────────────────────── */
const DIAG_MODULE = '/assets/js/pages/connection.js';

async function run() {
  $('btn-run').disabled = true;
  setStatus('running');
  $('summary-text').textContent = 'Running diagnostics…';

  let runConnectionDiagnostics;
  try {
    ({ runConnectionDiagnostics } = await import(DIAG_MODULE));
  } catch (e) {
    showError(`Cannot load diagnostics module (${DIAG_MODULE}). Check deployment.`);
    console.error('[connection] Module load failed:', e);
    return;
  }

  let report;
  try {
    report = await runConnectionDiagnostics();
  } catch (e) {
    showError('Diagnostics failed: ' + (e?.message || 'unknown error'));
    console.error('[connection] Diagnostics error:', e);
    return;
  }

  renderDashboard(report);
  setStatus('ok');
  $('btn-run').disabled = false;
  $('btn-export').classList.remove('hidden');
  window._lastReport = report;
}

$('btn-run').onclick    = run;
$('btn-export').onclick = () => {
  if (window._lastReport)
    window.open('/connection?report=' + saveReport(window._lastReport), '_blank');
};

/* ── Archived report mode (?report=id in URL) ────────────── */
const reportId = new URLSearchParams(location.search).get('report');
if (reportId) {
  const report = loadReport(reportId);
  if (report) {
    renderDashboard(report);
    setStatus('ok');
    $('btn-run').classList.add('hidden');
    $('btn-export').classList.add('hidden');
    $('summary-text').textContent = 'Archived — ' + report.summary;
  } else {
    $('summary-text').textContent = 'Report not found — storage may have expired.';
  }
}