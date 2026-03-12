# Deployment guide

Applies to both the full and skinless builds. See [choosing-a-version.md](./choosing-a-version.md) if you haven't decided which bundle to use.

Libreprobe is deployed via Wrangler CLI. GUI upload and Git-connected deploys do not correctly wire the `functions/api/` Workers — Wrangler is the only supported deployment path.

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated (`wrangler login`)
- A Cloudflare account with Pages enabled

---

## 1. Extract the bundle

```bash
tar -xzf libreprobe-v*.tar.gz
cd libreprobe
```

---

## 2. Create the KV namespace

```bash
wrangler kv namespace create LIBREPROBE_THROUGHPUT_RL
```

Note the `id` from the output.

---

## 3. Configure `wrangler.toml`

A `wrangler.toml.example` is included in the bundle. Copy and fill in your KV namespace id:

```bash
cp wrangler.toml.example wrangler.toml
```

```toml
name = "libreprobe"
compatibility_date = "2024-01-01"

pages_build_output_dir = "."

[[kv_namespaces]]
binding = "LIBREPROBE_THROUGHPUT_RL"
id = "<your-kv-namespace-id>"
```

The binding name must be exactly `LIBREPROBE_THROUGHPUT_RL` — this is what `functions/api/stream/index.js` reads from `env`.

---

## 4. Deploy

```bash
wrangler pages deploy .
```

Wrangler will create the Pages project on first run if it doesn't exist, and prompt for a project name.

---

## Notes

- **KV counter** — the daily throughput test cap (`DAILY_TOKEN_LIMIT = 100`) is enforced via this KV namespace. Without the binding, the token endpoint returns 500 and the throughput test will not run.
- **Local dev** — `wrangler pages dev .` works for local development. The KV binding will use a local KV store automatically.
- **Cloudflare-only** — connection metadata (`request.cf`) is only populated when served through Cloudflare's network. Running from `file://` or a non-Cloudflare host will return null for all connection fields.