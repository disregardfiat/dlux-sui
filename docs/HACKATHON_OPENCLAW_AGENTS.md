# OpenClaw “Calling All Agents” Hackathon – DLUX-SUI Action Plan

**Hackathon:** [DeepSurge – Calling All Agents](https://www.deepsurge.xyz/hackathons/cd96178d-5e11-4d56-9f02-1bf157de2552/register)  
**Submission deadline:** 2026-02-11 23:00 PST (2026-02-12 07:00 UTC)  
**Prize:** $20k total; Track 1 & 2 top 5 each get $1,900; 5× Community Favourite $200 each (USDC on Sui)

This doc maps the hackathon brief to this repo and lists what to develop, test, and submit to compete.

---

## 1. Project focus: Skill marketplace for agents (Track 2)

**Best fit:** A **skill marketplace** where agents **find, read, rate, and install** `skill.md`-style skills—with **payment via prediction markets**: the agent who **posted** the skill gets paid when the PM resolves in their favor, and the agents who **correctly reviewed** it (bet on the winning side) get paid too.

**Four agent journeys:**

| # | Journey | What happens | Who gets paid |
|---|--------|---------------|----------------|
| 1 | **Build and post a skill** | Agent creates skill.md → uploads to Walrus → registers on SUI (posting fee) → PM auto-created | Poster gets paid when PM resolves **safe** (creator share) |
| 2 | **Review a skill** | Agent finds skill → reads content → places PM bet (Safe/Unsafe) | Correct reviewers get paid when market resolves (winning bettors) |
| 3 | **Install a skill** | Agent finds skill → reads it → fetches blob from Walrus → saves to workspace | No payment; consumption only |
| 4 | **Earn from reviewing** | Agent claims PM winnings (or poster claims creator share when PM passed) | Winning bettors + poster (when PM passed) |

Full design and flow: **[Skill Marketplace & Agent Journeys](./skill-marketplace-agent-journeys.md)**.

**OpenClaw fork / modification:** We want to build a **fork or modification of OpenClaw** so that it **only reads skills that have been installed from these signed sources** (the DLUX marketplace). The agent would refuse to load skills from arbitrary paths or untrusted URLs; only skills installed via the marketplace (Walrus + SUI registration, with verifiable provenance and optional PM "safe" status) would be eligible. This adds a **trust boundary** to "Local God Mode" and aligns with **Track 1 (Safety & Security)**—e.g. filtering by source so only signed, PM-aware skills are used. See the [Skill Marketplace](./skill-marketplace-agent-journeys.md#openclaw-only-skills-from-signed-sources) doc for implementation direction.

---

## 2. Which track(s) does DLUX-SUI target?

| Track | Fit | Rationale |
|-------|-----|------------|
| **Track 2: Local God Mode** | **Primary** | Brief: *“Walrus backed agent social networks like Moltbook, if agents can talk to each other and pay each other, why not do it on the Sui stack? We have all the components ready.”* The **skill marketplace** is the killer use case: skills on Walrus, PMs on Sui, agents post/rate/install and get paid. |
| **Track 1: Safety & Security** | **Optional** | Brief: *“Post cryptographic proof of each step of openclaw bot's reasoning on walrus, encrypted by seal for privacy.”* OpenClaw fork (only signed sources); Walrus + Seal; could add “reasoning trace” blobs. |

**Recommendation:** Submit **one strong Track 2 project** centered on the **skill marketplace** (find, read, rate, install + PM payouts to poster and reviewers). Optionally include the OpenClaw fork (only signed sources) and Track 1 (reasoning trace) as additional angles.

---

## 3. Eligibility checklist (all required)

| Requirement | Status | Action |
|-------------|--------|--------|
| Submit to DeepSurge | ❌ | Register and submit before deadline. |
| Developed by / mostly by AI agents after hackathon starts | ✅ | Document agent involvement in submission. |
| Use ≥1 Sui Stack component | ✅ | SUI blockchain, Move contracts, Walrus; document in submission. |
| Working demo verifiable by humans | ⚠️ | At least one of the four skill journeys (post / review / install / earn) runnable and documented; see below. |
| Complete DeepSurge profile + Sui wallet | ❌ | [Create account](https://www.deepsurge.xyz/create-account), add wallet, complete profile. |

---

## 4. What to build and test for the skill marketplace (Track 2)

Goal: **Demonstrate the four agent journeys** (build & post skill, review skill, install skill, earn from reviewing) so judges can **find, read, rate, install** and see **poster + reviewers get paid via PM**.

### 4.1 Already in place (leverage these)

- **Walrus:** Blob storage — store `skill.md` (today as dApp blob or generic blob).
- **SUI + PM:** Post content with posting fee → 50% to PM; 3-day resolve; winning bettors paid; creator share when PM passed (drawdown).
- **DGraph:** Index content, markets, safety; search and list.
- **MCP:** Read-only tools (account, dApps, ads, analytics); can add `list_skills`, `get_skill`.
- **Hub/UI:** List dApps, PM cards (bet/claim), detail page; can treat “skills” as dApps with tag/type `skill` or add a Skills view.
- **Existing skill.md:** `frontend/vue-app/public/skill.md` and hero link (“my skill.md is at /skill.md”) — shows intent; extend to **many** skills in a marketplace.

### 4.2 Build list (skill marketplace)

1. **Skills as postable content (journey 1: build & post)**  
   - **Option A:** Use “post dApp” with skill.md blob and tag/type `skill` (minimal change). Document: “Posting a skill = post dApp with manifest pointing at skill.md; PM is created; poster gets paid when PM resolves safe.”  
   - **Option B:** Dedicated `POST /skills` (or MCP `submit_skill`) that uploads blob to Walrus and registers like a dApp with `contentType: skill`.  
   - **Deliverable:** One documented path (API or MCP) for an agent to post a skill → appears in hub/list → PM created.

2. **Find & read skills (journeys 2 & 3)**  
   - **List/filter:** Hub or API lists “skills” (dApps with type=skill, or GET /skills). MCP: `list_skills` (and optionally `get_skill` returning blob URL or content).  
   - **Read:** GET skill content from Walrus (blobId from dApp/skill record).  
   - **Deliverable:** Agents can discover and read skills (hub, API, or MCP).

3. **Rate a skill (journey 2: review)**  
   - Reuse PM bet: GET /markets/dapp/:dappId (or /markets/skill/:skillId), POST /markets/:id/bets with side Safe/Unsafe.  
   - **Deliverable:** Document “review a skill = place PM bet”; optional MCP `place_skill_bet` that returns tx to sign.

4. **Install a skill (journey 3)**  
   - “Install” = fetch skill blob from Walrus and (in doc or script) save to agent workspace (e.g. `.cursor/skills/`). No SUI payment.  
   - **Deliverable:** Doc + optional MCP `get_skill` that returns content or blob URL so an agent can install.

5. **Earn from reviewing / poster payout (journey 4)**  
   - Already in place: winning bettors claim via PM/billing; creator (poster) gets share when PM passed (drawdown).  
   - **Deliverable:** Document that “reviewers get paid when they bet correctly; poster gets paid when PM resolves safe”; link to existing claim/safety APIs.

6. **Demo stability & narrative**  
   - One “gold” path: e.g. post one skill (via API or UI) → show in hub → another agent (or human) places bet and/or installs → after resolve (or in doc), show payouts.  
   - **Submission one-pager:** “DLUX-SUI skill marketplace: find, read, rate, install skill.md. Agents post skills (Walrus + SUI); PM pays the poster when the skill passes and pays reviewers who were right. Four agent journeys; demo at https://dlux.io (or https://test.dlux.io for staging).”

7. **OpenClaw fork / modification: only signed sources**  
   - Build a fork or modification of OpenClaw such that it **only reads skills that have been installed from these signed sources** (the DLUX marketplace).  
   - **Behavior:** When loading skills, only consider skills in the marketplace-install directory (e.g. `.openclaw/skills/`) with valid metadata (source URL, blob hash, PM status); refuse to load from other paths or untrusted URLs.  
   - **Deliverable:** Documented design + fork or patch; optional: working prototype that loads only marketplace-installed skills.  
   - **Track 1 overlap:** "Injection Hunter" / filtering by source—only skills that passed through the signed, PM-aware marketplace are trusted.

---

## 5. Optional Track 1 angle (Safety: reasoning trace on Walrus + Seal)

- **Idea:** “Agent posts cryptographic proof of each step of its reasoning to Walrus; data encrypted with Seal for privacy.”  
- **Existing pieces:** Walrus blob upload; Seal used for premium content (encrypt → store → grant access).  
- **To add:**  
  - A small “reasoning trace” API or MCP tool: e.g. `POST /reasoning-trace` or MCP `submit_reasoning_trace` that accepts a blob (proof or log), encrypts it with Seal (or reuses existing Seal flow), uploads to Walrus, returns blob ID / Seal object ID.  
  - Short doc: “Agent accountability: post private reasoning trace to DLUX via Walrus + Seal.”  
- **Submission:** Second project on DeepSurge (Track 1), if built.

---

## 6. What to test before submission

- **Run E2E vs dlux.io (production) or test.dlux.io (staging):**  
  `E2E_BASE_URL=https://dlux.io npx playwright test feature-coverage dapp-pm-journey skill-marketplace-journey --project=chromium`  
  (skill-marketplace-journey.spec.ts is the gold spec for skill lifecycle).
- **Run MCP server:** Start mcp-service; call `get_account_overview`, `list_user_dapps` (and `list_skills` / `get_skill` when added); confirm responses.
- **Document the exact steps** a judge should follow for at least one of the four skill journeys (post / review / install / earn).

---

## 7. DeepSurge and timeline

| By when | Action |
|---------|--------|
| ASAP | Create/complete DeepSurge account, profile, Sui wallet. |
| Before 2026-02-11 23:00 PST | Implement skill marketplace: post skill (dApp-type or /skills), list/get skills (hub + MCP), review = PM bet, install = fetch blob; document four journeys; optional Track 1 reasoning-trace. |
| Before deadline | Submit project to [hackathon registration](https://www.deepsurge.xyz/hackathons/cd96178d-5e11-4d56-9f02-1bf157de2552/register): title, description, repo link, **working demo** (e.g. https://dlux.io + skill marketplace doc or video), Sui Stack components used. |
| After shortlist | Phase 2: Cross-track voting; Phase 3: Community Favourite (if not in top 5). |

---

## 8. Judge / Suixclaw evaluation (from brief)

- **Eligibility:** Sui Stack usage, working demo, DeepSurge profile.  
- **Technical merit:** Architecture (Walrus + SUI + DGraph + MCP), APIs, optional Seal for privacy.  
- **Creativity:** Skill marketplace is a concrete “agents talk and pay each other” use case: find, read, rate, install skills; poster and reviewers get paid via PM.  
- **Sui integration:** Move contracts, SUI txs (post skill like dApp, PMs, billing), Walrus blobs (skill.md), Seal (premium or reasoning trace).

---

## 9. Quick reference – Sui Stack in this repo

| Component | Where |
|-----------|--------|
| SUI blockchain | dApp registration, SuiNS, PMs, governance, billing (claim), ZK linking. |
| Move contracts | `contracts/metadata_pm/` (dapp_posting, ad_campaigns, ad_payments, ad_tracking, revenue-distribution). |
| Walrus | Blob storage (dApps, assets); premium content (Seal-encrypted). |
| Seal | Premium content encryption; optional reasoning-trace encryption (Track 1). |
| MCP | `services/mcp-service/` – agent tools (account, ads, content, analytics). |
| APIs | SUI service 3001, DGraph 3003, Walrus 3002; see `docs/developer-guide.md` and `docs/index.md`. |

---

**Summary:** Focus on **Track 2** with the **skill marketplace**: agents **find, read, rate, install** skills; the **poster gets paid** when the PM resolves safe, and **reviewers get paid** when they bet correctly. Implement and document the **four agent journeys** (build & post, review, install, earn). See **[Skill Marketplace & Agent Journeys](./skill-marketplace-agent-journeys.md)** for full flow. Complete DeepSurge profile and submit before the deadline. Optionally add Track 1 “reasoning trace on Walrus + Seal” as a second submission.
