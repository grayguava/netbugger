/* ── geo.js ────────────────────────────────────────────────
   POP → coordinates resolver with permanent cache
   Runs ONLY after diagnostics (safe for measurements)
──────────────────────────────────────────────────────────── */

const KEY = "netdiag:coloCache";

/* load cache */
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

/* save cache */
function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

/* main resolver */
export async function resolveColo(colo) {
  if (!colo) return null;

  const db = load();

  /* cached */
  if (db[colo]) return db[colo];

  /* show resolving state */
  const label = document.getElementById("pop-city-label");
  if (label) label.textContent = `Resolving ${colo}…`;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(colo + " airport")}` +
      `&format=json&limit=1`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    const json = await res.json();
    if (!json || !json.length) return null;

    const coord = [
      parseFloat(json[0].lat),
      parseFloat(json[0].lon)
    ];

    db[colo] = coord;
    save(db);

    return coord;

  } catch (e) {
    console.warn("geo resolve failed:", colo, e);
    return null;
  }
}