"use client";

// Conceptual KV cache visualizer: block-driven, prompt-driven, policy-aware.

import { useEffect, useMemo, useRef, useState } from "react";
import { Controls, type VisualizationMode } from "../components/Controls";
import { KVBlocks, type KVEntry, type KVEntryStatus } from "../components/KVBlocks";
import { MemoryStats } from "../components/MemoryStats";
import { EvictionPolicy, DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW } from "../lib/constants";
import { renderTokensWithSpacing, isPunctuationToken } from "../lib/tokenRendering";

const BLOCK_COUNT = 4;
const BLOCK_CAPACITY = 8;
const TOTAL_SLOTS = BLOCK_COUNT * BLOCK_CAPACITY;

const DEFAULT_PROMPT = "Hello, how are you today?";

function tokenizePrompt(prompt: string): string[] {
	const tokens: string[] = [];
	let currentWord = "";

	for (let i = 0; i < prompt.length; i++) {
		const char = prompt[i];
		const isAlphanumericOrApostrophe = /[A-Za-z0-9']/.test(char);
		const isPunctuation = /[.,?!:;]/.test(char);

		if (isAlphanumericOrApostrophe) {
			currentWord += char;
		} else if (isPunctuation) {
			// Push current word if any
			if (currentWord.trim()) {
				tokens.push(currentWord.trim());
				currentWord = "";
			}
			// Push punctuation as separate token
			tokens.push(char);
		} else if (/\s/.test(char)) {
			// Whitespace: finalize current word
			if (currentWord.trim()) {
				tokens.push(currentWord.trim());
				currentWord = "";
			}
		}
	}

	// Push any remaining word
	if (currentWord.trim()) {
		tokens.push(currentWord.trim());
	}

	return tokens;
}

export default function Home() {
	const [promptText, setPromptText] = useState(DEFAULT_PROMPT);
	const [mode, setMode] = useState<VisualizationMode>("prefill");
	const [currentIndex, setCurrentIndex] = useState(0);
	const [entries, setEntries] = useState<KVEntry[]>(() =>
		Array.from({ length: TOTAL_SLOTS }, () => ({ token: "", status: "empty" as KVEntryStatus, slotIndex: 0 }))
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1); // 0.25×, 0.5×, 1×, 2×, 4×
	const [inferenceTick, setInferenceTick] = useState(0);
	const [phase, setPhase] = useState<"prefill" | "decode-read" | "decode-write">("prefill");
	const [evictionPolicy, setEvictionPolicy] = useState<EvictionPolicy>(DEFAULT_EVICTION_POLICY);
	const [recentNWindow, setRecentNWindow] = useState(DEFAULT_RECENT_N_WINDOW);
	const [showPolicyDetails, setShowPolicyDetails] = useState(false);
	const timerRef = useRef<number | null>(null);
	const decodeCounterRef = useRef(0);

	const tokens = useMemo(() => tokenizePrompt(promptText), [promptText]);
	const isCapacityFull = entries.filter((e) => e.status !== "empty").length >= TOTAL_SLOTS;
	const isPromptConsumed = currentIndex >= tokens.length;
	// Never disable step in this evolved version
	const disableStep = false;

	const newCount = entries.filter((e) => e.status === "new").length;
	const reusedCount = entries.filter((e) => e.status === "reused").length;
	const pinnedCount = entries.filter((e) => e.status === "pinned").length;
	const emptyCount = TOTAL_SLOTS - newCount - reusedCount - pinnedCount;

	function reset() {
		setIsPlaying(false);
		if (timerRef.current) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setMode("prefill");
		setPhase("prefill");
		setCurrentIndex(0);
		setInferenceTick(0);
		setEntries(Array.from({ length: TOTAL_SLOTS }, () => ({ token: "", status: "empty" as KVEntryStatus, slotIndex: 0 })));
		decodeCounterRef.current = 0;
	}

	/**
	 * Apply eviction logic based on selected policy.
	 * Returns a new entries array with one slot freed (or marked as evicted).
	 */
	function applyEvictionPolicy(next: KVEntry[]): KVEntry[] {
		const filledCount = next.filter((e) => e.status !== "empty" && e.status !== "evicted").length;
		if (filledCount < TOTAL_SLOTS) {
			return next; // No eviction needed
		}

		switch (evictionPolicy) {
			case EvictionPolicy.SlidingWindow:
				// Evict oldest (shift all left, clear last slot)
				for (let i = 0; i < TOTAL_SLOTS - 1; i++) {
					next[i] = { ...next[i + 1] };
				}
				next[TOTAL_SLOTS - 1] = { token: "", status: "empty", slotIndex: TOTAL_SLOTS - 1 };
				return next;

			case EvictionPolicy.PinnedPrefix:
				// First block is pinned to mimic a persistent system prompt.
				const firstPinnedIdx = 0; // First slot is pinned
				let evictIdx = firstPinnedIdx + 1;
				while (evictIdx < TOTAL_SLOTS && next[evictIdx].status === "empty") {
					evictIdx++;
				}
				if (evictIdx < TOTAL_SLOTS) {
					// Mark as evicted, then shift remaining entries
					for (let i = evictIdx; i < TOTAL_SLOTS - 1; i++) {
						next[i] = { ...next[i + 1] };
					}
					next[TOTAL_SLOTS - 1] = { token: "", status: "empty", slotIndex: TOTAL_SLOTS - 1 };
				}
				return next;

			case EvictionPolicy.RecentN: {
				// Keep only the most recent DEFAULT_RECENT_N_WINDOW tokens
				// Evict the oldest token outside this window (streaming-style context limit)
				let evictIdx = 0;
				for (let i = 0; i < TOTAL_SLOTS; i++) {
					if (next[i].status !== "empty" && next[i].status !== "evicted") {
						evictIdx = i;
						break;
					}
				}
				if (evictIdx < TOTAL_SLOTS) {
					for (let i = evictIdx; i < TOTAL_SLOTS - 1; i++) {
						next[i] = { ...next[i + 1] };
					}
					next[TOTAL_SLOTS - 1] = { token: "", status: "empty", slotIndex: TOTAL_SLOTS - 1 };
				}
				return next;
			}

			default:
				return next;
		}
	}

	/**
	 * Apply policy-specific status updates to reflect visualization logic.
	 * During decode-read phase, Recent-N marks only the most recent N tokens as reused,
	 * while older (retained but outside window) tokens stay inactive.
	 */
	function applyPolicyVisuals(entries: KVEntry[], isDecodeRead: boolean = false, recentN: number = DEFAULT_RECENT_N_WINDOW): KVEntry[] {
		if (evictionPolicy === EvictionPolicy.PinnedPrefix) {
			// Mark first non-empty block as pinned
			const updated = entries.map((e, idx) => {
				if (idx === 0 && e.status !== "empty" && e.status !== "pinned") {
					return { ...e, status: "pinned" as KVEntryStatus, isPinned: true };
				}
				return e;
			});
			return updated;
		} else if (evictionPolicy === EvictionPolicy.RecentN) {
			if (isDecodeRead) {
				// During decode read, only the most recent N tokens are "reused" (attention reads)
				// Older tokens remain in memory but are marked "inactive" (dimmed)
				const nonEmptyEntries = entries.filter((e) => e.status !== "empty");
				const recentCount = Math.min(nonEmptyEntries.length, recentN);
				
				// Find indices of non-empty entries
				const nonEmptyIndices: number[] = [];
				for (let i = 0; i < entries.length; i++) {
					if (entries[i].status !== "empty") {
						nonEmptyIndices.push(i);
					}
				}
				
				// Mark the most recent tokens as reused, older ones as inactive
				const recentStartIdx = nonEmptyIndices.length - recentCount;
				
				const updated = entries.map((e, idx) => {
					if (e.status === "empty") return e;
					
					const positionInNonEmpty = nonEmptyIndices.indexOf(idx);
					if (positionInNonEmpty >= recentStartIdx) {
						// Within recent window: mark as reused (green)
						return { ...e, status: "reused" as KVEntryStatus, inWindow: true };
					} else {
						// Outside recent window: mark as inactive (dimmed)
						return { ...e, status: "inactive" as KVEntryStatus, inWindow: false };
					}
				});
				return updated;
			} else {
				// During prefill/decode-write, mark all non-empty blocks as in window
				const updated = entries.map((e) => {
					if (e.status !== "empty") {
						return { ...e, inWindow: true };
					}
					return e;
				});
				return updated;
			}
		}
		return entries;
	}

	function stepToken() {
		setInferenceTick((tick) => tick + 1);

		// Auto-transition: prefill → decode when prompt consumed
		if (mode === "prefill" && isPromptConsumed) {
			setMode("decode");
			setPhase("decode-read");
			return;
		}

		setEntries((prev) => {
			const next = prev.map((e) => ({ ...e }));

			const isDecodeRead = mode === "decode";

			if (mode === "decode") {
				// During decode read phase, apply policy-specific read behavior
				if (evictionPolicy === EvictionPolicy.SlidingWindow || evictionPolicy === EvictionPolicy.PinnedPrefix) {
					// Sliding Window and Pinned Prefix: mark all non-empty and non-pinned as reused
					for (const item of next) {
						if (item.status !== "empty" && item.status !== "pinned") {
							item.status = "reused";
						}
					}
				}
				// Recent-N will be handled by applyPolicyVisuals below
				setPhase("decode-read");
			} else {
				setPhase("prefill");
			}

			// Determine token to write
			let tokenLabel = tokens[currentIndex];
			if (mode === "decode" && currentIndex >= tokens.length) {
				// Placeholder for a generated token; no real model inference occurs.
				tokenLabel = "<gen>";
			}

			// Check if we need to evict
			const filledCount = next.filter((e) => e.status !== "empty").length;
			if (filledCount >= TOTAL_SLOTS) {
				// Apply policy-specific eviction
				const evicted = applyEvictionPolicy(next);
				for (let i = 0; i < TOTAL_SLOTS; i++) {
					next[i] = evicted[i];
				}
			}

			// Find first empty slot and append new token
			const emptyIndex = next.findIndex((e) => e.status === "empty");
			if (emptyIndex >= 0) {
				next[emptyIndex] = {
					token: tokenLabel ?? `Token ${currentIndex + 1}`,
					status: "new",
					slotIndex: emptyIndex,
				};
			}

			// Apply policy-specific visual updates
			const visual = applyPolicyVisuals(next, isDecodeRead, recentNWindow);
			for (let i = 0; i < TOTAL_SLOTS; i++) {
				next[i] = visual[i];
			}

			// Update phase to write after appending
			if (mode === "decode") {
				setPhase("decode-write");
			}

			return next;
		});
		setCurrentIndex((value) => value + 1);
	}

	// Auto-run timer effect
	useEffect(() => {
		if (!isPlaying) {
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
			return;
		}

		const baseDelay = 800; // ms
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
	}, [isPlaying, speed, mode, currentIndex, tokens, isPromptConsumed]);

	const progressLabel = mode === "prefill" 
		? `Prefill: ${Math.min(currentIndex, tokens.length)}/${tokens.length} tokens`
		: `Decode: generating token ${currentIndex - tokens.length + 1}`;

	const phaseLabel = 
		phase === "prefill" ? "Prefill (parallel)" : 
		phase === "decode-read" ? "Decode: Read KV" : 
		"Decode: Write new KV";

	return (
		<main
			style={{
				minHeight: "100vh",
				padding: "24px",
				background: "#020617",
				color: "#e2e8f0",
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* Header */}
			<section style={{ display: "grid", gap: "8px", marginBottom: "24px" }}>
				<h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0 }}>KV Cache Visualizer</h1>
				<p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
					Real-time inference simulation: prefill → decode → streaming → eviction
				</p>
				<div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
					<div style={{ fontSize: "13px", color: "#10b981", fontWeight: 600 }}>
						Inference Tick: {inferenceTick}
					</div>
					<div style={{ fontSize: "13px", color: "#3b82f6", fontWeight: 600 }}>
						Phase: {phaseLabel}
					</div>
				</div>
			</section>

			{/* Main layout */}
			<section
				style={{
					display: "grid",
					gridTemplateColumns: "300px 1fr 260px",
					gap: "20px",
					alignItems: "start",
					maxWidth: "1400px",
					margin: "0 auto",
					width: "100%",
				}}
			>
				{/* Left: Controls */}
				<div style={{ display: "grid", gap: "16px" }}>
					<Controls
						promptText={promptText}
						onPromptChange={(text) => {
							setPromptText(text);
							reset();
						}}
						mode={mode}
						onModeToggle={() => {
							setMode((prev) => (prev === "prefill" ? "decode" : "prefill"));
							reset();
						}}
						onStep={stepToken}
						onReset={reset}
						progressLabel={progressLabel}
						disableStep={disableStep}
						isPlaying={isPlaying}
						onPlayToggle={() => setIsPlaying((prev) => !prev)}
						speed={speed}
						onSpeedChange={setSpeed}
						evictionPolicy={evictionPolicy}
						onEvictionPolicyChange={(policy) => {
							setEvictionPolicy(policy);
							reset();
						}}
						recentNWindow={recentNWindow}
						onRecentNWindowChange={setRecentNWindow}
					/>
					<MemoryStats
						totalSlots={TOTAL_SLOTS}
						newCount={newCount}
						reusedCount={reusedCount}
						pinnedCount={pinnedCount}
						emptyCount={emptyCount}
					/>
				</div>

				{/* Center: Block visualization */}
				<div
					style={{
						border: "1px solid #1e293b",
						borderRadius: "8px",
						background: "#0b1220",
						padding: "16px",
					}}
				>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
						<div style={{ fontWeight: 700, color: "#e2e8f0" }}>KV Cache Blocks</div>
						<div style={{ fontSize: "12px", color: "#94a3b8" }}>
							{mode === "prefill" ? "Filling cache" : "Streaming (sliding window)"}
						</div>
					</div>
					<KVBlocks blocks={BLOCK_COUNT} capacityPerBlock={BLOCK_CAPACITY} entries={entries} />
				</div>

				{/* Right: Legend and explanation */}
				<div style={{ display: "grid", gap: "16px" }}>
					<div
						style={{
							padding: "12px",
							border: "1px solid #1e293b",
							borderRadius: "8px",
							background: "#0b1220",
						}}
					>
						<div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>Legend</div>
						<div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
							<ColorKey color="#2563eb" label="New KV (written this step)" />
							<ColorKey color="#16a34a" label="Reused KV (decode reads)" />
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
					<div
						style={{
							padding: "12px",
							border: "1px solid #334155",
							borderRadius: "8px",
							background: "#0b1220",
							fontSize: "12px",
							color: "#e2e8f0",
							lineHeight: "1.7",
							cursor: "pointer",
							userSelect: "none",
						}}
						onClick={() => setShowPolicyDetails(!showPolicyDetails)}
					>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
							<strong>How Policies Map to Real LLM Serving</strong>
							<span style={{ fontSize: "14px", color: "#94a3b8", transition: "transform 0.2s ease", transform: showPolicyDetails ? "rotate(180deg)" : "rotate(0deg)" }}>
								▼
							</span>
						</div>
						{showPolicyDetails && (
							<ul style={{ margin: "12px 0 0 14px", padding: 0, color: "#cbd5e1" }}>
								<li><strong>Inference Clock:</strong> Each tick = one forward pass through the model.</li>
								<li><strong>Prefill Phase:</strong> Processes all prompt tokens in parallel; allocates KV cache.</li>
								<li><strong>Decode Phase:</strong> Autoregressive: reads cached KV, computes next token, appends new KV.</li>
								<li><strong>Sliding Window:</strong> Evicts oldest tokens when cache overflows (Mistral, Llama 3.1 long-context).</li>
								<li><strong>Pinned Prefix:</strong> Locks system prompt in cache; useful for chat models and multi-turn context.</li>
								<li><strong>Recent-N Tokens:</strong> Maintains recent history only; ideal for streaming/low-latency inference.</li>
								<li><strong>Context Windows:</strong> Each policy manages the trade-off between memory usage and context recall.</li>
							</ul>
						)}
					</div>
				</div>
			</section>
		</main>
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
   
