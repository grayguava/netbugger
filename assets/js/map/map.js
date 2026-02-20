import { resolveColo } from "./geo.js";

/* wait until container actually has pixels */
function waitForSize(el) {
  return new Promise(resolve => {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      resolve();
      return;
    }

    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      if (r.width > 0 && r.height > 0) {
        ro.disconnect();
        resolve();
      }
    });

    ro.observe(el);
  });
}

let mapInstance = null;

export async function renderEdgeMap(client, edge, label, colo) {

  const container = document.getElementById("edge-map");
  if (!container) return;

  /* destroy old map on rerun */
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  /* resolve edge location if unknown */
  if (!edge || edge[0] == null || edge[1] == null) {
    edge = await resolveColo(colo);
    if (!edge) return;
  }

  await waitForSize(container);

  /* create map */
  mapInstance = L.map(container, {
    zoomControl: true,
    minZoom: 2,
    maxZoom: 20,
    worldCopyJump: true
  });

  /* load tiles */
  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 10,
      minZoom: 3,
      attribution: "&copy; OpenStreetMap contributors",
      crossOrigin: true
    }
  ).addTo(mapInstance);

/* connection line */
const line = L.polyline([client, edge], {
  color: "#64748b",        // softer slate tone
  weight: 2.5,             // less chunky
  opacity: 0.9,
  dashArray: "6 4"         // subtle professional path styling
}).addTo(mapInstance);

/* fit FIRST (no animation) */
mapInstance.fitBounds(line.getBounds(), {
  padding: [50, 50],       // slightly more breathing room
  animate: false
});

/* origin dot */
const originDot = L.circleMarker(client, {
  radius: 7,
  color: "#1e40af",        // darker border
  weight: 2,
  fillColor: "#3b82f6",
  fillOpacity: 0.95
}).addTo(mapInstance);

/* edge dot */
const edgeDot = L.circleMarker(edge, {
  radius: 7,
  color: "#9a3412",        // darker burnt border
  weight: 2,
  fillColor: "#f97316",
  fillOpacity: 0.95
}).addTo(mapInstance);

/* stable DOM labels (no flicker) */
L.marker(client, {
  interactive: false,
  icon: L.divIcon({
    className: "map-label",
    html: "Origin (You)",
    iconSize: null,        // let CSS control width
    iconAnchor: [0, 30]    // left-aligned label above point
  })
}).addTo(mapInstance);

L.marker(edge, {
  interactive: false,
  icon: L.divIcon({
    className: "map-label",
    html: "Cloudflare Edge — " + colo,
    iconSize: null,        // remove hard constraint
    iconAnchor: [0, 30]
  })
}).addTo(mapInstance);
}