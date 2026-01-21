import type { BlockConfig, KVEntryStatus, MultiKVEntry, KVEntry, MultiKVEntryStatus } from "./types";

export function isFreeStatus(status: KVEntryStatus | MultiKVEntryStatus): boolean {
	return status === "empty" || status === "evicted";
}

export function blockSlice(blockIndex: number, blockCapacity: number): { start: number; end: number } {
	const start = blockIndex * blockCapacity;
	return { start, end: start + blockCapacity };
}

export function blockOccupiedCount<T extends { status: KVEntryStatus | MultiKVEntryStatus }>(
	entries: T[],
	blockIndex: number,
	blockCapacity: number
): number {
	const { start, end } = blockSlice(blockIndex, blockCapacity);
	let occupied = 0;
	for (let i = start; i < end; i++) {
		if (!isFreeStatus(entries[i].status)) occupied++;
	}
	return occupied;
}

export function blockHasAnyOccupied<T extends { status: KVEntryStatus | MultiKVEntryStatus }>(
	entries: T[],
	blockIndex: number,
	blockCapacity: number
): boolean {
	return blockOccupiedCount(entries, blockIndex, blockCapacity) > 0;
}

export function findFirstFreeInBlock<T extends { status: KVEntryStatus | MultiKVEntryStatus }>(
	entries: T[],
	blockIndex: number,
	blockCapacity: number
): number {
	const { start, end } = blockSlice(blockIndex, blockCapacity);
	for (let i = start; i < end; i++) {
		if (isFreeStatus(entries[i].status)) return i;
	}
	return -1;
}

export function isBlockCompletelyFree<T extends { status: KVEntryStatus | MultiKVEntryStatus }>(
	entries: T[],
	blockIndex: number,
	blockCapacity: number
): boolean {
	return blockOccupiedCount(entries, blockIndex, blockCapacity) === 0;
}

export function isBlockFull<T extends { status: KVEntryStatus | MultiKVEntryStatus }>(
	entries: T[],
	blockIndex: number,
	blockCapacity: number
): boolean {
	return blockOccupiedCount(entries, blockIndex, blockCapacity) >= blockCapacity;
}

export function getBlockLastWriteId<T extends { status: KVEntryStatus | MultiKVEntryStatus; writeId?: number }>(
	entries: T[],
	blockIndex: number,
	blockCapacity: number
): number {
	const { start, end } = blockSlice(blockIndex, blockCapacity);
	let maxId = -1;
	for (let i = start; i < end; i++) {
		const anyEntry = entries[i];
		if (!isFreeStatus(anyEntry.status) && typeof anyEntry.writeId === "number") {
			maxId = Math.max(maxId, anyEntry.writeId);
		}
	}
	return maxId;
}

export function findWriteSlotSingle(entries: KVEntry[], config: BlockConfig): number {
	// 1) Fill existing empty slots inside already-used (active) blocks first.
	for (let b = 0; b < config.blockCount; b++) {
		if (!blockHasAnyOccupied(entries, b, config.blockCapacity)) continue;
		const slot = findFirstFreeInBlock(entries, b, config.blockCapacity);
		if (slot >= 0) return slot;
	}
	// 2) Allocate a new block (first slot in a completely free block).
	for (let b = 0; b < config.blockCount; b++) {
		if (!isBlockCompletelyFree(entries, b, config.blockCapacity)) continue;
		return b * config.blockCapacity;
	}
	// 3) No space: caller must evict a full block.
	return -1;
}

export function getBlockSingleOwnerPromptId(entries: MultiKVEntry[], blockIndex: number, blockCapacity: number): number | null {
	const { start, end } = blockSlice(blockIndex, blockCapacity);
	let owner: number | null = null;
	for (let i = start; i < end; i++) {
		const e = entries[i];
		if (isFreeStatus(e.status)) continue;
		if (typeof e.promptId !== "number") continue;
		if (owner === null) owner = e.promptId;
		else if (owner !== e.promptId) return null;
	}
	return owner;
}

export function findWriteSlotPrefillMulti(entries: MultiKVEntry[], config: BlockConfig, promptId: number): number {
	// Prefill invariant: blocks are prompt-aligned.
	// 1) Continue filling an existing block owned by this prompt, if it has space.
	for (let b = 0; b < config.blockCount; b++) {
		const owner = getBlockSingleOwnerPromptId(entries, b, config.blockCapacity);
		if (owner !== promptId) continue;
		const slot = findFirstFreeInBlock(entries, b, config.blockCapacity);
		if (slot >= 0) return slot;
	}

	// 2) Otherwise allocate a new, completely free block for this prompt.
	for (let b = 0; b < config.blockCount; b++) {
		if (isBlockCompletelyFree(entries, b, config.blockCapacity)) return b * config.blockCapacity;
	}
	return -1;
}

export function findWriteSlotDecodeMulti(entries: MultiKVEntry[], config: BlockConfig, promptId: number): number {
	// Decode invariant: blocks are prompt-owned.
	// 1) Identify blocks currently owned by this prompt.
	let tailBlock: number | null = null;
	let tailLastWriteId = -1;
	for (let b = 0; b < config.blockCount; b++) {
		if (getBlockSingleOwnerPromptId(entries, b, config.blockCapacity) !== promptId) continue;
		const last = getBlockLastWriteId(entries, b, config.blockCapacity);
		if (last > tailLastWriteId) {
			tailLastWriteId = last;
			tailBlock = b;
		}
	}

	// 2) Try to use the tail block if it has space.
	if (tailBlock !== null) {
		const slot = findFirstFreeInBlock(entries, tailBlock, config.blockCapacity);
		if (slot >= 0) return slot;
	}

	// 3) Allocate a fresh block for this prompt.
	for (let b = 0; b < config.blockCount; b++) {
		if (isBlockCompletelyFree(entries, b, config.blockCapacity)) return b * config.blockCapacity;
	}
	return -1;
}

export function evictFullBlock<T extends { status: KVEntryStatus | MultiKVEntryStatus }>(
	entries: T[],
	config: BlockConfig,
	skipBlockIndex?: number | null
): boolean {
	const candidateBlocks: number[] = [];
	for (let b = 0; b < config.blockCount; b++) {
		if (typeof skipBlockIndex === "number" && b === skipBlockIndex) continue;
		if (isBlockFull(entries, b, config.blockCapacity)) candidateBlocks.push(b);
	}
	if (candidateBlocks.length === 0) return false;

	// Evict the oldest full block (by last write id).
	let victim = candidateBlocks[0];
	let victimLast = getBlockLastWriteId(entries as Array<{ status: KVEntryStatus | MultiKVEntryStatus; writeId?: number }>, victim, config.blockCapacity);
	for (const b of candidateBlocks.slice(1)) {
		const last = getBlockLastWriteId(entries as Array<{ status: KVEntryStatus | MultiKVEntryStatus; writeId?: number }>, b, config.blockCapacity);
		if (victimLast < 0 || (last >= 0 && last < victimLast)) {
			victim = b;
			victimLast = last;
		}
	}

	const { start, end } = blockSlice(victim, config.blockCapacity);
	for (let i = start; i < end; i++) {
		if (!isFreeStatus(entries[i].status)) {
			entries[i] = { ...entries[i], status: "evicted" as KVEntryStatus };
		}
	}
	return true;
}
