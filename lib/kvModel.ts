// Data model types for KV cache state (no UI/rendering logic).

import { EvictionPolicy } from "./constants";

/**
 * Whether a KV entry was created this step (prefill/first-time) or reused
 * during decode (attention reads past KV without re-allocating it).
 * 
 * Also tracks policy-specific states:
 * - "pinned": block is permanently retained (Pinned Prefix policy)
 * - "evicted": block was removed this step (visual feedback before removal)
 * - "inactive": block is retained but not read (Recent-N policy for tokens outside window)
 */
export type KVReuseState = "new" | "reused" | "pinned" | "evicted" | "inactive";

/**
 * Token position in the sequence.
 * Maps to the token index used for attention positions.
 */
export type TokenIndex = number;

/**
 * Transformer layer index (0-based).
 * Maps to the specific block where K/V are cached.
 */
export type LayerIndex = number;

/**
 * Single KV cache cell in the token × layer grid.
 * Each cell corresponds to K/V vectors stored for one token at one layer.
 */
export interface KVCell {
	/** Token position for which K/V are stored. */
	tokenIndex: TokenIndex;
	/** Layer where the K/V vectors reside. */
	layerIndex: LayerIndex;
	/** Indicates whether this step created KV, reused prior KV, or is pinned. */
	state: KVReuseState;
}

/**
 * Minimal snapshot of the KV cache grid at a single simulation step.
 * Extensible to include per-head, dtype, or memory footprint later.
 */
export interface KVSnapshot {
	/** Monotonic step index within a simulation run. */
	stepIndex: number;
	/** All KV cells currently present or touched at this step. */
	cells: KVCell[];
}

/**
 * Block-based KV cache entry with policy-aware metadata.
 */
export interface KVEntry {
	token: string;
	/** Reflects current block status based on eviction policy. */
	status: "empty" | "new" | "reused" | "pinned" | "evicted";
	/** Slot index in the linear cache (for policy calculations). */
	slotIndex?: number;
	/** If true, this block is pinned and will never be evicted (Pinned Prefix policy). */
	isPinned?: boolean;
	/** If true, block is within the active window (Recent-N policy). */
	inWindow?: boolean;
}
