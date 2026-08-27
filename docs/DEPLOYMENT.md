# Deployment

## Domain

- Apex: `https://photopol.us`
- `www.photopol.us` → 301 to apex (see `infrastructure/nginx/photopol.conf`)

## DNS (when you control the domain)

| Type | Name | Value |
|------|------|-------|
| A | @ | VPS public IP |
| A / CNAME | www | same IP or apex |

Issue TLS with Certbot / Let's Encrypt and uncomment SSL lines in the Nginx config.

## VPS Docker Compose

1. Clone repo on the server
2. Copy `.env.example` → `.env` and set production secrets
3. Point `S3_*` at production bucket (R2/S3) — not local MinIO
4. Set `CORS_ORIGINS=https://photopol.us`
5. Set `FRONTEND_URL`, Stripe success/cancel URLs to `https://photopol.us/...`
6. `docker compose up -d --build`
7. Run migrations (Compose backend command already runs `alembic upgrade head`)
8. `docker compose exec backend python -m scripts.create_admin ...`

## Production checklist

- [ ] Strong `SECRET_KEY`
- [ ] `DEBUG=false`, hide `/docs`
- [ ] Postgres backups
- [ ] Object storage private + signed URLs or CDN (Phase 1 uses public MinIO for local)
- [ ] Replicate + Stripe keys set
- [ ] Nginx TLS
- [ ] Firewall: 80/443 only public

## Exact local commands

```bash
cp .env.example .env
docker compose up --build
```

## Exact production-style commands

```bash
cp .env.example .env
# edit .env for production values
docker compose -f docker-compose.yml up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.create_admin admin@photopol.us 'CHANGE_ME' 'Admin'
```
