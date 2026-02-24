import { getConnectionInfo } from '/assets/js/measurement/environment/getConnectionInfo.js';

const $ = id => document.getElementById(id);

/* ── Map State ───────────────────────────────────────────── */

let mapInstance = null;
let clientMarker = null;
let edgeMarker = null;
let routeLine = null;

/* ── Field Setter ────────────────────────────────────────── */

function fill(id, val, cls) {
  const el = $(id);
  if (!el) return;
  el.textContent = val ?? '—';
  el.classList.remove('skeleton');
  if (cls) el.classList.add(cls);
}

/* ── Map Initialization (RUN ONCE) ───────────────────────── */

function initMap() {
  if (!window.L || mapInstance) return;

  mapInstance = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true
  });

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18
    }
  ).addTo(mapInstance);
}

/* ── Map Update (SAFE REFRESH) ───────────────────────────── */

function updateMap(info) {
  if (!mapInstance) return;

  const cLat = parseFloat(info.clientLat);
  const cLon = parseFloat(info.clientLon);
  const eLat = parseFloat(info.edgeLat);
  const eLon = parseFloat(info.edgeLon);

  const hasC = !isNaN(cLat) && !isNaN(cLon);
  const hasE = !isNaN(eLat) && !isNaN(eLon);

  function dot(color, borderColor) {
    return L.divIcon({
      className: '',
      html: `<div style="width:11px;height:11px;border-radius:50%;background:${color};border:2px solid ${borderColor};box-shadow:0 0 0 3px ${color}33;"></div>`,
      iconSize: [11, 11],
      iconAnchor: [5, 5]
    });
  }

  /* Client marker */
  if (hasC) {
    if (!clientMarker) {
      clientMarker = L.marker([cLat, cLon], { icon: dot('#6aaa5a', '#fff') }).addTo(mapInstance);
    } else {
      clientMarker.setLatLng([cLat, cLon]);
    }
  }

  /* Edge marker */
  if (hasE) {
    if (!edgeMarker) {
      edgeMarker = L.marker([eLat, eLon], { icon: dot('#3a8a6a', '#fff') }).addTo(mapInstance);
    } else {
      edgeMarker.setLatLng([eLat, eLon]);
    }
  }

  /* Dashed route line between client and edge */
  if (hasC && hasE) {
    if (routeLine) {
      mapInstance.removeLayer(routeLine);
    }
    routeLine = L.polyline([[cLat, cLon], [eLat, eLon]], {
      color: '#6aaa5a',
      weight: 1.5,
      opacity: 0.5,
      dashArray: '5, 7',
      lineJoin: 'round'
    }).addTo(mapInstance);

    mapInstance.fitBounds([[cLat, cLon], [eLat, eLon]], {
      padding: [48, 48],
      maxZoom: 7
    });
  } else if (hasC) {
    mapInstance.setView([cLat, cLon], 6);
  }

  /* Location overlay card */
  const overlay = $('map-overlay');
  if (overlay && hasC) {
    const city    = info.clientCity    ?? '—';
    const country = info.clientCountry ?? '—';
    const ip      = info.clientIp      ?? '—';
    const colo    = info.colo          ?? '—';
    const edgeCity = info.edgeCity     ?? '—';

    overlay.innerHTML = `
      <strong>${city}, ${country}</strong>
      ${ip}<br>
      Edge <span class="edge-tag">${colo}</span> · ${edgeCity}
    `;
    overlay.style.display = 'block';
  }
}

/* ── Render ───────────────────────────────────────────────── */

function render(info) {
  const dot = $('hero-status-dot');

  if (info.error) {
    if (dot) { dot.classList.remove('ok'); dot.classList.add('err'); }
    $('hero-status-text').textContent = 'Error fetching data';
    fill('hero-location', '');
    return;
  }

  if (dot) dot.classList.add('ok');
  $('hero-status-text').textContent = `Connected · ${info.colo ?? '—'}`;

  fill('hero-ip', info.clientIp);

  // Region + Country beneath IP
  const parts = [info.clientRegion, info.clientCountry].filter(v => v != null && v !== '');
  fill('hero-location', parts.length ? parts.join(', ') : '—');

  fill('hf-isp',  info.isp);
  fill('hf-asn',  info.asn ? 'AS' + info.asn : null);
  fill('hf-tls',  info.tls);
  fill('hf-http', info.http);

  // Edge details card — IDs match index.html
  fill('kv-colo',         info.colo);
  fill('kv-edge-city',    info.edgeCity);
  fill('kv-edge-country', info.edgeCountry);
  fill('kv-ray',          info.rayId);

  updateMap(info);
}

/* ── Load + Render (Reusable) ───────────────────────────── */

async function loadAndRender() {
  try {
    const info = await getConnectionInfo('/api/info');
    render(info);
  } catch (e) {
    console.error(e);
    render({ error: true });
  }
}

/* ── Boot Once ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadAndRender();

  const refreshBtn = $('refreshBtn');
  if (refreshBtn) {
    let refreshing = false;
    refreshBtn.addEventListener('click', async () => {
      if (refreshing) return;
      refreshing = true;
      refreshBtn.classList.add('spinning');
      await loadAndRender();
      refreshBtn.classList.remove('spinning');
      refreshing = false;
    });
  }
});