import type { EvictionConfig, KVEntry, MultiKVEntry } from "@/core/types";
import { evictFullBlock } from "@/core/kvAllocator";

export function evict(state: { entries: KVEntry[] | MultiKVEntry[] }, config: EvictionConfig) {
	const entries = state.entries.map((e) => ({ ...e }));
	const skipBlockIndex = typeof config.skipPinnedBlock === "number" ? config.skipPinnedBlock : 0;
	evictFullBlock(entries, config, skipBlockIndex);
	return { ...state, entries };
}
