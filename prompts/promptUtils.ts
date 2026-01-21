import type { BlockConfig } from "@/core/types";
import { blockSlice, getBlockSingleOwnerPromptId, isFreeStatus } from "@/core/kvAllocator";
import type { MultiKVEntry } from "@/core/types";

export type FlatToken = { promptId: number; token: string; promptPos: number };

export function tokenizePrompt(prompt: string): string[] {
	const tokens: string[] = [];
	let currentWord = "";

	for (let i = 0; i < prompt.length; i++) {
		const char = prompt[i];
		const isAlphanumericOrApostrophe = /[A-Za-z0-9']/.test(char);
		const isPunctuation = /[.,?!:;]/.test(char);

		if (isAlphanumericOrApostrophe) {
			currentWord += char;
		} else if (isPunctuation) {
			if (currentWord.trim()) {
				tokens.push(currentWord.trim());
				currentWord = "";
			}
			tokens.push(char);
		} else if (/\s/.test(char)) {
			if (currentWord.trim()) {
				tokens.push(currentWord.trim());
				currentWord = "";
			}
		}
	}

	if (currentWord.trim()) {
		tokens.push(currentWord.trim());
	}

	return tokens;
}

export function flattenPrefillStream(promptTokens: string[][]): FlatToken[] {
	const stream: FlatToken[] = [];
	for (let promptId = 0; promptId < promptTokens.length; promptId++) {
		const tokens = promptTokens[promptId];
		for (let i = 0; i < tokens.length; i++) {
			stream.push({ promptId, token: tokens[i], promptPos: i });
		}
	}
	return stream;
}

export function computePromptBlockOwnership(
	entries: MultiKVEntry[],
	promptCount: number,
	config: BlockConfig
): Map<number, number[]> {
	const ownership: Map<number, number[]> = new Map();
	for (let promptId = 0; promptId < promptCount; promptId++) {
		ownership.set(promptId, []);
	}

	for (let b = 0; b < config.blockCount; b++) {
		const owner = getBlockSingleOwnerPromptId(entries, b, config.blockCapacity);
		if (owner !== null) {
			const blocks = ownership.get(owner) || [];
			blocks.push(b);
			ownership.set(owner, blocks);
		}
	}
	return ownership;
}

export function computeFreeBlocks(entries: MultiKVEntry[], config: BlockConfig): number[] {
	const free: number[] = [];
	for (let b = 0; b < config.blockCount; b++) {
		const { start, end } = blockSlice(b, config.blockCapacity);
		let hasOccupied = false;
		for (let i = start; i < end; i++) {
			if (!isFreeStatus(entries[i].status)) {
				hasOccupied = true;
				break;
			}
		}
		if (!hasOccupied) free.push(b);
	}
	return free;
}
