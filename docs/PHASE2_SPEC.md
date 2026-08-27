# Photopol Phase 2 — Spec

> **Status: implemented** in repo (jobs API, Arq worker, tool registry, erase/upscale/enhance/bg_replace, Stripe plans+portal, Compose `worker`). Tune Stripe price IDs + Replicate tokens for prod.

**Goal:** Multi-tool AI workspace that feels like a real SaaS — async jobs, model tiers, subscriptions — not more marketing cards.

**Phase 1 baseline:** `remove_bg` / `resize` / `crop`, sync processing via `ProcessingService`, credit deduct-on-success, Stripe one-shot credit packs, Redis present but unused for workers. See `PHASE1_REPORT.md`.

---

## 1. North star

| Pillar | Outcome |
|--------|---------|
| Jobs | `POST` returns `202` + `job_id`; UI polls; AI never blocks HTTP 60s |
| Tools | Object remove + upscale + enhance/replace on top of Phase 1 |
| Models | Fast / Best per AI tool; registry-driven costs |
| Money | Free / Pro / Business + credit packs + Customer Portal |
| Product | Editor tool rail + mask canvas + version history + `/tools` catalog |

**Out of scope for Phase 2:** text-to-image studio, teams/SSO, public developer API, self-hosted diffusion.

---

## 2. Build order

| Milestone | Weeks | Deliverable |
|-----------|-------|-------------|
| **M0** Platform | 1–2 | Generic job queue, credit hold, signed URLs, extended `JobType` |
| **M1** Object removal | 3–4 | Mask UI + worker + model |
| **M2** Upscale | 4–5 | 2× / 4× dedicated upscale |
| **M3** Billing | 5–7 | Subscriptions, portal, entitlements |
| **M4** Depth | 7–9 | Bg replace and/or enhance; SEO pages; batch (≤5) |
| **M5** Harden | 9–10 | Failover, cost admin, E2E, rate limits by plan |

Ship M0 before adding tools. Do not bolt sync Replicate calls into new routes.

---

## 3. Schema changes

### 3.1 Extend enums (`backend/app/models`)

```python
class JobType(str, enum.Enum):
    BACKGROUND_REMOVAL = "BACKGROUND_REMOVAL"
    RESIZE = "RESIZE"
    CROP = "CROP"
    OBJECT_REMOVE = "OBJECT_REMOVE"
    UPSCALE = "UPSCALE"
    BG_REPLACE = "BG_REPLACE"
    ENHANCE = "ENHANCE"
    BATCH = "BATCH"

class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"       # NEW — accepted, waiting for worker
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED" # NEW
```

### 3.2 `ProcessingJob` columns to add

| Column | Type | Purpose |
|--------|------|---------|
| `model_id` | `String(100)` | Registry key, e.g. `upscale-realesrgan-4x` |
| `progress` | `Integer` 0–100 | UI progress |
| `priority` | `Integer` default 0 | Paid > free |
| `batch_id` | `Uuid` nullable | Group batch children |
| `credits_held` | `Boolean` | Hold placed at enqueue |
| `error_code` | `String(64)` | Machine code (`ai_provider_error`, …) |
| `started_at` | `DateTime` | Worker start |

Existing fields already useful: `params` JSON, `idempotency_key`, `provider`, `provider_job_id`, `credit_cost`, `credits_deducted`.

### 3.3 New tables

**`subscriptions`**

| Column | Notes |
|--------|-------|
| `user_id` | FK unique active row (or status-scoped) |
| `stripe_customer_id` | |
| `stripe_subscription_id` | |
| `plan_id` | `free` / `pro` / `business` |
| `status` | `active` / `past_due` / `canceled` / `trialing` |
| `current_period_end` | |
| `monthly_credit_allowance` | Granted on `invoice.paid` |

**`plan_entitlements`** (code config OK for v1; DB later)

Plan → allowed `tool_id`s + max concurrent jobs + max upscale factor + batch size.

### 3.4 Credit transaction types

Add:

```python
HOLD = "HOLD"           # negative pending; reference_id = job.id
HOLD_RELEASE = "HOLD_RELEASE"
SUBSCRIPTION_GRANT = "SUBSCRIPTION_GRANT"
```

