// Shared, UI-agnostic types for KV cache simulation.

export type SimulationMode = "prefill" | "decode";
export type Phase = "prefill" | "decode-read" | "decode-write";

export type KVEntryStatus = "empty" | "new" | "reused" | "pinned" | "evicted" | "inactive";

export interface KVEntry {
	token: string;
	status: KVEntryStatus;
	slotIndex?: number;
	isPinned?: boolean;
	inWindow?: boolean;
	writeId?: number;
}

export type MultiKVEntryStatus = KVEntryStatus;

export interface MultiKVEntry {
	token: string;
	status: MultiKVEntryStatus;
	promptId?: number;
	promptPos?: number;
	writeId?: number;
}

export interface BlockConfig {
	blockCount: number;
	blockCapacity: number;
}

export interface PolicyContext {
	mode: SimulationMode;
	phase: Phase;
	recentNWindow: number;
}

export interface EvictionConfig extends BlockConfig {
	skipPinnedBlock?: number | null;
}
