# Modes

Mode containers own state, timers, and user interactions. They call the core stepper and pass results into UI components.

## SinglePromptSimulator

- One prompt sequence.
- Prefill writes tokens sequentially.
- Decode reads KV and writes one token per step.

## MultiPromptSimulator (Continuous Batching)

- Multiple prompts in flight.
- Prefill is prompt-aligned (no mixed blocks).
- Decode adds one token per prompt each step.

## Shared Abstractions

- `/core` provides step functions and allocation helpers.
- `/prompts` provides tokenization and prompt stream construction.