Or implement holds as balance decrement with `HOLD` and reverse with `HOLD_RELEASE` / settle by converting hold → `AI_OPERATION` (preferred: single settle path, no double ledger noise).

**Recommended settle flow:**

1. Enqueue: `ensure_balance` + set `credits_held=True` (soft lock via `SELECT FOR UPDATE` balance check; optional `reserved_credits` column on `users`)
2. Success: `CreditService.deduct(..., reference_id=job.id)` + `credits_deducted=True`
3. Fail: clear hold; no debit

Add `users.reserved_credits` (int, default 0) so available = `credit_balance - reserved_credits`.

---

## 4. Job API

### 4.1 Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/jobs` | Create job, enqueue, return `202` |
| `GET` | `/api/jobs/{id}` | Status, progress, result version |
| `GET` | `/api/jobs?project_id=` | List recent |
| `POST` | `/api/jobs/{id}/cancel` | Cancel if `QUEUED` |
| `POST` | `/api/batches` | Optional: N image_ids + same tool |

Keep Phase 1 routes as thin wrappers that call the same enqueue path (compat).

### 4.2 Create job body

```json
{
  "project_id": "uuid",
  "image_id": "uuid",
  "version_id": "uuid | null",
  "tool": "object_remove",
  "model_id": "object-lama-fast",
  "params": {
    "mask_storage_key": "...",
    "scale": 4
  },
  "idempotency_key": "client-generated"
}
```

### 4.3 Job response

```json
{
  "id": "uuid",
  "status": "QUEUED",
  "tool": "object_remove",
  "model_id": "object-lama-fast",
  "credit_cost": 12,
  "progress": 0,
  "result_version_id": null,
  "error_code": null,
  "error_message": null,
  "created_at": "...",
  "completed_at": null
}
```

### 4.4 Frontend polling

- Poll `GET /jobs/{id}` every 1.5s while `QUEUED|PROCESSING`
- Cap 5 minutes; then show “still working” + link to history
- Optional later: SSE `GET /jobs/{id}/events`

---

## 5. Queue & workers

### 5.1 Stack

- **Broker:** Redis (`REDIS_URL` already in config + Compose)
- **Worker:** Arq or RQ (prefer **Arq** — async-friendly with FastAPI)
- **Compose:** add `worker` service sharing backend image

```yaml
# docker-compose.yml (add)
worker:
  build: ./backend
  env_file: .env
  command: arq app.worker.WorkerSettings
  depends_on: [postgres, redis, minio]
```

### 5.2 Worker responsibilities

1. Claim job → `PROCESSING`, `started_at`
2. Download image (+ mask if any) from S3
3. Run provider from registry
4. Upload result → new `ImageVersion`
5. Settle credits; mark `COMPLETED`
6. On error: `FAILED`, `error_code`, release hold

### 5.3 Limits

| Limit | Free | Pro | Business |
|-------|------|-----|----------|
| Concurrent jobs | 1 | 3 | 8 |
| Queue priority | 0 | 10 | 20 |
| Max edge px (AI) | 2048 | 4096 | 8192 |
| Batch size | — | 5 | 20 |

Guest: lowest priority; hard caps via existing `GuestSession` + `GUEST_LIMITS_ENABLED`.

---

## 6. Tool & model registry

### 6.1 Tool IDs (product)

| `tool` | Phase | UI | Async |
|--------|-------|-----|-------|
| `remove_bg` | 1 | Cutout | Yes (migrate) |
| `resize` | 1 | Resize | Optional sync OK |
| `crop` | 1 | Crop | Sync OK |
| `object_remove` | 2 | Erase (brush) | Yes |
| `upscale` | 2 | Upscale | Yes |
| `bg_replace` | 2.5 | Replace | Yes |
| `enhance` | 2.5 | Enhance | Yes |

Map to `JobType` 1:1 (uppercase enum).

### 6.2 Model registry (config module)

`backend/app/services/tool_registry.py`:

