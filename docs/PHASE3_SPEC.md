# Photopol Phase 3 — Spec

> **Status: implemented in code** — product-photo + social-export workspace (batch, packs, product pipeline, wired editor, failover, prod profile).

**Positioning:** Raw product photo → marketplace-ready cutout → multi-platform social pack.

**Fee:** +$300 (after Phase 1 $500 + Phase 2 +$350).

## Deliverables

| ID | Feature |
|----|---------|
| P3-A | Batch API + UI + ZIP |
| P3-B | Product pipeline + shadow/placement + SEO |
| P3-C | Social + marketplace export packs + live encode |
| P3-D | Wire editor Soon controls (export, enhance manual, crop transform, brush, fit) |
| P3-E | Provider failover + recipe meta + admin cost strip |
| P3-F | Prod profile (queue, signed URLs, guest caps) |

## Non-goals

Text-to-image, auto-post to social, teams/SSO, public API, self-hosted diffusion.

## Acceptance

- [x] Batch of N images (plan-limited) with ZIP download
- [x] Social + marketplace export packs
- [x] Product pipeline end-to-end
- [x] Export format/quality live
- [x] ≥5 former Soon controls affect output
- [x] Second-path failover for upscale
- [x] Prod profile documented

## Key routes

- `POST /api/batches` · `GET /api/batches/{id}` · `GET /api/batches/{id}/zip`
- `POST /api/exports/packs` · `GET /api/exports/presets`
- `POST /api/exports/pipelines/product`
- UI: `/batch`, `/product-photo-editor`, studio Social/Market pack + Product pipeline
