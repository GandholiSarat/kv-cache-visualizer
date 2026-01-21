"use client";

// Conceptual KV cache visualizer: block-driven, prompt-driven, policy-aware.

import { useEffect, useMemo, useRef, useState } from "react";
import { Controls, type VisualizationMode } from "../components/Controls";
import { KVBlocks, type KVEntry, type KVEntryStatus } from "../components/KVBlocks";
import { MemoryStats } from "../components/MemoryStats";
import { MultiPromptVisualizer } from "@/components/MultiPromptVisualizer";
import SinglePromptExplanation from "@/components/SinglePromptExplanation";
import { EvictionPolicy, DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW } from "../lib/constants";
import { renderTokensWithSpacing, isPunctuationToken } from "../lib/tokenRendering";

const BLOCK_COUNT = 4;
const BLOCK_CAPACITY = 8;
const TOTAL_SLOTS = BLOCK_COUNT * BLOCK_CAPACITY;

const DEFAULT_PROMPT = "Hello, how are you today?";

type InferencePromptMode = "single" | "multi";

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
	const [promptMode, setPromptMode] = useState<InferencePromptMode>("single");

	return (
		<main
			className="responsive-main main-container"
			style={{
				minHeight: "100vh",
				padding: "16px",
				background: "#020617",
				color: "#e2e8f0",
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				flexDirection: "column",
				maxWidth: "100%",
				overflowX: "hidden",
			}}
		>
		<section className="header-section responsive-header" style={{ display: "grid", gap: "6px", marginBottom: "10px" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
					<div style={{ display: "grid", gap: "4px", flex: "1 1 auto", minWidth: "260px" }}>
						<h1 className="main-title" style={{ fontSize: "35px", fontWeight: 700, margin: 5 }}>KV Cache Visualizer</h1>
						<p className="subtitle" style={{ margin: 5, color: "#94a3b8", fontSize: "15px" }}>
							Real-time inference simulation: prefill → decode → streaming → eviction
						</p>
					</div>

					<div
						style={{
							display: "grid",
							gap: "6px",
							padding: "10px",
							border: "1px solid #1e293b",
							borderRadius: "8px",
							background: "#0b1220",
							minWidth: "260px",
						}}
					>
						<div style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}>Mode</div>
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								type="button"
								onClick={() => setPromptMode("single")}
								aria-pressed={promptMode === "single"}
								className="mobile-button"
								style={{
									flex: 1,
									padding: "10px 12px",
									minHeight: "44px",
									borderRadius: "6px",
									border: "1px solid #334155",
									background: promptMode === "single" ? "#1e40af" : "#0f172a",
									color: "#f8fafc",
									fontSize: "13px",
									fontWeight: 700,
									cursor: "pointer",
								}}
							>
								Single Prompt
							</button>
							<button
								type="button"
								onClick={() => setPromptMode("multi")}
								aria-pressed={promptMode === "multi"}
								className="mobile-button"
								style={{
									flex: 1,
									padding: "10px 12px",
									minHeight: "44px",
									borderRadius: "6px",
									border: "1px solid #334155",
									background: promptMode === "multi" ? "#14532d" : "#0f172a",
									color: "#f8fafc",
									fontSize: "13px",
									fontWeight: 700,
									cursor: "pointer",
								}}
							>
								Multi Prompt (Continuous Batching)
							</button>
						</div>
						{/* <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.4 }}>
							Single matches the original behavior. Multi visualizes continuous batching.
						</div> */}
					</div>
				</div>
			</section>

			{promptMode === "single" ? <SinglePromptVisualizer /> : <MultiPromptVisualizer />}
		</main>
	);
}

