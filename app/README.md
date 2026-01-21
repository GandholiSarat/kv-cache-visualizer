# App Router Layer

This folder hosts the Next.js App Router entrypoints.

## Responsibilities

- `page.tsx` chooses between Single Prompt and Multi Prompt modes.
- `layout.tsx` provides global layout + styles.

## Philosophy

The App Router layer should remain thin. It wires high‑level mode containers and avoids simulation logic.
