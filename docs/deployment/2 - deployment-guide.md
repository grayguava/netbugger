# Deployment guide

Libreprobe is deployed via Wrangler CLI. GUI upload and Git-connected deploys do not correctly wire the `functions/api/` Workers; Wrangler is the only supported deployment path.

Applies to both the full and skinless builds. See [choosing-a-version.md](./choosing-a-version.md) if you haven't decided which bundle to use.

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated (`wrangler login`)
- A Cloudflare account with Pages enabled

---

## 1. Get the source

#### Either

**Git clone (skinless):**
```bash
git clone https://github.com/grayguava/libreprobe.git
cd libreprobe
```
#### or

**Tarball (skinless or full):**
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

```bash
cp wrangler.toml.example wrangler.toml
```

Add your KV namespace id:

```toml
name = "libreprobe"
compatibility_date = "2024-01-01"

pages_build_output_dir = "."

[[kv_namespaces]]
binding = "LIBREPROBE_THROUGHPUT_RL"
id = "<your-kv-namespace-id>"
```

---

## 4. Deploy

```bash
wrangler pages deploy .
```

---

## Notes

- **KV counter** : used to enforce the daily throughput test cap (`DAILY_TOKEN_LIMIT = 100`). You can raise this to whatever your Cloudflare plan comfortably supports, but on the free tier anything above ~120/day is likely to hit CPU/subrequest limits or trigger abuse protections. If the KV binding is missing, the token endpoint returns 500 and the throughput test will not run.
- **Local dev** : `wrangler pages dev .` works for local development. The KV binding will use a local KV store automatically.
- **Cloudflare-only** : connection metadata (`request.cf`) is only populated when served through Cloudflare's network. Running from `file://` or a non-Cloudflare host will return null for all connection fields.