```python
TOOLS = {
  "object_remove": {
    "models": [
      {"id": "object-lama-fast", "provider": "replicate",
       "replicate_model": "…", "credits": 8, "plan_min": "free"},
      {"id": "object-flux-fill", "provider": "replicate",
       "replicate_model": "…", "credits": 20, "plan_min": "pro"},
    ],
  },
  "upscale": {
    "models": [
      {"id": "upscale-2x", "credits": 6, "params": {"scale": 2}, "plan_min": "free"},
      {"id": "upscale-4x", "credits": 14, "params": {"scale": 4}, "plan_min": "pro"},
    ],
  },
  "remove_bg": {
    "models": [
      {"id": "bg-local", "provider": "local_rembg", "credits": 2, "plan_min": "free"},
      {"id": "bg-recraft", "provider": "replicate", "credits": 5, "plan_min": "free"},
      {"id": "bg-removebg", "provider": "removebg", "credits": 8, "plan_min": "pro"},
    ],
  },
}
```

Pin concrete Replicate model slugs in `.env` / registry at implementation time; do not hardcode in routes.

### 6.3 Credit table (v1 defaults — tune to COGS)

| Tool | Model tier | Credits | Notes |
|------|------------|---------|-------|
| crop | — | 1 | Pillow |
| resize | — | 1 | Pillow |
| remove_bg | Fast (local) | 2 | Guest/cheap |
| remove_bg | Standard | 5 | Current default |
| remove_bg | Pro | 8 | remove.bg |
| object_remove | Fast | 8 | |
| object_remove | Best | 20 | Pro+ |
| upscale | 2× | 6 | |
| upscale | 4× | 14 | Pro+ |
| enhance | Standard | 4 | |
| bg_replace | Standard | 12 | Needs prompt/ref |

Env overrides (extend `Settings`):

```
CREDIT_COST_OBJECT_REMOVE=8
CREDIT_COST_OBJECT_REMOVE_BEST=20
CREDIT_COST_UPSCALE_2X=6
CREDIT_COST_UPSCALE_4X=14
CREDIT_COST_ENHANCE=4
CREDIT_COST_BG_REPLACE=12
```

### 6.4 Provider protocol

Replace bg-only ABC with:

```python
class ImageTransformProvider(Protocol):
    def run(
        self,
        *,
        tool: str,
        model_id: str,
        image_bytes: bytes,
        content_type: str,
        params: dict,
    ) -> TransformResult: ...
```

`TransformResult`: `image_bytes`, `content_type`, `provider_job_id`, `provider`, `meta`.

Keep existing rembg / remove.bg / Replicate bg adapters as implementations behind `tool=remove_bg`.

---

## 7. Billing (production)

### 7.1 Plans

| Plan | Price (placeholder) | Monthly credits | Highlights |
|------|---------------------|-----------------|------------|
| Free | $0 | 50 signup / no refill | cutout Fast, crop, resize, upscale 2× |
| Pro | $19/mo | 500 | erase Best, upscale 4×, enhance, priority |
| Business | $49/mo | 2000 | batch 20, highest priority, bg replace |

Prices are placeholders — set Stripe Prices in Dashboard; store IDs in env.

### 7.2 Env additions

```
STRIPE_PRICE_ID_CREDITS=price_...          # existing pack
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_...
STRIPE_PORTAL_RETURN_URL=https://photopol.us/billing
```

### 7.3 Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/billing/checkout` | Extend: `mode=payment|subscription`, `price_id` |
| `POST` | `/api/billing/portal` | Stripe Billing Portal session |
| `POST` | `/api/billing/webhook` | Handle subscription lifecycle |

### 7.4 Webhook events to handle

- `checkout.session.completed` — packs (existing) + subscription start
- `invoice.paid` — grant monthly credits (`SUBSCRIPTION_GRANT`, idempotent on `invoice.id`)
- `customer.subscription.updated` / `deleted` — sync plan + status
- `invoice.payment_failed` — `past_due`; soft-lock Pro models

### 7.5 Entitlements check

Before enqueue:

```
plan = user.subscription.plan_id or "free"
model = registry[tool][model_id]
if plan_rank(plan) < plan_rank(model.plan_min): raise 403 plan_required
```

