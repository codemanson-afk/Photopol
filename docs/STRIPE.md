# Stripe

## Dual provider

Stripe and Paddle can both be enabled. See [PADDLE.md](PADDLE.md).

```
STRIPE_ENABLED=true
PADDLE_ENABLED=false
```

Stripe is usable when `STRIPE_ENABLED=true` and `STRIPE_SECRET_KEY` is set.

## Env

```
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_CREDITS=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_...
STRIPE_SUCCESS_URL=https://photopol.us/billing?success=1
STRIPE_CANCEL_URL=https://photopol.us/billing?canceled=1
STRIPE_PORTAL_RETURN_URL=https://photopol.us/billing
```

## Local webhook

```bash
stripe listen --forward-to localhost:8001/api/billing/webhook
# or alias:
# stripe listen --forward-to localhost:8001/api/billing/webhook/stripe
```

## Checkout

`POST /api/billing/checkout` accepts optional `provider: "stripe" | "paddle"`.
If both providers are on and `provider` is omitted → `400 provider_required`.

## Events

- `checkout.session.completed` — packs + subscription start
- `invoice.paid` — renewal credits (skips `subscription_create`)
- `customer.subscription.updated` / `.deleted`
- `invoice.payment_failed`
