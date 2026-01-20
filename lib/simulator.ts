// Deterministic KV cache simulation logic.

import type { KVCell, KVReuseState } from "./kvModel";

export type SimulationMode = "prefill" | "decode";

/**
 * Simulate KV cache population for a token × layer grid.
 *
 * Mapping to real LLM inference:
 * - Prefill builds KV for every token across all layers in one pass.
 * - Decode adds one token at a time while reusing cached KV for prior tokens.
 */
export function simulateKVCells(
	tokenCount: number,
	layerCount: number,
	mode: SimulationMode
): KVCell[] {
	const cells: KVCell[] = [];

	for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex += 1) {
		for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
			let state: KVReuseState = "new";

			if (mode === "decode") {
				// In decode, the first token behaves like prefill; later tokens
				// reuse the previously stored KV entries for attention.
				state = tokenIndex === 0 ? "new" : "reused";
			}

			cells.push({
				tokenIndex,
				layerIndex,
				state,
			});
		}
	}

	return cells;
}
