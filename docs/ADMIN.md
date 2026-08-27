# Admin Ops Console

ADMIN-only area at `/admin` (Next.js) backed by `/api/admin/*`.

## Create an admin

```bash
cd backend
python -m scripts.create_admin you@example.com 'StrongPass!' 'Your Name'
```

Docker:

```bash
docker compose exec backend python -m scripts.create_admin you@example.com 'StrongPass!' 'Your Name'
```

Login with an ADMIN account (or open `/login?next=/admin`). Non-admins see an access message + switch account.

## UI routes

| Path | Purpose |
|------|---------|
| `/admin` | Overview KPIs, recent failures, recent audit |
| `/admin/users` | Search / filter users |
| `/admin/users/[id]` | Plan, role, active, credit adjust, ledger |
| `/admin/jobs` | Filter jobs + detail panel |
| `/admin/projects` | All projects |
| `/admin/credits` | Global credit ledger |
| `/admin/billing` | Provider flags + plan counts + recent subs (**read-only**) |
| `/admin/audit` | Admin action log |

## API (all require ADMIN JWT)

- `GET /api/admin/stats`
- `GET /api/admin/users` — `q`, `role`, `plan_id`, `is_active`, `limit`, `offset`
- `GET|PATCH /api/admin/users/{id}`
- `POST /api/admin/users/{id}/credits`
- `GET /api/admin/users/{id}/credits`
- `GET /api/admin/jobs` · `GET /api/admin/jobs/{id}`
- `GET /api/admin/projects`
- `GET /api/admin/credits`
- `GET /api/admin/billing/overview`
- `GET /api/admin/audit`

Mutations write `admin_audit_logs` (`user.patch`, `user.credits`).

Guards: cannot demote/deactivate the last active admin; cannot deactivate yourself.

## Migrate

```bash
cd backend
alembic upgrade head
```

Revision `004_admin_ops` adds `admin_audit_logs`.

## Out of scope (v1)

Stripe/Paddle cancel/refund from admin, impersonation, CSV export, editing env payment toggles.

https://awaited-griffon-rapidly.ngrok-free.app/login?next=%2Fadmin
admin@photopol.us / Admin123!