function SinglePromptVisualizer() {
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
	const timerRef = useRef<number | null>(null);
	const decodeCounterRef = useRef(0);
	const writeClockRef = useRef(0);

	const tokens = useMemo(() => tokenizePrompt(promptText), [promptText]);
	const isPromptConsumed = currentIndex >= tokens.length;
	// Never disable step in this evolved version
	const disableStep = false;

	const newCount = entries.filter((e) => e.status === "new").length;
	const reusedCount = entries.filter((e) => e.status === "reused").length;
	const pinnedCount = entries.filter((e) => e.status === "pinned").length;
	const emptyCount = entries.filter((e) => e.status === "empty" || e.status === "evicted").length;

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
		writeClockRef.current = 0;
	}

	function isFreeStatus(status: KVEntryStatus): boolean {
		return status === "empty" || status === "evicted";
	}

	function blockSlice(blockIndex: number): { start: number; end: number } {
		const start = blockIndex * BLOCK_CAPACITY;
		return { start, end: start + BLOCK_CAPACITY };
	}

	function blockOccupiedCount(next: KVEntry[], blockIndex: number): number {
		const { start, end } = blockSlice(blockIndex);
		let occupied = 0;
		for (let i = start; i < end; i++) {
			if (!isFreeStatus(next[i].status)) occupied++;
		}
		return occupied;
	}

	function blockHasAnyOccupied(next: KVEntry[], blockIndex: number): boolean {
		return blockOccupiedCount(next, blockIndex) > 0;
	}

	function findFirstFreeInBlock(next: KVEntry[], blockIndex: number): number {
		const { start, end } = blockSlice(blockIndex);
		for (let i = start; i < end; i++) {
			if (isFreeStatus(next[i].status)) return i;
		}
		return -1;
	}

	function isBlockCompletelyFree(next: KVEntry[], blockIndex: number): boolean {
		return blockOccupiedCount(next, blockIndex) === 0;
	}

	function isBlockFull(next: KVEntry[], blockIndex: number): boolean {
		return blockOccupiedCount(next, blockIndex) >= BLOCK_CAPACITY;
	}

	function getBlockLastWriteId(next: KVEntry[], blockIndex: number): number {
		const { start, end } = blockSlice(blockIndex);
		let maxId = -1;
		for (let i = start; i < end; i++) {
			const anyEntry = next[i] as KVEntry & { writeId?: number };
			if (!isFreeStatus(anyEntry.status) && typeof anyEntry.writeId === "number") {
				maxId = Math.max(maxId, anyEntry.writeId);
			}
		}
		return maxId;
	}

	function evictFullBlock(next: KVEntry[]): boolean {
		const candidateBlocks: number[] = [];
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (evictionPolicy === EvictionPolicy.PinnedPrefix && b === 0) continue;
			if (isBlockFull(next, b)) candidateBlocks.push(b);
		}
		if (candidateBlocks.length === 0) return false;

		// Evict the oldest full block (by last write id).
		let victim = candidateBlocks[0];
		let victimLast = getBlockLastWriteId(next, victim);
		for (const b of candidateBlocks.slice(1)) {
			const last = getBlockLastWriteId(next, b);
			if (victimLast < 0 || (last >= 0 && last < victimLast)) {
				victim = b;
				victimLast = last;
			}
		}

		const { start, end } = blockSlice(victim);
		for (let i = start; i < end; i++) {
			if (!isFreeStatus(next[i].status)) {
				next[i] = { ...next[i], status: "evicted" as KVEntryStatus };
			}
		}
		return true;
	}

	function evictOneOldestSlot(next: KVEntry[]): boolean {
		// Single-prompt Sliding Window / Pinned Prefix: evict only what we need to make room for 1 token.
		// This matches the expectation that utilization stays ~full after reaching capacity.
		let victimIndex = -1;
		let victimWriteId = Number.POSITIVE_INFINITY;

		for (let i = 0; i < next.length; i++) {
			const e = next[i] as KVEntry & { writeId?: number };
			if (isFreeStatus(e.status)) continue;
			if (e.status === "pinned" || e.isPinned) continue;
			if (evictionPolicy === EvictionPolicy.PinnedPrefix && i < BLOCK_CAPACITY) continue; // don't evict from Block 1
			if (typeof e.writeId !== "number") continue;
			if (e.writeId < victimWriteId) {
				victimWriteId = e.writeId;
				victimIndex = i;
			}
		}

		if (victimIndex < 0) return false;
		next[victimIndex] = { ...next[victimIndex], status: "evicted" as KVEntryStatus };
		return true;
	}

	function evictForWrite(next: KVEntry[]): boolean {
		// For single-prompt visualization, eviction is block-granular.
		// This ensures that when the write cursor wraps (e.g., after 32/32 are used),
		// the oldest block is cleared first (grey), then refilled from its first slot.
		return evictFullBlock(next);
	}

	function findWriteSlot(next: KVEntry[]): number {
		// 1) Fill existing empty slots inside already-used (active) blocks first.
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (!blockHasAnyOccupied(next, b)) continue;
			const slot = findFirstFreeInBlock(next, b);
			if (slot >= 0) return slot;
		}
		// 2) Allocate a new block (first slot in a completely free block).
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (!isBlockCompletelyFree(next, b)) continue;
			return b * BLOCK_CAPACITY;
		}
		// 3) No space: caller must evict a full block.
		return -1;
	}

	// Note: eviction is now block-granular and never compacts/re-packs slots.

	/**
	 * Apply policy-specific status updates to reflect visualization logic.
	 * During decode-read phase, Recent-N marks only the most recent N tokens as reused,
	 * while older (retained but outside window) tokens stay inactive.
	 */
	function applyPolicyVisuals(entries: KVEntry[], isDecodeRead: boolean = false, recentN: number = DEFAULT_RECENT_N_WINDOW): KVEntry[] {
		if (evictionPolicy === EvictionPolicy.PinnedPrefix) {
			// Mark first non-empty block as pinned
			const updated = entries.map((e, idx) => {
				if (idx === 0 && e.status !== "empty" && e.status !== "evicted" && e.status !== "pinned") {
					return { ...e, status: "pinned" as KVEntryStatus, isPinned: true };
				}
				return e;
			});
			return updated;
		} else if (evictionPolicy === EvictionPolicy.RecentN) {
			if (isDecodeRead) {
				// During decode read, only the most recent N tokens are "reused" (attention reads).
				// IMPORTANT: "most recent" must be based on write order, not slot index order,
				// otherwise the visualization breaks once the cache wraps (after 32/32).
				const occupied: Array<{ idx: number; writeId: number }> = [];
				let newestWriteId = -1;
				for (let i = 0; i < entries.length; i++) {
					const st = entries[i].status;
					if (st === "empty" || st === "evicted") continue;
					const anyEntry = entries[i] as KVEntry & { writeId?: number };
					const writeId = typeof anyEntry.writeId === "number" ? anyEntry.writeId : -1;
					newestWriteId = Math.max(newestWriteId, writeId);
					occupied.push({ idx: i, writeId });
				}

				occupied.sort((a, b) => a.writeId - b.writeId);
				const recentCount = Math.min(occupied.length, recentN);
				const recentSet = new Set<number>(occupied.slice(Math.max(0, occupied.length - recentCount)).map((x) => x.idx));

				return entries.map((e, idx) => {
					if (e.status === "empty" || e.status === "evicted") return e;
					// Preserve only the newest-written KV as blue in the same step.
					const anyEntry = e as KVEntry & { writeId?: number };
					const writeId = typeof anyEntry.writeId === "number" ? anyEntry.writeId : -1;
					if (e.status === "new" && writeId === newestWriteId) return { ...e, inWindow: true };
					if (recentSet.has(idx)) {
						return { ...e, status: "reused" as KVEntryStatus, inWindow: true };
					}
					return { ...e, status: "inactive" as KVEntryStatus, inWindow: false };
				});
			} else {
				// During prefill/decode-write, mark all non-empty blocks as in window
				const updated = entries.map((e) => {
					if (e.status !== "empty" && e.status !== "evicted") {
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
						if (item.status !== "empty" && item.status !== "evicted" && item.status !== "pinned") {
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

			// Find a write target: fill empties in active blocks first, then allocate a new block.
			let targetSlot = findWriteSlot(next);
			if (targetSlot < 0) {
				// No free slots anywhere -> evict according to policy and retry.
				evictForWrite(next);
				targetSlot = findWriteSlot(next);
			}
			if (targetSlot >= 0) {
				writeClockRef.current += 1;
				const anyPrev = next[targetSlot] as KVEntry & { writeId?: number };
				next[targetSlot] = {
					...anyPrev,
					token: tokenLabel ?? `Token ${currentIndex + 1}`,
					status: "new",
					slotIndex: targetSlot,
					writeId: writeClockRef.current,
				} as KVEntry;
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
		<>
			<section className="header-section" style={{ display: "grid", gap: "4px", marginBottom: "12px" }}>
				<div className="status-badges" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
					<div className="status-badge" style={{ fontSize: "14px", color: "#10b981", fontWeight: 600,margin: 5 }}>
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
					<div className="kv-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "14px" }}>GPU: KV Cache Blocks</div>
						<div style={{ fontSize: "10px", color: "#64748b", background: "#1e293b", padding: "2px 6px", borderRadius: "3px" }}>Paged KV Storage</div>
					</div>
					<div style={{ fontSize: "11px", color: "#94a3b8" }}>
						{mode === "prefill" ? "Prefill: process all tokens sequentially" : "Decode: read KV → generate token → write new KV"}
					</div>
				</div>
				<div className="kv-blocks-scroll" style={{ overflowX: "auto", overflowY: "visible" }}>
					<KVBlocks blocks={BLOCK_COUNT} capacityPerBlock={BLOCK_CAPACITY} entries={entries} />
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
   
