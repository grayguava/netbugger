import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CF_ENDPOINT     = "https://speed.cloudflare.com/locations"
COORD_PRECISION = 6
LOG_FILE        = Path("sync-cloudflare-pops.log")

EXTRA_COUNTRIES: dict[str, str] = {
    "CR": "Costa Rica",
    "KG": "Kyrgyzstan",
    "MT": "Malta",
    "MW": "Malawi",
    "PS": "Palestine",
}

HARDCODED_REGION: dict[str, str] = {
    "CN": "Asia Pacific",
    "VE": "South America",
    "MD": "Europe",
}

parser = argparse.ArgumentParser(description="Sync Cloudflare edge PoP data.")
parser.add_argument(
    "--data",
    default="data/cloudflare-edge-locations.json",
    help="Path to cloudflare-edge-locations.json (default: data/cloudflare-edge-locations.json)",
)
parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Print what would change but do not write anything.",
)
args = parser.parse_args()

EDGES_JSON = Path(args.data)

_log_lines: list[str] = []

def log(msg: str = "") -> None:
    print(msg)
    _log_lines.append(msg)

sep  = "=" * 70
thin = "-" * 70

log(sep)
log(f"  sync-cloudflare-pops.py — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
log(f"  Source : {CF_ENDPOINT}")
log(sep)
log()
log("[1/4] Fetching Cloudflare PoP list ...")

try:
    req = urllib.request.Request(
        CF_ENDPOINT,
        headers={
            "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                               "AppleWebKit/537.36 (KHTML, like Gecko) "
                               "Chrome/124.0.0.0 Safari/537.36",
            "Accept":          "application/json, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer":         "https://speed.cloudflare.com/",
            "Origin":          "https://speed.cloudflare.com",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        cf_list: list[dict] = json.loads(resp.read().decode("utf-8"))
except Exception as exc:
    sys.exit(f"[fatal] Could not fetch Cloudflare locations: {exc}")

cf_lookup: dict[str, dict] = {}
for entry in cf_list:
    iata = entry.get("iata", "").strip()
    if iata:
        cf_lookup[iata] = {
            "lat":    round(float(entry["lat"]), COORD_PRECISION),
            "lon":    round(float(entry["lon"]), COORD_PRECISION),
            "cca2":   entry.get("cca2",   "").strip(),
            "region": entry.get("region", "").strip(),
            "city":   entry.get("city",   "").strip(),
        }

log(f"       {len(cf_lookup)} PoPs received from Cloudflare.")
log()
log("[2/4] Reading your dataset ...")

if not EDGES_JSON.exists():
    sys.exit(f"[fatal] '{EDGES_JSON}' not found.")

with open(EDGES_JSON, encoding="utf-8") as f:
    edges: dict[str, dict] = json.load(f)

log(f"       {len(edges)} entries loaded from {EDGES_JSON}.")

cca2_to_country: dict[str, str] = {}
cca2_to_region:  dict[str, str] = {}
for entry in edges.values():
    cc      = entry.get("countryCode", "").strip()
    country = entry.get("country",     "").strip()
    region  = entry.get("region",      "").strip()
    if cc and country:
        cca2_to_country[cc] = country
    if cc and region:
        cca2_to_region[cc]  = region

cca2_to_country.update(EXTRA_COUNTRIES)

for entry in cf_lookup.values():
    cc     = entry["cca2"]
    region = entry["region"]
    if cc and region:
        cca2_to_region[cc] = region

for cc, region in HARDCODED_REGION.items():
    cca2_to_region.setdefault(cc, region)

log()
log("[3/4] Syncing existing entries ...")

updated_entries:   list[tuple] = [] 
unchanged_entries: list[str]   = []
not_in_cf:         list[str]   = []

for iata, entry in edges.items():
    if iata not in cf_lookup:
        not_in_cf.append(iata)
        continue

    cf      = cf_lookup[iata]
    changes = []

    old_lat = round(entry.get("latitude",  0.0), COORD_PRECISION)
    old_lon = round(entry.get("longitude", 0.0), COORD_PRECISION)
    if old_lat != cf["lat"] or old_lon != cf["lon"]:
        changes.append(("coords", f"({old_lat}, {old_lon})", f"({cf['lat']}, {cf['lon']})"))
    entry["latitude"]  = cf["lat"]
    entry["longitude"] = cf["lon"]

    if cf["city"] and entry.get("city", "").strip() != cf["city"]:
        changes.append(("city", entry.get("city", ""), cf["city"]))
        entry["city"] = cf["city"]

    if cf["cca2"] and entry.get("countryCode", "").strip() != cf["cca2"]:
        changes.append(("countryCode", entry.get("countryCode", ""), cf["cca2"]))
        entry["countryCode"] = cf["cca2"]

    if cf["region"]:
        old_region = entry.get("region", "")
        if old_region != cf["region"]:
            changes.append(("region", old_region or "(none)", cf["region"]))
        entry["region"] = cf["region"]

    if changes:
        updated_entries.append((iata, changes))
    else:
        unchanged_entries.append(iata)

log(f"       Updated  : {len(updated_entries)}")
log(f"       Unchanged: {len(unchanged_entries)}")
log(f"       Not in CF: {len(not_in_cf)} (left untouched)")
log()
log("[4/4] Adding new PoPs from Cloudflare list ...")

added_entries:   list[tuple] = []
unknown_cca2:    list[tuple] = []

for iata in sorted(cf_lookup):
    if iata in edges:
        continue 

    cf      = cf_lookup[iata]
    cca2    = cf["cca2"]
    country = cca2_to_country.get(cca2, "")
    region  = cf["region"] or cca2_to_region.get(cca2, "")

    if not country:
        unknown_cca2.append((iata, cca2, cf["city"]))

    edges[iata] = {
        "city":        cf["city"],
        "country":     country,
        "countryCode": cca2,
        "latitude":    cf["lat"],
        "longitude":   cf["lon"],
        "region":      region,
    }
    added_entries.append((iata, cf["city"], cca2, country, cf["lat"], cf["lon"], region))

log(f"       Added: {len(added_entries)} new PoPs")

filled_regions: list[tuple] = []

for iata, entry in edges.items():
    if not entry.get("region", "").strip():
        cca2   = entry.get("countryCode", "").strip()
        region = cca2_to_region.get(cca2, "")
        if region:
            entry["region"] = region
            filled_regions.append((iata, entry.get("city", ""), cca2, region))

if filled_regions:
    log()
    log(f"       Filled {len(filled_regions)} missing region fields.")

if args.dry_run:
    log()
    log("[DRY RUN] No files written.")
else:
    with open(EDGES_JSON, "w", encoding="utf-8") as f:
        json.dump(edges, f, indent=2, ensure_ascii=False)
        f.write("\n")   # trailing newline — friendly for git diffs
    log()
    log(f"  Written: {EDGES_JSON}  ({len(edges)} total entries)")

log()
log(sep)
log("  SUMMARY")
log(sep)
log(f"  Coords/city synced : {len(updated_entries)}")
log(f"  Unchanged          : {len(unchanged_entries)}")
log(f"  Not in CF list     : {len(not_in_cf)}")
log(f"  New PoPs added     : {len(added_entries)}")
log(f"  Regions filled     : {len(filled_regions)}")
log(f"  Total entries now  : {len(edges)}")
log(sep)

if updated_entries:
    log()
    log(thin)
    log("  COORD/FIELD UPDATES")
    log(thin)
    for iata, changes in sorted(updated_entries, key=lambda x: x[0]):
        log(f"  {iata}  {edges[iata].get('city', '')}")
        for field, old, new in changes:
            log(f"    {field:<12}  {old}  →  {new}")

if added_entries:
    log()
    log(thin)
    log("  NEW PoPs ADDED")
    log(thin)
    for iata, city, cca2, country, lat, lon, region in sorted(added_entries, key=lambda x: x[0]):
        country_str = country if country else "*** unknown — fill manually ***"
        log(f"  {iata:4s}  {city}, {country_str} ({cca2})")
        log(f"        lat={lat}, lon={lon}  [{region}]")

if filled_regions:
    log()
    log(thin)
    log("  REGIONS BACK-FILLED")
    log(thin)
    for iata, city, cca2, region in sorted(filled_regions, key=lambda x: x[0]):
        log(f"  {iata:4s}  {city} ({cca2})  →  {region}")

if not_in_cf:
    log()
    log(thin)
    log("  NOT IN CF LIST (left untouched)")
    log(thin)
    for iata in sorted(not_in_cf):
        e = edges[iata]
        log(f"  {iata}  {e.get('city','')}, {e.get('country','')}")

if unknown_cca2:
    log()
    log(thin)
    log("  UNKNOWN COUNTRY CODES — add to EXTRA_COUNTRIES in script")
    log(thin)
    for iata, cca2, city in unknown_cca2:
        log(f"  {iata}  cca2={cca2}  city={city}")

if not args.dry_run:
    LOG_FILE.write_text("\n".join(_log_lines) + "\n", encoding="utf-8")
    log()
    log(f"  Log written: {LOG_FILE}")
