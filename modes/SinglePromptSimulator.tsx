"use client";

// Single-prompt mode container: owns state + timers and calls the core stepper.

import { useEffect, useRef, useState } from "react";
import { Controls, type VisualizationMode } from "@/components/Controls";
import { KVBlocks } from "@/components/KVBlocks";
import { MemoryStats } from "@/components/MemoryStats";
import SinglePromptExplanation from "@/components/SinglePromptExplanation";
import { EvictionPolicy, DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW } from "@/lib/constants";
import { tokenizePrompt } from "@/prompts/promptUtils";
import { stepSinglePrompt, type SinglePromptSimulatorState } from "@/core/simulator";
import type { KVEntry } from "@/core/types";

const BLOCK_COUNT = 4;
const BLOCK_CAPACITY = 8;
const TOTAL_SLOTS = BLOCK_COUNT * BLOCK_CAPACITY;

const DEFAULT_PROMPT = "Hello, how are you today?";

function createInitialEntries(): KVEntry[] {
	return Array.from({ length: TOTAL_SLOTS }, () => ({ token: "", status: "empty", slotIndex: 0 }));
}

function buildSingleState(promptText: string, evictionPolicy: EvictionPolicy, recentNWindow: number): SinglePromptSimulatorState {
	return {
		mode: "prefill",
		phase: "prefill",
		currentIndex: 0,
		tokens: tokenizePrompt(promptText),
		entries: createInitialEntries(),
		writeClock: 0,
		recentNWindow,
		evictionPolicy,
		blockConfig: { blockCount: BLOCK_COUNT, blockCapacity: BLOCK_CAPACITY },
	};
}

