import { EvictionPolicy } from "@/lib/constants";
import type { EvictionConfig, KVEntry, MultiKVEntry, KVEntryStatus, MultiKVEntryStatus } from "./types";
import * as SlidingWindowPolicy from "@/eviction/SlidingWindowPolicy";
import * as PinnedPrefixPolicy from "@/eviction/PinnedPrefixPolicy";
import * as RecentNPolicy from "@/eviction/RecentNPolicy";

export function evictByPolicy(
	policy: EvictionPolicy,
	state: { entries: KVEntry[] | MultiKVEntry[] },
	config: EvictionConfig
): { entries: KVEntry[] | MultiKVEntry[] } {
	switch (policy) {
		case EvictionPolicy.PinnedPrefix:
			return PinnedPrefixPolicy.evict(state, config);
		case EvictionPolicy.RecentN:
			return RecentNPolicy.evict(state, config);
		case EvictionPolicy.SlidingWindow:
		default:
			return SlidingWindowPolicy.evict(state, config);
	}
}

export function applySinglePromptPolicyVisuals(
	entries: KVEntry[],
	policy: EvictionPolicy,
	isDecodeRead: boolean,
	recentNWindow: number
): KVEntry[] {
	if (policy === EvictionPolicy.PinnedPrefix) {
		return entries.map((e, idx) => {
			if (idx === 0 && e.status !== "empty" && e.status !== "evicted" && e.status !== "pinned") {
				return { ...e, status: "pinned" as KVEntryStatus, isPinned: true };
			}
			return e;
		});
	}

	if (policy === EvictionPolicy.RecentN) {
		if (isDecodeRead) {
			const occupied: Array<{ idx: number; writeId: number }> = [];
			let newestWriteId = -1;
			for (let i = 0; i < entries.length; i++) {
				const st = entries[i].status;
				if (st === "empty" || st === "evicted") continue;
				const writeId = typeof entries[i].writeId === "number" ? entries[i].writeId! : -1;
				newestWriteId = Math.max(newestWriteId, writeId);
				occupied.push({ idx: i, writeId });
			}

			occupied.sort((a, b) => a.writeId - b.writeId);
			const recentCount = Math.min(occupied.length, recentNWindow);
			const recentSet = new Set<number>(occupied.slice(Math.max(0, occupied.length - recentCount)).map((x) => x.idx));

			return entries.map((e, idx) => {
				if (e.status === "empty" || e.status === "evicted") return e;
				const writeId = typeof e.writeId === "number" ? e.writeId : -1;
				if (e.status === "new" && writeId === newestWriteId) return { ...e, inWindow: true };
				if (recentSet.has(idx)) {
					return { ...e, status: "reused" as KVEntryStatus, inWindow: true };
				}
				return { ...e, status: "inactive" as KVEntryStatus, inWindow: false };
			});
		}

		return entries.map((e) => {
			if (e.status !== "empty" && e.status !== "evicted") {
				return { ...e, inWindow: true };
			}
			return e;
		});
	}

	return entries;
}

export function applyMultiPromptPolicyVisuals(
	entries: MultiKVEntry[],
	policy: EvictionPolicy,
	isDecodeRead: boolean,
	recentNWindow: number
): MultiKVEntry[] {
	if (policy === EvictionPolicy.PinnedPrefix) {
		return entries.map((e, idx) => {
			if (idx === 0 && e.status !== "empty" && e.status !== "pinned" && e.status !== "evicted") {
				return { ...e, status: "pinned" as MultiKVEntryStatus };
			}
			return e;
		});
	}

	if (policy === EvictionPolicy.RecentN && isDecodeRead) {
		const nonEmptyIndices: number[] = [];
		for (let i = 0; i < entries.length; i++) {
			const st = entries[i].status;
			if (st !== "empty" && st !== "evicted") nonEmptyIndices.push(i);
		}

		const recentCount = Math.min(nonEmptyIndices.length, recentNWindow);
		const recentStartIdx = nonEmptyIndices.length - recentCount;

		return entries.map((e, idx) => {
			if (e.status === "empty" || e.status === "evicted") return e;
			const positionInNonEmpty = nonEmptyIndices.indexOf(idx);
			if (positionInNonEmpty >= recentStartIdx) {
				return { ...e, status: "reused" as MultiKVEntryStatus };
			}
			return { ...e, status: "inactive" as MultiKVEntryStatus };
		});
	}

	return entries;
}
