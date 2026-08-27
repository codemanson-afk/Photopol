# Paddle Billing

Dual-provider with Stripe. Env toggles:

```
STRIPE_ENABLED=true
PADDLE_ENABLED=true
```

A provider is usable only when enabled **and** its API key is set.

## Env

```
PADDLE_ENABLED=false
PADDLE_API_KEY=pdl_...
PADDLE_WEBHOOK_SECRET=pdlwhsec_...
PADDLE_ENV=sandbox
PADDLE_PRICE_ID_CREDITS=pri_...
PADDLE_PRICE_ID_PRO_MONTHLY=pri_...
PADDLE_PRICE_ID_BUSINESS_MONTHLY=pri_...
PADDLE_SUCCESS_URL=http://localhost:3000/billing?success=1
PADDLE_CANCEL_URL=http://localhost:3000/billing?canceled=1
```

Unset success/cancel URLs fall back to Stripe URL defaults.

In the Paddle dashboard, set a **default payment link** (Checkout settings) so `transaction.checkout.url` is returned.

## Webhook

Point notifications to:

```
POST /api/billing/webhook/paddle
```

Subscribe at least to:

- `transaction.completed`
- `subscription.activated` / `subscription.updated` / `subscription.canceled` / `subscription.past_due`
- `transaction.payment_failed` (optional)

## Checkout flow

1. `GET /api/billing/status` → `providers: { stripe, paddle }`
2. `POST /api/billing/checkout` with `{ provider: "paddle", mode, plan?, quantity? }`
3. Redirect to returned `checkout_url`
4. Webhook grants credits / upserts subscription (`provider=paddle`)

## Portal

`POST /api/billing/portal` opens Stripe Customer Portal or Paddle customer portal session based on the user’s active subscription provider.
