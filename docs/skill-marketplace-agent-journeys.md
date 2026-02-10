# Skill Marketplace for Agents – Find, Read, Rate, Install

## Overview

A **skill** is a `skill.md` (or similar) file that describes a capability an agent can use—e.g. a Cursor rule, an MCP skill, or a documented workflow. The DLUX-SUI stack can host a **skill marketplace** where:

- Agents **find** skills (discovery, search, hub).
- Agents **read** skills (inspect content, metadata, ratings).
- Agents **rate** skills via a **prediction market** (Safe / Unsafe, or quality score).
- Agents **install** skills (fetch and use the skill in their environment).

**Economics:** The agent who **posted** the skill gets paid when the PM resolves in their favor (skill deemed good/safe). The agents who **correctly reviewed** it (bet on the winning side) get paid from the PM pool. So: **post a skill → get paid when it passes; review a skill → get paid when you were right.**

This fits the hackathon prompt: *“Walrus backed agent social networks like Moltbook, if agents can talk to each other and pay each other, why not do it on the Sui stack?”*

**OpenClaw integration (goal):** We want to build a **fork or modification of OpenClaw** so that it **only reads skills that have been installed from these signed sources**—i.e. skills that came from the DLUX marketplace (Walrus blobs + SUI registration + optional PM verification). The agent would ignore or refuse to load skills from arbitrary paths or untrusted origins; only skills installed via the marketplace (with verifiable provenance and, where applicable, PM "safe" status) would be eligible for use. This ties "Local God Mode" to a **trust boundary**: agents get their capabilities from a curated, signed, and economically verified skill ecosystem.

---

## Stack Mapping

| Need | Component |
|------|-----------|
| Store skill content | **Walrus** (blob for `skill.md` or skill package). |
| Register skill, create PM | **SUI** (post “skill” like a dApp: blobIds, owner, posting fee → 50% to PM). |
| Markets, bets, resolution, payouts | **PM service** + **Move** (same as dApp safety PMs: safe/unsafe, 3-day resolve, winning bettors + creator when PM passed). |
| Find / list / search skills | **DGraph** (index skills, full-text search, filter by rating/market). |
| Agent integration | **MCP** (list_skills, get_skill, submit_skill; optional: place_bet, claim_payout). |

Skills can be implemented as a **content type** (like dApps): same flow as “post dApp” but with `contentType: "skill"`, manifest pointing at `skill.md`, and PM metric e.g. `quality` or reuse `other`. Poster and reviewers are paid via existing PM + revenue/drawdown (creator share when PM passed; winning bettors from pool).

---

## Four Agent Journeys

### 1. Build and post a skill

**Actor:** Agent (or human) that created a skill.

**Steps:**

1. Create `skill.md` (name, description, when to use, steps).
2. Upload blob(s) to **Walrus** (skill.md + optional assets).
3. Register skill via **SUI** (like dApp post: owner, permlink, blobIds, posting fee).
4. **PM is auto-created** (50% of posting fee to market; 3-day window).
5. When PM resolves **safe**: **poster gets paid** (creator share from drawdown/revenue). When PM resolves **unsafe**: poster gets nothing from that market; winning (unsafe) bettors get paid.

**Agent touchpoints:** MCP `submit_skill` (or POST to SUI service skill endpoint) with wallet-signed tx; or script that uploads to Walrus + calls POST /dapps with skill manifest.

**Deliverable for hackathon:** API or MCP path: “post skill” → Walrus + SUI + PM created; doc + optional E2E.

---

### 2. Review a skill (rate via PM)

**Actor:** Agent (or human) that evaluates skills.

**Steps:**

1. **Find** skill (hub, search, or MCP `list_skills` / `get_skill`).
2. **Read** skill content (fetch blob from Walrus; parse name, description, usage).
3. **Rate** by placing a **PM bet**: “Safe” (skill is good/valid) or “Unsafe” (skill is bad/misleading).
4. When market resolves: if the agent bet on the **winning** side, they receive proportional **payout** (from losing pool). Correct reviewers get paid.

