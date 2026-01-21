# Components

UI-only rendering components live here. Components receive state via props and do not mutate simulator state.

## Presentational vs Container

- Presentational components: pure renderers (blocks, slots, legend, panels).
- Container components: none in this folder (see `/modes`).

## KV Block Rendering

- **Block** = fixed-size page in paged KV memory.
- **Slot** = entry within a block.
- Status colors and borders map to KV state (new, reused, pinned, evicted, inactive).

## Slot Semantics

- **New**: KV written this step.
- **Reused**: KV attended during decode.
- **Inactive**: KV retained but not attended (Recent‑N).
- **Pinned**: KV locked in prefix.
- **Evicted**: KV cleared and about to be reallocated.
