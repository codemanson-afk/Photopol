# Photopol Phase 1 — Final Report

## 1. What was built

Production-oriented MVP monorepo for **Photopol**: auth, dashboard, projects, real image upload to S3/MinIO, Replicate background removal, server-side resize/crop, versioned history, credits, admin, Stripe checkout/webhook foundation, landing + SEO pages, Docker Compose, docs.

## 2. Architecture

Next.js → FastAPI → PostgreSQL / Redis / S3 / Replicate / Stripe. AI behind `BackgroundRemovalProvider` so providers can be swapped without route changes. See `docs/ARCHITECTURE.md`.

## 3. Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind 4 |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| DB | PostgreSQL (`postgresql+psycopg`) |
| Storage | S3-compatible (MinIO local) |
| AI | Replicate Recraft Remove Background |
| Payments | Stripe test-mode foundation |

## 4. Database

Tables: `users`, `projects`, `images`, `image_versions`, `processing_jobs`, `credit_transactions`, `payment_events`. Migration: `backend/alembic/versions/001_initial.py`.

## 5–6. AI provider

`REPLICATE_API_TOKEN` + `REPLICATE_BG_REMOVAL_MODEL=recraft-ai/recraft-remove-background` (backend only). Endpoint: `POST /api/projects/{id}/background-removal`.

## 7. Credits

Configurable costs in env. Deduct only after success; idempotent via `(reference_id, type)`. Failed jobs do not debit.

## 8. Authentication

Register/login/logout, bcrypt hashes, JWT Bearer, protected API + frontend shell redirect.

## 9. Admin

`/admin` + `/api/admin/*` require `UserRole.ADMIN` server-side. Stats, users, jobs, credit adjust.

## 10. Stripe

Checkout session + signed webhook + `payment_events`. Credits granted on `checkout.session.completed`.

## 11. SEO

Landing, `/ai-background-remover`, `/background-remover`, `/image-resizer`, `sitemap.xml`, `robots.txt`, OG/canonical metadata.

## 12–13. Deploy / env

See `docs/DEPLOYMENT.md` and `.env.example`. Domain target: `photopol.us`.

**You must provide:** `REPLICATE_API_TOKEN`, Stripe keys + price ID, production `SECRET_KEY`, production S3, DNS/TLS for photopol.us.

## 14. Tests

`backend/tests/test_core.py` — auth, ownership, admin forbid, credits idempotency, upload validation, image ops.

```bash
cd backend && python -m pytest -q
```

## 15. Security checks

- Secrets via env / `.env` gitignored
- No provider keys in frontend
- Ownership filters, admin role checks
- Upload MIME/size validation
- AI rate limiting middleware
- CORS + basic security headers

## 16. Phase 2

See [PHASE2_SPEC.md](PHASE2_SPEC.md) — object removal, upscaling, async queues, subscriptions/portal, signed storage URLs.

## 17. Local commands

```bash
cp .env.example .env
docker compose up --build
# Frontend http://localhost:3000  API http://localhost:8000/docs
docker compose exec backend python -m scripts.create_admin admin@photopol.us 'SecurePass!' 'Admin'
```

Without full Compose app containers:

```bash
docker compose up -d postgres redis minio
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt && alembic upgrade head
uvicorn app.main:app --reload --port 8000
cd ../frontend && npm install && npm run dev
```

## 18. Production-style

```bash
# set production .env (DEBUG=false, real S3, secrets, CORS=https://photopol.us)
docker compose up -d --build
docker compose exec backend alembic upgrade head
# configure Nginx from infrastructure/nginx/photopol.conf + Let's Encrypt
```

## 19. Phase 1 acceptance checklist

- [x] Registration / login / logout / JWT / roles
- [x] Dashboard real stats
- [x] Upload + ownership
- [x] Real Replicate bg-removal path (needs token)
- [x] Resize / crop / versions / download
- [x] Credits ledger + failed-job no debit
- [x] Admin APIs/UI
- [x] Stripe foundation
- [x] Landing + SEO
- [x] Docker Compose + docs
- [ ] Live Replicate E2E (needs your API token)
- [ ] Live Stripe E2E (needs test keys)
- [ ] photopol.us DNS/TLS (needs your hosting access)
