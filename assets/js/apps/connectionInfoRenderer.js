import { getConnectionInfo } from '/assets/js/measurement/environment/getConnectionInfo.js';

const $ = id => document.getElementById(id);

const fmtCountry = c => c === 'T1' ? 'Tor Network' : c;

function safe(id, value) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('skeleton');
  el.textContent = value ?? '—';
}

function updateStatus(success, colo) {
  const msg = success ? `Connected · ${colo ?? '—'}` : 'Connection failed';

  ['status-dot',    'hero-status-dot'   ].forEach(id => {
    const el = $(id); if (!el) return;
    el.classList.remove('ok', 'err');
    el.classList.add(success ? 'ok' : 'err');
  });
  ['status-text', 'hero-status-text'].forEach(id => {
    const el = $(id); if (el) el.textContent = msg;
  });
}

function updateMap(info) {
  const mapEl = $('map');            
  if (!window.L || !mapEl) return;

  if (!mapEl._mapInstance) {
    const map = L.map('map', {
      center: [20, 0],
      zoom: 2,
      scrollWheelZoom: false,
      
      attributionControl: false
    });


    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution(
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' +
        ' · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' +
        ' · <a href="https://leafletjs.com" target="_blank" rel="noopener"> 🇺🇦 Leaflet</a>'
      )
      .addTo(map);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      { subdomains: 'abcd', maxZoom: 13 }
    ).addTo(map);

    mapEl._mapInstance   = map;
    
    setTimeout(() => {
      document.querySelectorAll('.leaflet-control-zoom a').forEach(a => {
        a.removeAttribute('href');
        a.style.cursor = 'pointer';
      });
    }, 0);
    
    mapEl._dynamicLayers = [];
  }

  const map = mapEl._mapInstance;


  mapEl._dynamicLayers.forEach(l => map.removeLayer(l));
  mapEl._dynamicLayers = [];

  const cLat = parseFloat(info.client.latitude);
  const cLon = parseFloat(info.client.longitude);
  const eLat = parseFloat(info.edge.latitude);
  const eLon = parseFloat(info.edge.longitude);

  const hasClient = !isNaN(cLat) && !isNaN(cLon);
  const hasEdge   = !isNaN(eLat) && !isNaN(eLon);


  function makeIcon(topText, bottomText, color) {
    return L.divIcon({
      className: '',
      iconAnchor: [7, 36],
      html: `
        <div style="display:flex;flex-direction:column;align-items:flex-start;filter:drop-shadow(0 2px 5px rgba(0,0,0,.7));">
          <div style="background:${color};color:#fff;font:700 10px/1.3 'Space Grotesk',system-ui,sans-serif;padding:3px 8px 2px;border-radius:3px 3px 0 0;letter-spacing:.05em;white-space:nowrap;">
            ${topText}
          </div>
          <div style="background:rgba(0,0,0,.8);color:#ccc;font:400 9px/1.3 system-ui,sans-serif;padding:2px 8px 3px;border-radius:0 0 3px 3px;white-space:nowrap;border-top:1px solid ${color}55;">
            ${bottomText}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid rgba(0,0,0,.8);margin-left:7px;"></div>
        </div>`
    });
  }

  const clientLabel = makeIcon(
    '▸ You',
    [info.client.city, info.client.region].filter(Boolean).join(', ') || info.client.ip || '—',
    '#3a8a3a'
  );
  const edgeLabel = makeIcon(
    `⬡ Cloudflare — ${info.edge.colo ?? ''}`,
    info.edge.city || 'Edge server',
    '#e8821a'
  );

  if (hasClient) {
    mapEl._dynamicLayers.push(
     L.marker([cLat, cLon], { icon: clientLabel }).addTo(map)    );
  }
  
  if (hasEdge) {
    mapEl._dynamicLayers.push(
     L.marker([eLat, eLon], { icon: edgeLabel }).addTo(map)    );
  }

  if (hasClient && hasEdge) {

    const line = L.polyline([[cLat, cLon], [eLat, eLon]], {
      color: '#00ff88',
      weight: 2,
      dashArray: '6, 6',
      opacity: 1
    }).addTo(map);

    mapEl._dynamicLayers.push(line);
    const dist = Math.sqrt(Math.pow(cLat - eLat, 2) + Math.pow(cLon - eLon, 2));
    const maxZoom = dist < 1 ? 10 : dist < 5 ? 8 : dist < 15 ? 7 : dist < 40 ? 6 : 5;
    map.fitBounds([[cLat, cLon], [eLat, eLon]], { padding: [80, 80], maxZoom });
  
  } else if (hasClient) {
    map.setView([cLat, cLon], 6);
  } else if (hasEdge) {
    map.setView([eLat, eLon], 5);
  }
}

