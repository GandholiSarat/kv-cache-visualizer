KV Cache Inference Simulator
============================

A conceptual, client-side LLM inference simulator that visualizes KV cache behavior during prefill and decode.

What this is (and is not)
-------------------------
- This is a teaching tool for understanding KV cache mechanics in a transformer-style model.
- This is **not** real model inference and **not** a chatbot. All tokens and cache updates are simulated in the browser.

Concepts demonstrated
---------------------
- Prefill vs decode phases and how they write/read KV slots.
- KV cache reuse during streaming decode.
- Eviction policies:
  - Sliding Window
  - Pinned Prefix
  - Recent-N Tokens
- Attention window vs memory residency (why tokens can remain stored but not all are read during decode).

How to run locally
------------------
1. Install Node.js 20+.
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev` (http://localhost:3000)
4. Optional checks: `npm run lint` and `npm run build`

Tech stack
----------
- Next.js App Router (16)
- React 19 + TypeScript
- Tailwind CSS 4 for styling

Why this project exists
-----------------------
- Provide an educational, visual explanation of KV cache behavior without needing a real model or backend.
- Show how prefill, decode, and eviction policies interact so readers can map them to real LLM serving patterns.

Terminology and legend
----------------------
- `<gen>` appears once the prompt is consumed and represents a placeholder for a generated token; it does **not** come from a real model.
- Prompt symbols are treated as tokens to make cache writes explicit at the token level.
- Punctuation renders without leading spaces to mimic how tokenizers keep punctuation attached to the preceding token.

Notes
-----
- Everything runs entirely in the browser; no backend or external services are involved.
- The simulator is intentionally simplified to highlight cache mechanics rather than model quality.
