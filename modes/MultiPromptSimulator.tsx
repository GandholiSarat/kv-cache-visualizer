"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MultiPromptVisualizer } from "@/components/MultiPromptVisualizer";
import { EvictionPolicy, DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW } from "@/lib/constants";
import { createMultiPromptState } from "@/prompts/MultiPromptState";
import { computeFreeBlocks, computePromptBlockOwnership } from "@/prompts/promptUtils";
import { stepMultiPrompt, type MultiPromptSimulatorState } from "@/core/simulator";
import type { MultiVisualizationMode } from "@/components/MultiPromptControls";
import type { MultiKVEntry } from "@/core/types";

const BLOCK_COUNT = 4;
const BLOCK_CAPACITY = 8;
const TOTAL_SLOTS = BLOCK_COUNT * BLOCK_CAPACITY;

const PROMPT_COLORS = ["#38bdf8", "#fb7185", "#a78bfa", "#34d399"]; // P1..P4

function createInitialEntries(): MultiKVEntry[] {
	return Array.from({ length: TOTAL_SLOTS }, () => ({ token: "", status: "empty" }));
}

function buildMultiState(promptCount: number, prompts: string[], evictionPolicy: EvictionPolicy, recentNWindow: number): MultiPromptSimulatorState {
	const promptState = createMultiPromptState(promptCount, prompts);
	return {
		mode: "prefill",
		phase: "prefill",
		prefillIndex: promptState.prefillIndex,
		decodeSteps: promptState.decodeSteps,
		promptTokens: promptState.promptTokens,
		prefillStream: promptState.prefillStream,
		entries: createInitialEntries(),
		writeClock: 0,
		recentNWindow,
		evictionPolicy,
		blockConfig: { blockCount: BLOCK_COUNT, blockCapacity: BLOCK_CAPACITY },
	};
}

export function MultiPromptSimulator() {
	const [promptCount, setPromptCount] = useState(2);
	const [prompts, setPrompts] = useState<string[]>([
		"Hello!",
		"Can you summarize this?",
		"What is continuous batching?",
		"Explain KV cache eviction.",
	]);
	const [evictionPolicy, setEvictionPolicy] = useState<EvictionPolicy>(DEFAULT_EVICTION_POLICY);
	const [recentNWindow, setRecentNWindow] = useState(DEFAULT_RECENT_N_WINDOW);
	const [simState, setSimState] = useState<MultiPromptSimulatorState>(() =>
		buildMultiState(2, ["Hello!", "Can you summarize this?", "What is continuous batching?", "Explain KV cache eviction."], DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW)
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [inferenceTick, setInferenceTick] = useState(0);
	const timerRef = useRef<number | null>(null);

	function reset(nextPromptCount: number = promptCount, nextPrompts: string[] = prompts, nextPolicy: EvictionPolicy = evictionPolicy, nextRecentN = recentNWindow) {
		setIsPlaying(false);
		if (timerRef.current) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setInferenceTick(0);
		setSimState(buildMultiState(nextPromptCount, nextPrompts, nextPolicy, nextRecentN));
	}

	function stepToken() {
		setInferenceTick((tick) => tick + 1);
		setSimState((prev) => stepMultiPrompt(prev));
	}

	useEffect(() => {
		if (!isPlaying) {
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
			return;
		}

		const baseDelay = 800;
		const delay = baseDelay / speed;
		timerRef.current = window.setInterval(() => stepToken(), delay);

		return () => {
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [
		isPlaying,
		speed,
		simState.mode,
		simState.prefillIndex,
		simState.prefillStream.length,
		simState.decodeSteps,
		simState.promptTokens.length,
		simState.evictionPolicy,
		simState.recentNWindow,
	]);

	const progressLabel =
		simState.mode === "prefill"
			? `Prefill (continuous batching): ${Math.min(simState.prefillIndex, simState.prefillStream.length)}/${simState.prefillStream.length} flattened tokens`
			: `Decode step ${simState.decodeSteps + 1}: +${simState.promptTokens.length} tokens (1 per prompt)`;

	const phaseLabel =
		simState.phase === "prefill" ? "Prefill (prompt-aligned blocks)" : simState.phase === "decode-read" ? "Decode: Read KV" : "Decode: Write new KV";

	const promptBlockOwnership = useMemo(
		() => computePromptBlockOwnership(simState.entries, simState.promptTokens.length, simState.blockConfig),
		[simState.entries, simState.promptTokens.length, simState.blockConfig]
	);

	const freeBlocks = useMemo(
		() => computeFreeBlocks(simState.entries, simState.blockConfig),
		[simState.entries, simState.blockConfig]
	);

	const mode = simState.mode as MultiVisualizationMode;

	return (
		<MultiPromptVisualizer
			promptCount={promptCount}
			prompts={prompts}
			onPromptCountChange={(count) => {
				setPromptCount(count);
				reset(count, prompts, evictionPolicy, recentNWindow);
			}}
			onPromptChange={(idx, text) => {
				setPrompts((prev) => {
					const next = [...prev];
					next[idx] = text;
					return next;
				});
				const nextPrompts = prompts.map((p, i) => (i === idx ? text : p));
				reset(promptCount, nextPrompts, evictionPolicy, recentNWindow);
			}}
			promptColors={PROMPT_COLORS}
			mode={mode}
			onModeToggle={() => {
				setSimState((prev) => ({ ...prev, mode: prev.mode === "prefill" ? "decode" : "prefill" }));
				reset(promptCount, prompts, evictionPolicy, recentNWindow);
			}}
			onStep={stepToken}
			onReset={() => reset(promptCount, prompts, evictionPolicy, recentNWindow)}
			progressLabel={progressLabel}
			disableStep={false}
			isPlaying={isPlaying}
			onPlayToggle={() => setIsPlaying((prev) => !prev)}
			speed={speed}
			onSpeedChange={setSpeed}
			evictionPolicy={evictionPolicy}
			onEvictionPolicyChange={(policy) => {
				setEvictionPolicy(policy);
				reset(promptCount, prompts, policy, recentNWindow);
			}}
			recentNWindow={recentNWindow}
			onRecentNWindowChange={(value) => {
				setRecentNWindow(value);
				reset(promptCount, prompts, evictionPolicy, value);
			}}
			inferenceTick={inferenceTick}
			phaseLabel={phaseLabel}
			entries={simState.entries}
			blocks={BLOCK_COUNT}
			capacityPerBlock={BLOCK_CAPACITY}
			freeBlocks={freeBlocks}
			promptBlockOwnership={promptBlockOwnership}
		/>
	);
}