let refreshing = false;

async function load() {
  const info = await getConnectionInfo();

  const banner    = $('error-banner');
  const torBanner = $('tor-banner');

  if (info.error) {
    updateStatus(false);
    if (banner) banner.style.display = 'flex';
    if (torBanner) torBanner.classList.remove('visible');
    return;
  }
  if (banner) banner.style.display = 'none';

  const { client: c, network: n, protocol: p, edge: e } = info;

  updateStatus(true, e.colo);

  if (torBanner) torBanner.classList.toggle('visible', c.country === 'T1');

  safe('hero-ip',       c.ip);
  safe('hero-location', [c.region, fmtCountry(c.country)].filter(Boolean).join(', '));
  safe('hf-originASOrg', n.originAsOrg);
  safe('hf-asn',         n.asn ? `AS${n.asn}` : null);
  safe('hf-tls',         p.tlsVersion);
  safe('hf-http',        p.httpVersion);
  safe('kv-colo',         e.colo);
  safe('kv-edge-city',    e.city);
  safe('kv-edge-country', e.country);
  safe('kv-ray',          e.rayId);


  safe('hdr-ip',  c.ip);
  safe('hdr-ray', e.rayId);
  safe('cl-ip',        c.ip);
  safe('cl-city',      c.city);
  safe('cl-region',    c.region);
  safe('cl-country',   fmtCountry(c.country));
  safe('cl-continent', c.continent);
  safe('cl-timezone',  c.timezone);
  safe('net-originASOrg',  n.originAsOrg);
  safe('net-asn',          n.asn ? `AS${n.asn}` : null);
  if (n.asn) {
    const asnEl = document.getElementById('net-asn');
    if (asnEl) {
       asnEl.href = `https://bgp.tools/as/${n.asn}`;
      // safe() cleared innerHTML to textContent — restore the arrow SVG
      asnEl.innerHTML = `AS${n.asn}<svg class="asn-arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="8" y2="2"/><polyline points="4,2 8,2 8,6"/></svg>`;
    }
  }
  safe('proto-tls-badge',  p.tlsVersion);
  safe('proto-http-badge', p.httpVersion);
  safe('edge-colo',         e.colo);
  safe('edge-city',         e.city);
  safe('edge-country',      e.country);
  safe('edge-country-code', e.countryCode);
  safe('edge-ray',          e.rayId);


  safe('path-client-city', c.city);
  safe('path-client-loc',  [c.region, fmtCountry(c.country)].filter(Boolean).join(', '));
  safe('path-client-ip',   c.ip);
  safe('path-pop',         e.colo);
  safe('path-edge-city',   e.city);
  safe('path-ray',         e.rayId);

  updateMap(info);
}

document.addEventListener('DOMContentLoaded', () => {
  load();

  const btn = $('refreshBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (refreshing) return;
    refreshing = true;

    btn.classList.add('spinning');
    btn.disabled = true;

    await load();

    btn.classList.remove('spinning');
    btn.disabled = false;
    refreshing = false;
  });
});