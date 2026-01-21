import { EvictionPolicy } from "@/lib/constants";
import type { BlockConfig, KVEntry, MultiKVEntry, Phase, SimulationMode } from "./types";
import {
	findWriteSlotSingle,
	findWriteSlotPrefillMulti,
	findWriteSlotDecodeMulti,
} from "./kvAllocator";
import { applyMultiPromptPolicyVisuals, applySinglePromptPolicyVisuals, evictByPolicy } from "./evictionPolicies";
import type { FlatToken } from "@/prompts/promptUtils";

export interface SinglePromptSimulatorState {
	mode: SimulationMode;
	phase: Phase;
	currentIndex: number;
	tokens: string[];
	entries: KVEntry[];
	writeClock: number;
	recentNWindow: number;
	evictionPolicy: EvictionPolicy;
	blockConfig: BlockConfig;
}

export interface MultiPromptSimulatorState {
	mode: SimulationMode;
	phase: Phase;
	prefillIndex: number;
	decodeSteps: number;
	promptTokens: string[][];
	prefillStream: FlatToken[];
	entries: MultiKVEntry[];
	writeClock: number;
	recentNWindow: number;
	evictionPolicy: EvictionPolicy;
	blockConfig: BlockConfig;
}

export function stepSinglePrompt(state: SinglePromptSimulatorState): SinglePromptSimulatorState {
	const isPromptConsumed = state.currentIndex >= state.tokens.length;
	if (state.mode === "prefill" && isPromptConsumed) {
		return { ...state, mode: "decode", phase: "decode-read" };
	}

	const nextEntries = state.entries.map((e) => ({ ...e }));
	const isDecode = state.mode === "decode";

	if (isDecode) {
		if (state.evictionPolicy === EvictionPolicy.SlidingWindow || state.evictionPolicy === EvictionPolicy.PinnedPrefix) {
			for (const item of nextEntries) {
				if (item.status !== "empty" && item.status !== "evicted" && item.status !== "pinned") {
					item.status = "reused";
				}
			}
		}
	}

	const phase: Phase = isDecode ? "decode-read" : "prefill";

	let tokenLabel = state.tokens[state.currentIndex];
	if (isDecode && state.currentIndex >= state.tokens.length) {
		tokenLabel = "<gen>";
	}

	let targetSlot = findWriteSlotSingle(nextEntries, state.blockConfig);
	if (targetSlot < 0) {
		const skipPinnedBlock = state.evictionPolicy === EvictionPolicy.PinnedPrefix ? 0 : null;
		const evicted = evictByPolicy(state.evictionPolicy, { entries: nextEntries }, { ...state.blockConfig, skipPinnedBlock });
		targetSlot = findWriteSlotSingle(evicted.entries as KVEntry[], state.blockConfig);
		for (let i = 0; i < nextEntries.length; i++) nextEntries[i] = (evicted.entries as KVEntry[])[i];
	}

	let writeClock = state.writeClock;
	if (targetSlot >= 0) {
		writeClock += 1;
		const anyPrev = nextEntries[targetSlot];
		nextEntries[targetSlot] = {
			...anyPrev,
			token: tokenLabel ?? `Token ${state.currentIndex + 1}`,
			status: "new",
			slotIndex: targetSlot,
			writeId: writeClock,
		};
	}

	const visual = applySinglePromptPolicyVisuals(nextEntries, state.evictionPolicy, isDecode, state.recentNWindow);
	for (let i = 0; i < nextEntries.length; i++) nextEntries[i] = visual[i];

	const nextPhase: Phase = isDecode ? "decode-write" : phase;

	return {
		...state,
		entries: nextEntries,
		phase: nextPhase,
		currentIndex: state.currentIndex + 1,
		writeClock,
	};
}

export function stepMultiPrompt(state: MultiPromptSimulatorState): MultiPromptSimulatorState {
	if (state.mode === "prefill" && state.prefillIndex >= state.prefillStream.length) {
		return { ...state, mode: "decode", phase: "decode-read" };
	}

	const nextEntries = state.entries.map((e) => ({ ...e }));
	const isDecode = state.mode === "decode";

	if (isDecode) {
		if (state.evictionPolicy === EvictionPolicy.SlidingWindow || state.evictionPolicy === EvictionPolicy.PinnedPrefix) {
			for (let i = 0; i < nextEntries.length; i++) {
				const e = nextEntries[i];
				if (e.status !== "empty" && e.status !== "evicted" && e.status !== "pinned") {
					e.status = "reused";
				}
			}
		}
	}

	const phase: Phase = isDecode ? "decode-read" : "prefill";

	const toWrite: FlatToken[] = [];
	if (!isDecode) {
		const item = state.prefillStream[state.prefillIndex];
		if (item) toWrite.push(item);
	} else {
		for (let promptId = 0; promptId < state.promptTokens.length; promptId++) {
			const base = state.promptTokens[promptId].length;
			toWrite.push({ promptId, token: "<gen>", promptPos: base + state.decodeSteps });
		}
	}

	let writeClock = state.writeClock;
	for (const item of toWrite) {
		let target = isDecode
			? findWriteSlotDecodeMulti(nextEntries, state.blockConfig, item.promptId)
			: findWriteSlotPrefillMulti(nextEntries, state.blockConfig, item.promptId);
		if (target < 0) {
			const skipPinnedBlock = state.evictionPolicy === EvictionPolicy.PinnedPrefix ? 0 : null;
			const evicted = evictByPolicy(state.evictionPolicy, { entries: nextEntries }, { ...state.blockConfig, skipPinnedBlock });
			for (let i = 0; i < nextEntries.length; i++) nextEntries[i] = (evicted.entries as MultiKVEntry[])[i];
			target = isDecode
				? findWriteSlotDecodeMulti(nextEntries, state.blockConfig, item.promptId)
				: findWriteSlotPrefillMulti(nextEntries, state.blockConfig, item.promptId);
		}
		if (target >= 0) {
			writeClock += 1;
			const anyPrev = nextEntries[target];
			nextEntries[target] = {
				...anyPrev,
				token: item.token,
				status: "new",
				promptId: item.promptId,
				promptPos: item.promptPos,
				writeId: writeClock,
			};
		}
	}

	const visual = applyMultiPromptPolicyVisuals(nextEntries, state.evictionPolicy, isDecode, state.recentNWindow);
	for (let i = 0; i < nextEntries.length; i++) nextEntries[i] = visual[i];

	const nextPhase: Phase = isDecode ? "decode-write" : phase;

	return {
		...state,
		entries: nextEntries,
		phase: nextPhase,
		prefillIndex: state.mode === "prefill" ? state.prefillIndex + 1 : state.prefillIndex,
		decodeSteps: state.mode === "decode" ? state.decodeSteps + 1 : state.decodeSteps,
		writeClock,
	};
}