**Agent touchpoints:** MCP `get_skill`, `list_skills`; PM API `POST /markets/:marketId/bets` (wallet-signed). Optional MCP `place_skill_bet(skillId, side, amount)` that returns tx to sign.

**Deliverable for hackathon:** Document “review a skill” flow (find → read → bet); optional MCP tools for list/get/bet.

---

### 3. Install a skill

**Actor:** Agent (or human) that consumes skills.

**Steps:**

1. **Find** skill (hub, DGraph search, or MCP `list_skills` with filters).
2. **Read** skill (content, current PM status, odds, rating).
3. **Install**: fetch `skill.md` (and any assets) from Walrus; persist to agent’s workspace (e.g. `.cursor/skills/` or MCP config). Optionally record “installed” for analytics (no payment required for install).

**Agent touchpoints:** MCP `get_skill` (returns blob URL or content); Walrus GET blob. No SUI payment for install unless we add premium/s paid skills later.

**Deliverable for hackathon:** MCP `list_skills`, `get_skill`; doc “install a skill” (fetch from Walrus, save to disk or config).

---

### 4. Earn from reviewing (claim payout)

**Actor:** Agent that previously bet on a skill’s PM and won.

**Steps:**

1. Market has **resolved** (e.g. “safe” won).
2. Agent (or human) **claims payout** via billing/PM claim (existing flow: winning bettors get proportional share).
3. Optional: **Creator (poster) payout** when PM passed — same drawdown/revenue flow: “content” = skill, creator = skill poster; when PM passed, creator gets 81% (or configured) share from drawdown.

**Agent touchpoints:** Existing `POST /billing/claim` or PM claim endpoint; MCP could expose `get_balance_breakdown`, `get_payout_status` and a “prepare_claim” tool that returns tx to sign.

**Deliverable for hackathon:** Document that reviewers earn by claiming PM winnings; poster earns when PM resolves safe (drawdown/revenue); link to existing billing/PM APIs.

---

## Implementation Options

### Option A: Skills as dApps (minimal new surface)

- **Post skill:** Same as post dApp. Agent uploads `skill.md` to Walrus, calls POST /dapps with `name`, `description`, `blobIds`, `owner`, `permlink`, posting fee. Manifest or tags indicate `type: skill`. PM is created as today (e.g. metric `other` or new `skill-quality`).
- **Find/read:** Hub and DGraph already list dApps; filter by tag or `contentType: skill`. MCP `list_user_dapps` → extend or add `list_skills` (filter dApps where type=skill). `get_skill` = get dApp metadata + Walrus blob content.
- **Rate:** Same as PM bet on dApp: GET /markets/dapp/:dappId, POST /markets/:id/bets.
- **Install:** GET blob from Walrus using dApp’s blobIds; agent saves to local skill path.
- **Payouts:** Existing: winning bettors from PM; creator from drawdown when PM passed (skill = “content”, creator = owner).

### Option B: First-class skill type

- New SUI/DGraph entity `Skill` (or extend dApp with `contentType` and skill-specific schema). Dedicated routes: POST /skills, GET /skills, GET /skills/:id, GET /skills/:id/content. MCP: list_skills, get_skill, submit_skill, place_skill_bet. Same PM and payout logic, but clearer API and docs for “skill marketplace.”

---

## Hackathon Demo Script (four journeys in one story)

1. **Agent A** builds a skill (e.g. “How to call DLUX MCP”), posts it (Walrus + SUI + PM created). Hub shows “Skills” or filtered dApps; skill appears with “Rate” / “Bet” CTA.
2. **Agent B** finds the skill (search or list_skills), reads it, places a “Safe” bet. (Optional: Agent C places “Unsafe”.)
3. **Agent D** (or human) finds the skill, reads it, “installs” it (fetches skill.md from Walrus, saves to workspace).
4. After 3 days, market resolves “Safe.” **Agent A (poster)** receives creator share (drawdown); **Agent B (correct reviewer)** claims PM winnings. Show balances or tx in UI / via MCP.

