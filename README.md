# Scam Alert - Photopol Project - ⚠️ PAYMENT NOTICE — PROJECT CURRENTLY UNPAID

> ## 🚨 IMPORTANT — OUTSTANDING PAYMENT
>
> **This project was developed for Ngu Agency / Nguagancy and the intended project website is [photopol.us](https://photopol.us/).**
>
> **As of September 4, 2026, the developer has not received the agreed payment for the development work associated with this project.**
>
> **The project contains development work completed by the developer, but the agreed outstanding payment remains unpaid.**
>
> **This repository is being maintained with this notice for transparency and to document the current payment status of the project.**
>
> ### THIRD-PARTY PROJECT ANALYSIS
>
> During the project, the client engaged a **third-party party/company to independently analyze and review the Photopol project**.
>
> The resulting **Third-Party Photopol Analysis Report** has been included in this repository as part of the project documentation:
>
> **[View Third-Party Photopol Analysis Report](./Third%20Party%20-%20Photopol%20Analysis%20Report_260830_223702.pdf)**
>
> The report is retained here as a record of the third-party analysis commissioned by the client.
>
> **Client / Agency:** Ngu Agency  https://Nguagency.com Alert this is scam company
> 
> **Telegram:** @nguagancy  
> **Project Domain:** https://photopol.us/
>
> **Payment Status: ❌ OUTSTANDING**
>
> Until the outstanding payment is resolved, this project should not be represented as a fully paid development project.

---

## 📋 Project Documentation & Third-Party Review

A third-party analysis/review of the Photopol project was commissioned by the client during development.

The analysis report supplied/commissioned by the client is preserved in this repository:

**[Third-Party — Photopol Analysis Report](./Third%20Party%20-%20Photopol%20Analysis%20Report_260830_223702.pdf)**

The purpose of retaining the report in this repository is to maintain a transparent project record, including documentation relating to the technical review performed during the development period.

The report represents the third-party review and should be understood as such; its findings and conclusions belong to the party that produced the report.


## Photopol — One AI Workspace for Every Image

Create. Edit. Enhance. Resize. Export.##

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, Alembic, Pydantic
- **DB:** PostgreSQL
- **Cache / queue:** Redis + Arq worker
- **Storage:** S3-compatible (MinIO locally)
- **AI:** Replicate + rembg / remove.bg (bg, erase, upscale, enhance)
- **Payments:** Stripe + Paddle (env on/off) packs, subscriptions, portals

## Phase 2

See [docs/PHASE2_SPEC.md](docs/PHASE2_SPEC.md). Tools: remove_bg, object_remove, upscale, enhance, bg_replace, resize, crop. Jobs API + credit holds + plan entitlements.

## Quick start (Docker)

```bash
cp .env.example .env
# set SECRET_KEY and optionally REPLICATE_API_TOKEN, Stripe keys
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- MinIO console: http://localhost:9001

### Create admin

```bash
docker compose exec backend python -m scripts.create_admin admin@photopol.us 'YourSecurePass!' 'Admin'
```

## Local development (without full Compose app)

```bash
# infra only
docker compose up -d postgres redis minio

# backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example ..\.env   # or symlink
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend
npm install
npm run dev
```

## Environment

See [`.env.example`](.env.example). Required for production:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing |
| `DATABASE_URL` | Postgres |
| `S3_*` | Object storage |
| `REPLICATE_API_TOKEN` | Real bg-removal |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_*_PRICE_*` | Stripe billing |
| `STRIPE_ENABLED` / `PADDLE_ENABLED` | Provider on/off |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` / `PADDLE_PRICE_ID_*` | Paddle billing |

Never put provider secrets in `NEXT_PUBLIC_*`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [AI Provider](docs/AI_PROVIDER.md)
- [Stripe](docs/STRIPE.md)
- [Paddle](docs/PADDLE.md)
- [Admin](docs/ADMIN.md)
- [Product direction](docs/PRODUCT_DIRECTION.txt)
- [Gap analysis + roadmap](docs/GAP_AND_ROADMAP.txt)
- [Phase 2 Spec](docs/PHASE2_SPEC.md)
- [Phase 3 Spec](docs/PHASE3_SPEC.md)
- [Milestones](docs/MILESTONES_ACCEPTANCE.txt)

## Tests

```bash
cd backend
pytest -q
```

## License

Proprietary — Photopol
