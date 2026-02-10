# Subscription & Revenue Model (Foundation)

## Overview

Subscription is **platform-wide** and pays the **foundation** account. One subscription grants ad-free access across the platform. Revenue flows into the **same ad-share account** as ad revenue: when creators draw down their ad-share credits, they receive both ad and subscriber share from that single pool.

## Revenue flow (order of operations)

1. **Programmatic amounts funded first** — Gas fees, Walrus fees, contract fees, and server/operational costs (e.g. keeping services running) are paid from revenue before any split.
2. **Remainder split** — Of what’s left:
   - **90%** → **Ad-share account** (the same pool creators draw from; includes subscription-derived share).
   - **10%** → Foundation (developer fund, API hosting).

So subscription revenue, after programmatic costs, goes into the ad-share pool. Creators who draw down ad-share credits get both ad and subscriber share from that pool; it affects creators the most directly.

## Signed statements (Brave-like)

Providers/creators receive **programmatically signed statements**:

- **Ad statement** — Signed attestation of a creator’s share from verified ad impressions/clicks.
- **Subscriber statement** — Signed attestation of subscription share (per person/time) that feeds the ad-share pool.

These statements (similar in spirit to Brave’s contribution statements) let creators prove and claim their combined share from the ad-share account. The platform issues signed ad and subscriber statements so draw-down is transparent and directly tied to creator earnings.

## Platform Vision

- **Read/write access to a public database** — the platform is essentially a gateway to a public graph
- **Signing** — skill.md or anything we gateway to end users can be signed/verified
- **UX = GraphQL layer** — the GraphQL API is the primary UX surface
- **MR/XR agents** — feed information to Mixed/Extended Reality agent contexts that:
  - Maintain digital twin information locally
  - Access other information publicly

## Subscription Model

| Aspect | Model |
|--------|-------|
| Recipient | Foundation account (not individual creators) |
| Scope | Platform-wide ad-free |
| Key | Single subscription key per subscriber; signed/verified for tracking and revenue |
| Revenue flow | Same as ad share: tracking + disbursement |

## Ad-share account (single pool)

- The **ad-share account** is the single pool that receives both ad revenue (creator share portion) and the 90% of subscription revenue (after programmatic costs).
- When a creator **draws down** their ad-share credits, they receive both ad-derived and subscriber-derived share from this pool.
- Subscription share is tracked per person/time and added to this pool; creators get signed **subscriber statements** (and **ad statements**) so the effect on creators is direct and verifiable (Brave-like).

Foundation = slush fund to pay developers and keep APIs online.

## Ad System Integration

- Platform-wide subscription key
- Signed statements (ad statement, subscriber statement) for tracking and revenue disbursement
- Same mechanism as ad share — subscription share is an additional stream into the ad-share pool
- Per person/time subscription share added to the pool; creators draw down from the combined pool

## Implementation Notes

- `FOUNDATION_ADDRESS` — env var for subscription recipient
- Subscription API: `POST /subscription` — subscriber pays foundation, gets platform-wide ad-free
- `GET /subscription/status?subscriber=X` — no creator param; platform-wide check
- Sandbox: `isSubscriptionActive()` — checks platform subscription only (no creator)

## E2E Coverage

| Journey | Spec | Browser |
|---------|------|---------|
| Subscribe browser journey | `subscribe-journey-browser.spec.ts` | yes |
| Subscribe full journey | `subscribe-journey-full.spec.ts` | yes |
| Subscription API | `subscription.spec.ts` | no (API) |
| Subscription real SUI | `subscription-real-sui.spec.ts` | no (wallet tx) |
| Billing browser | `billing-journey-browser.spec.ts` | yes |
| Billing API | `billing.spec.ts` | no (API) |