export function SinglePromptSimulator() {
	const [promptText, setPromptText] = useState(DEFAULT_PROMPT);
	const [evictionPolicy, setEvictionPolicy] = useState<EvictionPolicy>(DEFAULT_EVICTION_POLICY);
	const [recentNWindow, setRecentNWindow] = useState(DEFAULT_RECENT_N_WINDOW);
	const [simState, setSimState] = useState<SinglePromptSimulatorState>(() =>
		buildSingleState(DEFAULT_PROMPT, DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW)
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [inferenceTick, setInferenceTick] = useState(0);
	const timerRef = useRef<number | null>(null);

	const isPromptConsumed = simState.currentIndex >= simState.tokens.length;

	function reset(nextPrompt: string = promptText, nextPolicy: EvictionPolicy = evictionPolicy, nextRecentN = recentNWindow) {
		setIsPlaying(false);
		if (timerRef.current) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setInferenceTick(0);
		setSimState(buildSingleState(nextPrompt, nextPolicy, nextRecentN));
	}

	function stepToken() {
		setInferenceTick((tick) => tick + 1);
		setSimState((prev) => stepSinglePrompt(prev));
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

		timerRef.current = window.setInterval(() => {
			stepToken();
		}, delay);

		return () => {
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [isPlaying, speed, simState.mode, simState.currentIndex, simState.tokens, isPromptConsumed]);

	const progressLabel =
		simState.mode === "prefill"
			? `Prefill: ${Math.min(simState.currentIndex, simState.tokens.length)}/${simState.tokens.length} tokens`
			: `Decode: generating token ${simState.currentIndex - simState.tokens.length + 1}`;

	const phaseLabel =
		simState.phase === "prefill"
			? "Prefill (parallel)"
			: simState.phase === "decode-read"
				? "Decode: Read KV"
				: "Decode: Write new KV";

	const mode = simState.mode as VisualizationMode;

	const newCount = simState.entries.filter((e) => e.status === "new").length;
	const reusedCount = simState.entries.filter((e) => e.status === "reused").length;
	const retainedCount =
		simState.evictionPolicy === EvictionPolicy.RecentN
			? simState.entries.filter((e) => e.status === "inactive").length
			: 0;
	const pinnedCount = simState.entries.filter((e) => e.status === "pinned").length;
	const emptyCount = simState.entries.filter((e) => e.status === "empty" || e.status === "evicted").length;

	return (
		<>
			<section className="header-section" style={{ display: "grid", gap: "4px", marginBottom: "12px" }}>
				<div className="status-badges" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
					<div className="status-badge" style={{ fontSize: "14px", color: "#10b981", fontWeight: 600, margin: 5 }}>
						Inference Tick: {inferenceTick}
					</div>
					<div className="status-badge" style={{ fontSize: "14px", color: "#3b82f6", fontWeight: 600, margin: 5 }}>
						Phase: {phaseLabel}
					</div>
				</div>
			</section>

			<section
				className="main-grid"
				style={{
					display: "grid",
					gap: "16px",
					alignItems: "start",
					maxWidth: "1600px",
					margin: "0 auto",
					width: "100%",
				}}
			>
				{/* Left: Controls */}
				<div className="controls-left-column" style={{ display: "grid", gap: "16px" }}>
					<Controls
						promptText={promptText}
						onPromptChange={(text) => {
							setPromptText(text);
							reset(text, evictionPolicy, recentNWindow);
						}}
						mode={mode}
						onModeToggle={() => {
							setSimState((prev) => ({ ...prev, mode: prev.mode === "prefill" ? "decode" : "prefill" }));
							reset(promptText, evictionPolicy, recentNWindow);
						}}
						onStep={stepToken}
						onReset={() => reset(promptText, evictionPolicy, recentNWindow)}
						progressLabel={progressLabel}
						disableStep={false}
						isPlaying={isPlaying}
						onPlayToggle={() => setIsPlaying((prev) => !prev)}
						speed={speed}
						onSpeedChange={setSpeed}
						evictionPolicy={evictionPolicy}
						onEvictionPolicyChange={(policy) => {
							setEvictionPolicy(policy);
							reset(promptText, policy, recentNWindow);
						}}
						recentNWindow={recentNWindow}
						onRecentNWindowChange={(value) => {
							setRecentNWindow(value);
							setSimState((prev) => ({ ...prev, recentNWindow: value }));
						}}
					/>
				</div>

				{/* Center: Block visualization */}
				<div
					className="kv-visualization-container blocks-center-column mobile-panel"
					style={{
						border: "1px solid #1e293b",
						borderRadius: "8px",
						background: "#0b1220",
						padding: "12px",
					}}
				>
					<div
						className="kv-header"
						style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "14px" }}>GPU: KV Cache Blocks</div>
							<div style={{ fontSize: "10px", color: "#64748b", background: "#1e293b", padding: "2px 6px", borderRadius: "3px" }}>
								Paged KV Storage
							</div>
						</div>
						<div style={{ fontSize: "11px", color: "#94a3b8" }}>
							{simState.mode === "prefill" ? "Prefill: process all tokens sequentially" : "Decode: read KV → generate token → write new KV"}
						</div>
					</div>
					<div className="kv-blocks-scroll" style={{ overflowX: "auto", overflowY: "visible" }}>
						<KVBlocks blocks={BLOCK_COUNT} capacityPerBlock={BLOCK_CAPACITY} entries={simState.entries} />
					</div>
				</div>

				{/* Right Column: Legend and Memory Stats (stacked) */}
				<div className="right-column" style={{ display: "grid", gap: "16px", gridColumn: "3 / 4", gridRow: "1 / 3" }}>
					{/* Legend - Top */}
					<div
						className="mobile-panel"
						style={{
							padding: "16px",
							border: "1px solid #1e293b",
							borderRadius: "8px",
							background: "#0b1220",
						}}
					>
						<div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>Legend</div>
						<div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
							<ColorKey color="#2563eb" label="New KV (written this step)" />
							<ColorKey color="#16a34a" label="Reused (attention reads)" />
							<ColorKey color="#8b5cf6" label="Pinned KV (locked in prefix)" />
							<ColorKey color="#64748b" label="Evicted KV (fading out)" />
							<ColorKey color="#1e293b" label="Empty slot" />
							<div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px", paddingTop: "8px", borderTop: "0px solid #334155" }}>
								<strong style={{ color: "#cbd5e1" }}>gen</strong> = generated decode token (simulated, not real inference)
							</div>
						</div>
						<div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #1e293b", color: "#94a3b8", fontSize: "12px", lineHeight: "1.6" }}>
							<strong>Prefill:</strong> Process all prompt tokens sequentially.
							<br />
							<strong>Decode:</strong> Read cached KV → generate next token → write new KV.
							<br />
							<strong>Policy Impact:</strong>
							<br />
							• <strong>Sliding Window:</strong> Evicts oldest on overflow
							<br />
							• <strong>Pinned Prefix:</strong> Locks first block (system prompt)
							<br />
							• <strong>Recent-N:</strong> Keeps only recent tokens
						</div>
					</div>

					{/* Memory Stats - Below Legend */}
					<div
						className="mobile-panel"
						style={{
							padding: "16px",
							border: "1px solid #1e293b",
							borderRadius: "8px",
							background: "#0b1020",
						}}
					>
						<MemoryStats
							totalSlots={TOTAL_SLOTS}
							newCount={newCount}
							reusedCount={reusedCount}
							retainedCount={retainedCount}
							pinnedCount={pinnedCount}
							emptyCount={emptyCount}
						/>
					</div>
				</div>
			</section>

			{/* Explanation Section - Below the simulation */}
			<section
				style={{
					maxWidth: "1600px",
					margin: "24px auto 0 auto",
					width: "100%",
				}}
			>
				<SinglePromptExplanation />
			</section>
		</>
	);
}

function ColorKey({ color, label }: { color: string; label: string }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
			<div
				style={{
					width: "14px",
					height: "14px",
					borderRadius: "3px",
					background: color,
				}}
			/>
			<span style={{ color: "#cbd5e1" }}>{label}</span>
		</div>
	);
}
