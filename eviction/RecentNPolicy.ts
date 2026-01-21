import type { EvictionConfig, KVEntry, MultiKVEntry } from "@/core/types";
import { evictFullBlock } from "@/core/kvAllocator";

export function evict(state: { entries: KVEntry[] | MultiKVEntry[] }, config: EvictionConfig) {
	const entries = state.entries.map((e) => ({ ...e }));
	evictFullBlock(entries, config, config.skipPinnedBlock ?? null);
	return { ...state, entries };
}
