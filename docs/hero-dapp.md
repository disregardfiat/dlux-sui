# Hero dApp — DLUX Explorer & Ethos

The **hero-dapp** is a minimal, expo-style dApp that serves as dlux platform explorer and ethos documentation. It is a valid dApp (HTML entry point, static assets) that can be posted to the hub and served from the sandbox.

## Purpose

- **Explorer**: Quick “what’s possible” overview for users and developers.
- **Ethos**: Platform principles in punchy bullet form.
- **User journeys**: Four short, example stories (XR Hobbyist, Indie Creator, Local AI Tinkerer, Mirror Operator) in card format.

## Contents

1. **Platform Ethos** — Bullet list covering:
   - Sandboxed, creator-keyed dApps
   - Verified XR content offline (3D, digital twins, local AI `skill.md`)
   - Stake-backed trust (prediction markets, slashing)
   - Fair earnings (ZK ads, revenue split, viral first 3 days)
   - No native token; merit governance; mirrors (9% cut)
   - Clear NSFW labeling; build clean or get pruned

2. **Example user journeys** (cards):
   - **XR Hobbyist (Quest owner)** — Offline digital twin, local AI skill, ZK ads.
   - **Indie XR Creator** — Post dApp in minutes, PM verification, ad revenue, mirror cuts.
   - **Local AI Tinkerer** — Integrate `skill.md`, post custom skill, governance vote.
   - **Mirror Operator** — Run mirror node, 9% ad revenue, no content creation.

## Location and structure

- **Path**: `hero-dapp/` in the repo root.
- **Entry**: `index.html` (required for dApp definition).
- **Assets**: `index.css`, `index.js` (linked from HTML).

The dApp is self-contained and uses no external runtime dependencies beyond optional web fonts. It is suitable for expo-style showcase, cards, or simple slides.

## Documentation

This feature is documented for [dlux.io/docs](https://dlux.io/docs). The canonical docs index is [Documentation Index](./index.md#documentation-index).