---

## 8. Storage

- Production: **private bucket**; serve via **presigned GET** (TTL 15–60 min)
- Mask uploads: `POST /api/projects/{id}/masks` → storage key in job `params`
- Stop relying on permanent `S3_PUBLIC_URL` for auth’d assets

---

## 9. Frontend

### 9.1 Tool registry (`frontend/src/lib/tools.ts`)

Extend `ToolId`:

```ts
export type ToolId =
  | "remove_bg"
  | "resize"
  | "crop"
  | "object_remove"
  | "upscale"
  | "bg_replace"
  | "enhance";
```

`run()` → `POST /jobs` then poll until terminal (shared `runJob()` helper).

### 9.2 Editor (`studio-editor.tsx`)

- Tool rail: Cutout · Erase · Upscale · (Replace) · (Enhance) · Crop · Resize
- Erase: brush mask layer → upload mask → enqueue
- Upscale: scale toggle 2× / 4× (4× gated)
- Job status chip on canvas (progress %)
- Versions tray already exists — bind to job completion

### 9.3 App surfaces

| Route | Change |
|-------|--------|
| `/tools` | Live catalog + plan locks |
| `/billing` | Plans + packs + “Manage subscription” |
| `/credits` | Burn by tool; reserved vs available |
| Landing | Visual cards for erase + upscale |
| SEO | `/object-remover`, `/image-upscaler` |

Do not advertise tools that are not live.

---

## 10. Object removal — product detail

**Input:** source image + PNG mask (white = remove)  
**Output:** inpainted PNG/JPEG version  
**UX:** brush size, undo stroke, “Erase” CTA, before/after  

**Params:**

```json
{ "mask_storage_key": "...", "feather": 2 }
```

---

## 11. Upscale — product detail

**Input:** source version  
**Params:** `{ "scale": 2 | 4 }`  
**Guard:** reject if `width * scale > MAX_IMAGE_DIMENSION`  
**UX:** show output megapixels + credit cost before apply  

---

## 12. Acceptance checklist

- [ ] AI tools return `202` + pollable job; HTTP workers not blocked on Replicate
- [ ] Failed jobs never debit; retry with same idempotency key is safe
- [ ] `object_remove` E2E with brush mask
- [ ] `upscale` 2× free-path and 4× Pro-gated
- [ ] Stripe subscription + portal live-mode tested
- [ ] Monthly credit grant idempotent on invoice id
- [ ] Presigned (or auth’d) media URLs in prod
- [ ] Admin: job list shows provider, cost, model_id
- [ ] Guest caps enforceable with `GUEST_LIMITS_ENABLED=true`
- [ ] No Coming Soon tools on marketing surfaces

---

## 13. File touch list (implementation map)

| Area | Files |
|------|-------|
| Models / migration | `models/__init__.py`, `alembic/versions/002_phase2_jobs_billing.py` |
| Registry | `services/tool_registry.py` (new) |
| Queue | `worker.py` (new), Compose `worker` |
| Jobs API | `api/routes/jobs.py` (new), wire in `main.py` |
| Processing | Refactor `processing.py` → enqueue vs execute |
| AI | Generalize `ai.py` providers |
| Credits | `credits.py` reserved balance |
| Billing | `billing.py`, `docs/STRIPE.md` |
| Frontend | `lib/tools.ts`, `studio-editor.tsx`, billing/credits pages |
| Docs | this file, `ARCHITECTURE.md`, `AI_PROVIDER.md` |

---

## 14. Explicit non-goals

- Training or hosting custom diffusion weights
- Watermark-removal marketing
- 15+ tools in one release
- Team workspaces / SSO
- Public REST API for third parties

---

## 15. Open decisions (resolve at M0 kickoff)

1. **Worker library:** Arq vs Celery — default **Arq**
2. **Credit hold:** `reserved_credits` column vs ledger `HOLD` rows — default **reserved_credits**
3. **Resize/crop async?** — default **keep sync** for snappiness
4. **Primary erase model** — pick one Replicate model after quality bake-off
5. **Pro price** — $15 / $19 / $29 — set before Stripe Price creation
