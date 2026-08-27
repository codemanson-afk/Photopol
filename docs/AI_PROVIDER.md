# AI Provider

## Phase 1

- Provider: **Replicate**
- Model: `recraft-ai/recraft-remove-background` (`REPLICATE_BG_REMOVAL_MODEL`)

## Configuration

Set backend-only:

```
REPLICATE_API_TOKEN=r8_...
REPLICATE_BG_REMOVAL_MODEL=recraft-ai/recraft-remove-background
CREDIT_COST_BACKGROUND_REMOVAL=5
```

Never expose the token to Next.js or `NEXT_PUBLIC_*`.

## Flow

`POST /api/projects/{id}/background-removal`

Auth → ownership → credit check → job PROCESSING → Replicate → store PNG version → deduct credits → COMPLETED.

Failures mark the job FAILED and do not deduct.

## Extending

Implement `BackgroundRemovalProvider.remove_background(...)` and inject into `AIService`.
