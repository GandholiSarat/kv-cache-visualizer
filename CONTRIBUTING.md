# Contributing Guide

Thanks for your interest in improving the KV Cache Visualizer. This project is an educational simulator focused on conceptual accuracy and clear visuals.

## How to Run Locally

1. Install Node.js 20+.
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Optional checks: `npm run lint` and `npm run build`

## Coding Conventions

- TypeScript, React, Next.js App Router.
- Prefer small, composable functions.
- Keep UI components presentational and prop-driven.
- Core logic must be pure (no React, no DOM, no timers).

## Simulator Philosophy

- This is **conceptual**, not numerically accurate.
- Storage ≠ Attention. Recent‑N limits attention, not memory.
- Prefill is batch-parallel; decode is autoregressive.
- Deterministic stepping is a hard requirement.

## Where to Add Features

### New Eviction Policies

- Add policy logic in `/eviction` and wire it in `/core/evictionPolicies.ts`.
- Do **not** add policy logic to UI components.

### New Visual States

- Add new status types in `/core/types.ts`.
- Keep rendering changes inside `/components`.

### New Modes

- Create a new container in `/modes`.
- Reuse `/core` for stepping logic where possible.

## Visual Testing

- Use the UI to compare before/after screenshots.
- Step through prefill → decode → eviction for every policy.
- Verify Recent‑N counters reflect attention reads vs retained KV.

## Pull Request Guidelines

- Keep PRs small and focused.
- Include a short summary and rationale.
- Add screenshots for any visual change.

## Commit Message Conventions

- `docs:` documentation-only changes
- `refactor:` structural changes without behavior impact
- `feat:` new functionality (avoid unless explicitly requested)
- `fix:` behavior or correctness fix
