# Choosing a version

Two bundles are available on the [releases page](https://github.com/grayguava/libreprobe/releases):

---

## Full (`libreprobe-v*.tar.gz`)

Complete UI with CSS, charts, typography, layout. Matches [libreprobe.qzz.io](https://libreprobe.qzz.io).

**Use case:** Self-host as-is.

---

## Skinless (`libreprobe-skinless-v*.tar.gz`)

No CSS or styling. Plain HTML with measurement logic intact.

**Use cases:**
- Embed into your own project
- Run tests with custom frontend
- Audit the JavaScript without design layer

---

## What's the same

- Measurement logic (`functions/api/`, `assets/js/measurement/`)
- Worker endpoints (`/api/info`, `/api/ping`, `/api/stream`)
- KV-backed rate limiting
- Deployment process — see [deployment-guide.md](./2 - deployment-guide.md)

**Also available via git clone** — clone the repo to get the skinless version directly.