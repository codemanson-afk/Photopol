# Architecture

## Overview

Photopol is a monorepo: Next.js → FastAPI → PostgreSQL / Redis / S3 / Replicate / Stripe.

Phase 2 adds an async job layer (`POST /api/jobs`, Arq worker), multi-tool registry
(object remove, upscale, enhance, bg replace), credit holds, and Stripe subscriptions + portal.

```
Browser → Next.js → FastAPI → PostgreSQL
                           → Redis / Arq worker
                           → S3 / MinIO
                           → Replicate / rembg / remove.bg
                           → Stripe
```

`JOB_EXECUTION_MODE=inline` (default) runs jobs in-process for local dev.
`JOB_EXECUTION_MODE=queue` + Compose `worker` service for production-style async.

## Backend layers

- `app/api/routes` — HTTP only
- `app/services` — business logic (processing, credits, AI, storage, image ops)
- `app/models` — SQLAlchemy ORM
- `app/schemas` — Pydantic I/O

## AI provider abstraction

`BackgroundRemovalProvider` protocol → `ReplicateBackgroundRemovalProvider`.

`AIService` selects the provider. New vendors implement the same interface without changing route handlers.

## Credits

1. Check balance before starting
2. Create `ProcessingJob`
3. On success: store version, deduct with `reference_id=job.id` (unique), mark `credits_deducted`
4. On failure: job `FAILED`, no debit

## Ownership

Every project/image/job query filters by `user_id`. Admin routes require `UserRole.ADMIN` server-side.

## Image versions

Originals are immutable. Each resize/crop/bg-removal writes a new `ImageVersion`.
