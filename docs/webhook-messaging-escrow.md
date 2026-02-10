# Webhook Messaging & Escrow-Key System

## Overview

This document describes a **user-centric webhook and messaging layer** that extends beyond the current GitHub-deploy webhook service. The system allows:

1. **Users to register public keys** they listen to
2. **Messages** (including those that **unlock escrow**) to be sent to those keys
3. **Prorata escrow release** based on how much of a message was consumed (e.g. ad watch time)
4. **dApp webhooks** so any dApp can push or pull notifications to DLUX users

These messages can function as **individualized ads** (accept funds conditional on watching) or a **public direct messenger**, with the understanding that accepting funds was agreed upon conditional on watching the ad or message.

---

## Relationship to Existing Systems

| Component | Current | This Design |
|-----------|---------|-------------|
| **Webhook service** | GitHub-only; receives push events, triggers deploys | **Extended**: generic user/dApp webhook API; messages target user-registered keys |
| **Ad escrow** | CampaignEscrow holds budget; released per verified impression | **Extended**: messages can carry **escrow-unlock keys**; release **prorata** by watch progress |
| **Ad tracking** | Click tokens, conversions, ZK proofs | **Aligned**: watch progress / engagement can feed verification (ZK or attested) |
| **Identity** | Sui addresses, SuiNS, ZK linkage | **Reused**: public keys can be Sui addresses or dedicated notify keys |

The existing **webhook service** (`services/webhook-service/`) remains for GitHub deploy flows. The **messaging / user webhook** system is a **new capability**—either a separate service or new routes within an expanded webhook/notify service.

---

## Core Concepts

### 1. User-Registered Public Keys

- Users **register one or more public keys** they will listen to.
- Keys can be:
  - **Sui addresses** (already identity-backed)
  - **Dedicated notify keys** (e.g. X25519, Ed25519) for E2E-encrypted inbox
- **API**: register, list, revoke keys; optional labels (e.g. `ads`, `dms`, `dapp:foo`).

Senders (advertisers, dApps, other users) target **keys** rather than raw identifiers. Delivery and optional encryption are key-based.

### 2. Messages That Can Unlock Escrow

- A **message** can be linked to an **escrow** (e.g. `CampaignEscrow` or a dedicated **message escrow**).
- The message **holds or references a key** (or proof) that **unlocks** a portion of the escrow.
- **Consumption** of the message (e.g. watch time, scroll depth, “Continue to Content”) determines **how much** is released.

**Individualized ads:**

- Ad = message; escrow is ad budget.
- **Condition**: User agrees to receive funds **conditional on watching** the ad.
- **Prorata**: Release proportional to watch progress (e.g. 0–100% of video, or time-in-view).

**Direct messenger:**

- DM = message; optional escrow (e.g. tip for reading).
- Same mechanism: **accept funds conditional on consuming** the message; optional prorata (e.g. by read state).

### 3. Prorata Release by Watch Progress

- **Watch progress** (or read state) is attested by the client or verified via ZK proofs.
- **Aggregator** (e.g. DGraph, ZK service) combines progress attestations and produces a **release amount**.
- **On-chain**: Escrow contract (or new **message-escrow** module) releases funds **prorata** (e.g. `amount = total * min(100%, progress)`).
- Existing **ad verification** (ZK, homomorphic) can be reused or adapted for “watched X%” attestations.

### 4. dApp Webhooks (Push / Pull)

- **Any dApp** can **register a webhook** to notify DLUX users.
- **Push**: dApp sends events to DLUX; we **deliver to users** (by their registered keys, optionally filtered by topic/dApp).
- **Pull**: User (or DLUX on behalf of user) **polls** dApp endpoints; we **notify the user** when new data exists.
- **Topics / filters**: Users subscribe to **dApp id**, **topic**, or **label**; only matching messages are delivered.

This allows arbitrary dApps to **push** or **pull** notify users without each dApp building its own inbox.

---

## Proposed API Surface

### User Key Registration

```
POST   /notify/keys              Register a public key (key type, value, label)
GET    /notify/keys              List user’s keys
DELETE /notify/keys/:id          Revoke a key
```

### Messaging (Send / Receive)

```
POST   /notify/send              Send message to one or more keys (or key labels)
GET    /notify/inbox             Poll user’s inbox (filter by topic, dApp, since)
POST   /notify/ack               Ack consumption (e.g. watch progress) for prorata release
```

### dApp Webhooks

```
POST   /notify/webhooks          Register dApp webhook (push URL, optional pull config)
GET    /notify/webhooks          List dApp’s webhooks
PUT    /notify/webhooks/:id      Update webhook
DELETE /notify/webhooks/:id      Remove webhook
```

### Escrow-Linked Messages

- **Send** includes optional `escrow_ref` (e.g. campaign + escrow id) and **release rule** (e.g. prorata by progress).
- **Ack** includes `message_id`, `progress` [0, 1], and optional ZK proof.
- Backend/oracle **computes release amount** and calls **on-chain** release; funds move **prorata** to the agreed recipients (user, creator, platform).

---

## Escrow-Key Flow (Individualized Ad Example)

1. **Advertiser** creates campaign, funds **CampaignEscrow** (or message-specific escrow).
2. **Ad** is a **message**:
   - Target: user’s registered key(s).
   - **Condition**: User accepts funds **only if** they watch the ad.
   - Message references **escrow** and **release rule** (prorata by watch).
3. **User** receives message (e.g. in DLUX inbox or sandbox pre-dApp gate).
4. **User watches** ad; client sends **progress** (e.g. 0.25 → 0.5 → 1.0) via `/notify/ack`.
5. **Verifier** (ZK or attested) validates progress; **release amount** = `bid × progress` (e.g. up to 100%).
6. **On-chain**: Escrow releases that amount; revenue split (creator, foundation, PM) follows existing **revenue distribution** logic where applicable.

Same pattern applies to **tip-for-reading** DMs: message references escrow, user “consumes” message, prorata release.

---

## Privacy and Consent

- **Keys**: Users explicitly **register** keys; no notification without a registered key.
- **Consent**: Accepting **escrow-backed** messages is **conditional on watch/read**; this is made clear in UI.
- **Targeting**: Retain **privacy-preserving** ad targeting (e.g. ZK, homomorphic) so that **who** is targeted is not leaked; **delivery** is key-based.

---

## Implementation Notes

- **Where it lives**: New **notify / user-webhook** service, or new routes in an extended **webhook service** (keeping GitHub deploy routes separate).
- **Storage**: Message metadata and optional encrypted payloads (e.g. Walrus, Seal) vs on-chain-only refs; inbox and delivery state in DGraph or dedicated store.
- **Contracts**: Extend **ad_payments** (or add **message_escrow** module) for **prorata release** driven by verified progress.
- **dApp webhooks**: Verify dApp identity (e.g. verified dApp id on SUI); sign webhook payloads; rate-limit and abuse controls.

---

## Summary

| Feature | Description |
|--------|-------------|
| **User public keys** | Register keys; messages target keys. |
| **Escrow-unlock messages** | Messages can reference escrow; consumption unlocks funds. |
| **Prorata release** | Release by watch/read progress; integrates with ad verification. |
| **Individualized ads** | Ad = message; accept funds conditional on watching; prorata. |
| **Direct messenger** | Same mechanic; optional escrow (e.g. tip for reading). |
| **dApp webhooks** | Any dApp can push/pull notify DLUX users. |

This design keeps **existing webhook service** (GitHub deploy) as-is and adds a **user-centric messaging and webhook layer** that connects **escrow**, **ads**, and **dApp notifications** into a single, key-based notification system.