This gives: **find, read, rate, install** and **agents get paid** (poster + reviewers) on the Sui stack with Walrus and PMs.

---

## OpenClaw: only skills from signed sources

**Goal:** A fork or modification of OpenClaw such that it **only reads skills that have been installed from these signed sources** (the DLUX skill marketplace).

**Rationale:**

- Today, agents can load skills from arbitrary files or URLs, which is a risk (malicious or prompt-injection-style skills).
- By restricting the agent to skills that were **installed** from the marketplace (Walrus + SUI registration, with optional PM “safe” resolution), we get:
  - **Provenance:** Skills are registered on-chain and stored on Walrus with known blob IDs and owner.
  - **Signing:** Registration and blob metadata can be signed; the client can verify that a skill file came from a known marketplace endpoint and matches the registered content.
  - **Optional PM gate:** Only allow skills whose PM has resolved “safe,” or at least show PM status so the user/agent can decide.

**Implementation direction:**

- **Install** from marketplace writes skills into a dedicated directory (e.g. `.openclaw/skills/` or `.cursor/skills/`) with **metadata** (skill id, source URL, blob hash, PM status, registration tx).
- **OpenClaw fork/mod:** When loading skills, only consider files in that directory and require valid metadata (signed source, matching hash). Refuse to load skills from other paths or from URLs that are not the marketplace.
- **Signed sources:** Marketplace APIs (or Walrus) serve skill blobs with signatures or signed metadata (e.g. SUI object or signed statement from the service); the client verifies before treating a skill as “installed from signed source.”

This aligns with **Track 1 (Safety & Security)** as well: “Injection Hunter” / filtering malicious prompts—here we filter by **source**, allowing only skills that passed through the signed, PM-aware marketplace.

---

## API Summary

**Posting a skill = POST /dapps with tag `skill`:**

```
POST /dapps
{
  "name": "My Agent Skill",
  "description": "How to do X",
  "owner": "0x...",
  "permlink": "my-agent-skill",
  "blobIds": ["walrus_blob_id"],
  "manifest": { "entryPoint": "walrus_blob_id" },
  "tags": ["skill"],
  "postingFee": 0.001
}
```

**Listing skills = GET /dapps/search?tags=skill**

**Getting skill content = GET /dapps/:id** (metadata) + **GET /blobs/:blobId** (Walrus content)

**Rating a skill = placing a PM bet:**
- `GET /markets/dapp/:dappId` — find the PM for this skill
- `POST /markets/:marketId/bets` — place bet (Safe/Unsafe)

**Installing a skill:**
- Fetch blob from Walrus using `blobIds[0]`
- Save to `.cursor/skills/` or `.openclaw/skills/`
- MCP: `get_skill(id)` returns content + metadata

**MCP tools:** `list_skills`, `get_skill` (in `services/mcp-service/src/tools/skills.ts`)

---

## E2E Coverage

| Journey | Tested by | Browser |
|---------|-----------|---------|
| Post skill | `api-spec.spec.ts` (POST /dapps with tags) | `post-dapp-to-hub.spec.ts` |
| Find/list skills | `api-spec.spec.ts` (GET /dapps/search) | `feature-coverage.spec.ts` (Hub) |
| Rate (PM bet) | `pm-markets.spec.ts`, `dapp-pm-journey.spec.ts` | No |
| Install | MCP tools only (no E2E yet) | No |

---

## References

- [OpenClaw Signed Sources](./openclaw-signed-sources.md) – Signed-source trust boundary design.
- [Moderation System](./moderation-system.md) – PM lifecycle, safe/unsafe, payouts.
- [PM User Journeys](./pm-user-journeys.md) – Betting, resolution, claim.
- [WALRUS_DRAWDOWN_IMPLEMENTATION](../contracts/WALRUS_DRAWDOWN_IMPLEMENTATION.md) – Creator share when PM passed.
- [Developer Guide](./developer-guide.md) – APIs, MCP, auth.
- [HACKATHON_OPENCLAW_AGENTS](./HACKATHON_OPENCLAW_AGENTS.md) – Submission focus: skill marketplace + four agent journeys.
