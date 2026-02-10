# OpenClaw Signed Sources — Design Document

## Summary

This document specifies how an OpenClaw fork/mod restricts skill loading to **signed sources only** — skills installed from the DLUX marketplace with verifiable provenance (Walrus blobs + SUI registration + optional PM verification).

## Problem

Today, agents can load skills from arbitrary files or URLs. This is a risk:

- Malicious skills can inject harmful prompts
- No provenance: who authored the skill? When? Is it vetted?
- No economic incentive to review or maintain quality

## Solution: Signed-Source Trust Boundary

Agents may only use skills that were **installed from the DLUX marketplace** and stored in a dedicated directory with valid metadata.

### Install Flow

1. Agent discovers skill via MCP `list_skills` or Hub UI
2. Agent fetches skill content via MCP `get_skill` (reads blob from Walrus)
3. Skill is saved to the **install directory** with a metadata sidecar:

```
.openclaw/skills/
  skill-abc123/
    skill.md          # The actual skill content
    metadata.json     # Provenance metadata (see below)
```

### Metadata Format (`metadata.json`)

```json
{
  "skillId": "abc123",
  "name": "How to call DLUX MCP",
  "owner": "0x...",
  "permlink": "dlux-mcp-howto",
  "blobIds": ["walrus_blob_abc"],
  "contentHash": "sha256:abcdef...",
  "sourceUrl": "https://dlux.io/dapps/abc123",
  "walrusBlobUrl": "https://walrus.dlux.io/blobs/walrus_blob_abc",
  "registrationTx": "0x...",
  "pmStatus": "passed",
  "pmMarketId": "mkt_xyz",
  "installedAt": "2026-02-06T12:00:00Z",
  "installedBy": "mcp-service"
}
```

### Required Fields

| Field | Description | Verification |
|-------|-------------|-------------|
| `skillId` | dApp ID from SUI service | Must match a registered dApp |
| `blobIds` | Walrus blob IDs | Content hash must match blob |
| `contentHash` | SHA-256 of skill.md content | Computed at install time; verified at load time |
| `sourceUrl` | Marketplace URL | Must be `https://dlux.io/dapps/...` |
| `registrationTx` | SUI transaction digest | Optional; proves on-chain registration |
| `pmStatus` | PM resolution status | `pending`, `passed`, `failed`, or `none` |

### Load-Time Verification

When OpenClaw loads a skill:

1. **Directory check:** Only read from `.openclaw/skills/` (or configured install dir)
2. **Metadata required:** Refuse to load any skill without `metadata.json`
3. **Hash verification:** Compute SHA-256 of `skill.md`; compare with `contentHash` in metadata
4. **Source check:** `sourceUrl` must match `https://dlux.io/dapps/*` pattern
5. **Optional PM gate:** If `pmStatus === 'failed'`, warn or refuse to load

Skills that fail any check are **ignored** with a warning log.

### PM Gate Modes

| Mode | Behavior |
|------|----------|
| `strict` | Only load skills where `pmStatus === 'passed'` |
| `warn` | Load all skills but warn on `pmStatus === 'failed'` or `'pending'` |
| `off` | No PM check (trust install provenance only) |

Default: `warn`

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌────────────┐
│  Agent / MCP    │────>│  DLUX Market │────>│  Walrus    │
│  list_skills    │     │  (SUI + PM)  │     │  (blobs)   │
│  get_skill      │     └──────────────┘     └────────────┘
│  install_skill  │             │
└────────┬────────┘             │ registration tx
         │                      │ PM status
         ▼                      ▼
┌─────────────────────────────────────┐
│  .openclaw/skills/                  │
│    skill-abc/                       │
│      skill.md       (blob content)  │
│      metadata.json  (provenance)    │
└──────────────────┬──────────────────┘
                   │
                   ▼ (load-time verification)
┌─────────────────────────────────────┐
│  OpenClaw Runtime                   │
│  - directory check                  │
│  - metadata required                │
│  - hash verification                │
│  - source URL check                 │
│  - optional PM gate                 │
└─────────────────────────────────────┘
```

## Hackathon Track Alignment

This design aligns with **Track 1 (Safety & Security)**:

- **Injection prevention:** Skills from untrusted sources are blocked
- **Provenance:** Every skill has verifiable origin (Walrus blob, SUI registration)
- **Economic verification:** PM resolution signals community trust
- **Signed sources:** Content hash prevents tampering after install

## Implementation Status

| Component | Status |
|-----------|--------|
| Skill marketplace doc | Done (`docs/skill-marketplace-agent-journeys.md`) |
| MCP `list_skills` | Done (`services/mcp-service/src/tools/skills.ts`) |
| MCP `get_skill` | Done (`services/mcp-service/src/tools/skills.ts`) |
| Install directory spec | Design only (this document) |
| OpenClaw fork/mod | Design only (this document) |
| Load-time verifier | Design only (this document) |

## References

- [Skill Marketplace Agent Journeys](./skill-marketplace-agent-journeys.md)
- [HACKATHON_OPENCLAW_AGENTS](./HACKATHON_OPENCLAW_AGENTS.md)
- [Moderation System](./moderation-system.md) — PM lifecycle
- [PM User Journeys](./pm-user-journeys.md) — Betting, resolution, claim
