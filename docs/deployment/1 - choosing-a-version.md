# Choosing a version

Two bundles are available on the [releases page](https://github.com/grayguava/libreprobe/releases). Both are fully functional and deploy identically — the only difference is the frontend presentation.

---

## `libreprobe-v*.tar.gz` — full

The standard build. Includes all CSS, layout, typography, animations, and the full visual design. This is what runs at [libreprobe.qzz.io](https://libreprobe.qzz.io).

**Choose this if** you want to self-host Libreprobe as-is.

---

## `libreprobe-skinless-v*.tar.gz` — skinless

All CSS and navigation chrome stripped. Plain semantic HTML with all JavaScript hooks intact. No visual styling — the pages are functional but unstyled.

**Choose this if** you want to audit the structure and JS without the design layer, or use Libreprobe as a base and apply your own CSS from scratch.

---

## What is identical across both

- All measurement logic (`functions/api/`, `assets/js/measurement/`)
- Worker endpoints (`/api/info`, `/api/ping`, `/api/stream`)
- KV-backed throughput rate limiting
- Deployment process — see [deployment-guide.md](./2 - deployment-guide.md)