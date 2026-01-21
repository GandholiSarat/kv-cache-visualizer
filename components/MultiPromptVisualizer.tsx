"use client";

// Multi-prompt (continuous batching) KV cache visualizer.
// Conceptual, client-only, block-based; no tensor math.

import { useEffect, useMemo, useRef, useState } from "react";
import { MemoryStats } from "./MemoryStats";
import { MultiKVBlocks, type MultiKVEntry, type MultiKVEntryStatus } from "./MultiKVBlocks";
import { MultiPromptControls, type MultiVisualizationMode } from "./MultiPromptControls";
import KVCacheExplanation from "./KVCacheExplanation";
import { DEFAULT_EVICTION_POLICY, DEFAULT_RECENT_N_WINDOW, EvictionPolicy } from "../lib/constants";

const BLOCK_COUNT = 4;
const BLOCK_CAPACITY = 8;
const TOTAL_SLOTS = BLOCK_COUNT * BLOCK_CAPACITY;

const PROMPT_COLORS = ["#38bdf8", "#fb7185", "#a78bfa", "#34d399"]; // P1..P4

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

type FlatToken = { promptId: number; token: string; promptPos: number };

function countOccupied(entries: MultiKVEntry[]): number {
	return entries.filter((e) => e.status !== "empty" && e.status !== "evicted").length;
}

export function MultiPromptVisualizer() {
	const [promptCount, setPromptCount] = useState(2);
	const [prompts, setPrompts] = useState<string[]>([
		"Hello!",
		"Can you summarize this?",
		"What is continuous batching?",
		"Explain KV cache eviction.",
	]);

	const [mode, setMode] = useState<MultiVisualizationMode>("prefill");
	const [prefillIndex, setPrefillIndex] = useState(0);
	const [entries, setEntries] = useState<MultiKVEntry[]>(() => Array.from({ length: TOTAL_SLOTS }, () => ({ token: "", status: "empty" })));
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [inferenceTick, setInferenceTick] = useState(0);
	const [phase, setPhase] = useState<"prefill" | "decode-read" | "decode-write">("prefill");
	const [evictionPolicy, setEvictionPolicy] = useState<EvictionPolicy>(DEFAULT_EVICTION_POLICY);
	const [recentNWindow, setRecentNWindow] = useState(DEFAULT_RECENT_N_WINDOW);
	const [decodeSteps, setDecodeSteps] = useState(0);
	const timerRef = useRef<number | null>(null);
	const writeClockRef = useRef(0);

	const activePrompts = useMemo(() => prompts.slice(0, promptCount), [prompts, promptCount]);
	const promptTokens = useMemo(() => activePrompts.map(tokenizePrompt), [activePrompts]);

	const prefillStream: FlatToken[] = useMemo(() => {
		const stream: FlatToken[] = [];
		for (let promptId = 0; promptId < promptTokens.length; promptId++) {
			const tokens = promptTokens[promptId];
			for (let i = 0; i < tokens.length; i++) {
				stream.push({ promptId, token: tokens[i], promptPos: i });
			}
		}
		return stream;
	}, [promptTokens]);

	const promptBlockOwnership = useMemo(() => {
		const ownership: Map<number, number[]> = new Map();
		for (let promptId = 0; promptId < promptTokens.length; promptId++) {
			ownership.set(promptId, []);
		}
		const blockOwners: Map<number, number | null> = new Map();
		for (let b = 0; b < BLOCK_COUNT; b++) {
			const { start, end } = blockSlice(b);
			let owner: number | null = null;
			for (let i = start; i < end; i++) {
				const e = entries[i];
				if (e.status !== "empty" && e.status !== "evicted" && typeof e.promptId === "number") {
					if (owner === null) owner = e.promptId;
					else if (owner !== e.promptId) {
						owner = null;
						break;
					}
				}
			}
			blockOwners.set(b, owner);
			if (owner !== null) {
				const blocks = ownership.get(owner) || [];
				blocks.push(b);
				ownership.set(owner, blocks);
			}
		}
		return ownership;
	}, [entries, promptTokens.length]);

	const freeBlocks = useMemo(() => {
		const free: number[] = [];
		for (let b = 0; b < BLOCK_COUNT; b++) {
			const { start, end } = blockSlice(b);
			let hasOccupied = false;
			for (let i = start; i < end; i++) {
				if (entries[i].status !== "empty" && entries[i].status !== "evicted") {
					hasOccupied = true;
					break;
				}
			}
			if (!hasOccupied) free.push(b);
		}
		return free;
	}, [entries]);

	function reset() {
		setIsPlaying(false);
		if (timerRef.current) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setMode("prefill");
		setPhase("prefill");
		setPrefillIndex(0);
		setDecodeSteps(0);
		setInferenceTick(0);
		setEntries(Array.from({ length: TOTAL_SLOTS }, () => ({ token: "", status: "empty" })));
		writeClockRef.current = 0;
	}

	function isFreeStatus(status: MultiKVEntryStatus): boolean {
		return status === "empty" || status === "evicted";
	}

	function blockSlice(blockIndex: number): { start: number; end: number } {
		const start = blockIndex * BLOCK_CAPACITY;
		return { start, end: start + BLOCK_CAPACITY };
	}

	function blockOccupiedCount(next: MultiKVEntry[], blockIndex: number): number {
		const { start, end } = blockSlice(blockIndex);
		let occupied = 0;
		for (let i = start; i < end; i++) {
			if (!isFreeStatus(next[i].status)) occupied++;
		}
		return occupied;
	}

	function blockHasAnyOccupied(next: MultiKVEntry[], blockIndex: number): boolean {
		return blockOccupiedCount(next, blockIndex) > 0;
	}

	function isBlockCompletelyFree(next: MultiKVEntry[], blockIndex: number): boolean {
		return blockOccupiedCount(next, blockIndex) === 0;
	}

	function isBlockFull(next: MultiKVEntry[], blockIndex: number): boolean {
		return blockOccupiedCount(next, blockIndex) >= BLOCK_CAPACITY;
	}

	function getBlockLastWriteId(next: MultiKVEntry[], blockIndex: number): number {
		const { start, end } = blockSlice(blockIndex);
		let maxId = -1;
		for (let i = start; i < end; i++) {
			const anyEntry = next[i] as MultiKVEntry & { writeId?: number };
			if (!isFreeStatus(anyEntry.status) && typeof anyEntry.writeId === "number") {
				maxId = Math.max(maxId, anyEntry.writeId);
			}
		}
		return maxId;
	}

	function evictFullBlock(next: MultiKVEntry[]): boolean {
		const candidateBlocks: number[] = [];
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (evictionPolicy === EvictionPolicy.PinnedPrefix && b === 0) continue;
			if (isBlockFull(next, b)) candidateBlocks.push(b);
		}
		if (candidateBlocks.length === 0) return false;

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
				next[i] = { ...next[i], status: "evicted" as MultiKVEntryStatus };
			}
		}
		return true;
	}

	function findFirstFreeInBlock(next: MultiKVEntry[], blockIndex: number): number {
		const { start, end } = blockSlice(blockIndex);
		for (let i = start; i < end; i++) {
			if (isFreeStatus(next[i].status)) return i;
		}
		return -1;
	}

	function getBlockSingleOwnerPromptId(next: MultiKVEntry[], blockIndex: number): number | null {
		const { start, end } = blockSlice(blockIndex);
		let owner: number | null = null;
		for (let i = start; i < end; i++) {
			const e = next[i];
			if (isFreeStatus(e.status)) continue;
			if (typeof e.promptId !== "number") continue;
			if (owner === null) owner = e.promptId;
			else if (owner !== e.promptId) return null;
		}
		return owner;
	}

	function findWriteSlotPrefill(next: MultiKVEntry[], promptId: number): number {
		// Prefill invariant (authoritative): blocks are prompt-aligned.
		// - Each prompt starts in a fresh block
		// - During prefill, a block belongs to exactly one prompt
		// - Do NOT steal empty slots from other prompts' partially-filled blocks

		// 1) Continue filling an existing block owned by this prompt, if it has space.
		for (let b = 0; b < BLOCK_COUNT; b++) {
			const owner = getBlockSingleOwnerPromptId(next, b);
			if (owner !== promptId) continue;
			const slot = findFirstFreeInBlock(next, b);
			if (slot >= 0) return slot;
		}

		// 2) Otherwise allocate a new, completely free block for this prompt.
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (isBlockCompletelyFree(next, b)) return b * BLOCK_CAPACITY;
		}
		return -1;
	}

	function findWriteSlotDecode(next: MultiKVEntry[], promptId: number): number {
		// Decode invariant (authoritative): blocks are prompt-owned.
		// Each prompt appends only to its own blocks. No global reuse pool.
		// - Find the last block already owned by this prompt
		// - If it has empty slots, use them
		// - If full, allocate a new block for this prompt
		// - Never search other prompts' empty slots

		// 1) Identify blocks currently owned by this prompt.
		// IMPORTANT: ownership alone is not enough to infer the append position.
		// We must append to the prompt's *tail* block (the one with the most recent write),
		// not just the highest/lowest indexed owned block.
		let tailBlock: number | null = null;
		let tailLastWriteId = -1;
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (getBlockSingleOwnerPromptId(next, b) !== promptId) continue;
			const last = getBlockLastWriteId(next, b);
			if (last > tailLastWriteId) {
				tailLastWriteId = last;
				tailBlock = b;
			}
		}

		// 2) Try to use the tail block if it has space.
		if (tailBlock !== null) {
			const slot = findFirstFreeInBlock(next, tailBlock);
			if (slot >= 0) return slot;
		}

		// 3) Allocate a fresh block for this prompt.
		for (let b = 0; b < BLOCK_COUNT; b++) {
			if (isBlockCompletelyFree(next, b)) return b * BLOCK_CAPACITY;
		}
		return -1;
	}

	function applyPolicyVisuals(next: MultiKVEntry[], isDecodeRead: boolean): MultiKVEntry[] {
		if (evictionPolicy === EvictionPolicy.PinnedPrefix) {
			return next.map((e, idx) => {
				if (idx === 0 && e.status !== "empty" && e.status !== "pinned" && e.status !== "evicted") {
					return { ...e, status: "pinned" };
				}
				return e;
			});
		}

		if (evictionPolicy === EvictionPolicy.RecentN && isDecodeRead) {
			const nonEmptyIndices: number[] = [];
			for (let i = 0; i < next.length; i++) {
				const st = next[i].status;
				if (st !== "empty" && st !== "evicted") nonEmptyIndices.push(i);
			}

			const recentCount = Math.min(nonEmptyIndices.length, recentNWindow);
			const recentStartIdx = nonEmptyIndices.length - recentCount;

			return next.map((e, idx) => {
				if (e.status === "empty" || e.status === "evicted") return e;
				const positionInNonEmpty = nonEmptyIndices.indexOf(idx);
				if (positionInNonEmpty >= recentStartIdx) {
					return { ...e, status: "reused" };
				}
				return { ...e, status: "inactive" };
			});
		}

		return next;
	}

	function writeEntryAt(next: MultiKVEntry[], slotIndex: number, entry: Omit<MultiKVEntry, "status"> & { status?: MultiKVEntryStatus }) {
		writeClockRef.current += 1;
		const anyPrev = next[slotIndex] as MultiKVEntry & { writeId?: number };
		next[slotIndex] = {
			...anyPrev,
			token: entry.token,
			status: entry.status ?? "new",
			promptId: entry.promptId,
			promptPos: entry.promptPos,
			writeId: writeClockRef.current,
		} as MultiKVEntry;
	}

	function stepToken() {
		setInferenceTick((tick) => tick + 1);

		if (mode === "prefill" && prefillIndex >= prefillStream.length) {
			setMode("decode");
			setPhase("decode-read");
			return;
		}

		setEntries((prev) => {
			const next = prev.map((e) => ({ ...e }));
			const isDecode = mode === "decode";

			if (isDecode) {
				// Read phase: visualize reuse.
				if (evictionPolicy === EvictionPolicy.SlidingWindow || evictionPolicy === EvictionPolicy.PinnedPrefix) {
					for (let i = 0; i < next.length; i++) {
						const e = next[i];
						if (e.status !== "empty" && e.status !== "evicted" && e.status !== "pinned") {
							e.status = "reused";
						}
					}
				}
				setPhase("decode-read");
			} else {
				setPhase("prefill");
			}

			// Write phase
			const toWrite: FlatToken[] = [];
			if (!isDecode) {
				const item = prefillStream[prefillIndex];
				if (item) toWrite.push(item);
			} else {
				for (let promptId = 0; promptId < promptTokens.length; promptId++) {
					const base = promptTokens[promptId].length;
					toWrite.push({ promptId, token: "<gen>", promptPos: base + decodeSteps });
				}
			}

			for (const item of toWrite) {
				let target = isDecode ? findWriteSlotDecode(next, item.promptId) : findWriteSlotPrefill(next, item.promptId);
				if (target < 0) {
					// No suitable slot: evict a FULL block (never partial) and retry.
					evictFullBlock(next);
					target = isDecode ? findWriteSlotDecode(next, item.promptId) : findWriteSlotPrefill(next, item.promptId);
				}
				if (target >= 0) {
					writeEntryAt(next, target, { token: item.token, promptId: item.promptId, promptPos: item.promptPos, status: "new" });
				}
			}

			const visual = applyPolicyVisuals(next, isDecode);
			for (let i = 0; i < next.length; i++) {
				next[i] = visual[i];
			}

			if (isDecode) {
				setPhase("decode-write");
			}

			return next;
		});

		if (mode === "prefill") {
			setPrefillIndex((v) => v + 1);
		} else {
			setDecodeSteps((v) => v + 1);
		}
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
	}, [isPlaying, speed, mode, prefillIndex, prefillStream.length, decodeSteps, promptTokens.length, evictionPolicy, recentNWindow]);

	const progressLabel =
		mode === "prefill"
			? `Prefill (continuous batching): ${Math.min(prefillIndex, prefillStream.length)}/${prefillStream.length} flattened tokens`
			: `Decode step ${decodeSteps + 1}: +${promptTokens.length} tokens (1 per prompt)`;

	const phaseLabel = phase === "prefill" ? "Prefill (prompt-aligned blocks)" : phase === "decode-read" ? "Decode: Read KV" : "Decode: Write new KV";

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
				className="multi-prompt-grid"
				style={{
					display: "grid",
					gridTemplateColumns: "minmax(280px, 300px) 1fr minmax(350px, 400px)",
					gap: "16px",
					alignItems: "start",
					maxWidth: "1600px",
					margin: "0 auto",
					width: "100%",
				}}
			>
			{/* Left: Controls */}
			<div className="controls-column" style={{ display: "grid", gap: "16px", gridColumn: "1 / 2", gridRow: "1 / 3" }}>
				<MultiPromptControls
					promptCount={promptCount}
					onPromptCountChange={(count) => {
						setPromptCount(count);
						reset();
					}}
					prompts={prompts}
					onPromptChange={(idx, text) => {
						setPrompts((prev) => {
							const next = [...prev];
							next[idx] = text;
							return next;
						});
						reset();
					}}
					promptColors={PROMPT_COLORS}
					mode={mode}
					onModeToggle={() => {
						setMode((prev) => (prev === "prefill" ? "decode" : "prefill"));
						reset();
					}}
					onStep={stepToken}
					onReset={reset}
					progressLabel={progressLabel}
					disableStep={false}
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
					onRecentNWindowChange={(value) => {
						setRecentNWindow(value);
						reset();
					}}
				/>
			</div>

			{/* Right Column: Legend and CPU (stacked) */}
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
					<div style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px" }}>Legend</div>
					<div style={{ display: "grid", gap: "10px", fontSize: "12px" }}>
						<div style={{ display: "grid", gap: "6px" }}>
							<div style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1" }}>Prompt Ownership (Color)</div>
							{Array.from({ length: promptCount }).map((_, i) => (
								<div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
									<div style={{ width: "14px", height: "14px", borderRadius: "3px", background: PROMPT_COLORS[i] }} />
									<span style={{ color: "#cbd5e1" }}>P{i + 1} owns its block chain</span>
								</div>
							))}
						</div>

						<div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #1e293b", display: "grid", gap: "6px" }}>
							<div style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1" }}>Slot Status (Border)</div>
						<ColorKey color="#2563eb" label="Blue = KV written this step" />
						<ColorKey color="#16a34a" label="Green = KV reused (decode read)" />
						<ColorKey color="#8b5cf6" label="Purple = Pinned (never evicted)" />
						<ColorKey color="#475569" label="Dimmed = Retained but inactive" />
						<ColorKey color="#64748b" label="Greyed = Evicted (→ free queue)" />
						</div>
					</div>
				</div>

				{/* CPU Panel - Bottom */}
				<div
					className="mobile-panel"
					style={{
						padding: "16px",
						border: "1px solid #1e293b",
						borderRadius: "8px",
						background: "#0b1220",
					}}
				>
					<div style={{ fontSize: "15px", fontWeight: 700, color: "#e2e8f0", marginBottom: "10px" }}>CPU: KV Cache Manager</div>
					<div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "10px" }}>Metadata & allocation (not KV storage)</div>

					{/* Free Block Queue */}
					<div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #1e293b" }}>
						<div style={{ fontSize: "14px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>Free Blocks</div>
						{freeBlocks.length > 0 ? (
							<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
								{freeBlocks.map((b, idx) => (
									<div
										key={b}
										style={{
											padding: "4px 8px",
											background: "#1e293b",
											border: "1px solid #475569",
											borderRadius: "4px",
											fontSize: "10px",
											color: "#cbd5e1",
											display: "flex",
											alignItems: "center",
											gap: "4px",
										}}
									>
										Block {b}
										{idx < freeBlocks.length - 1 && <span style={{ color: "#64748b" }}>→</span>}
									</div>
								))}
							</div>
						) : (
							<div style={{ fontSize: "10px", color: "#64748b", fontStyle: "italic" }}>No free blocks (cache full)</div>
						)}
					</div>

					{/* Per-Prompt Block Ownership */}
					<div>
						<div style={{ fontSize: "14px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>Block Ownership</div>
						<div style={{ display: "grid", gap: "6px" }}>
							{Array.from({ length: promptCount }).map((_, promptId) => {
								const blocks = promptBlockOwnership.get(promptId) || [];
								return (
									<div
										key={promptId}
										style={{
											padding: "6px 8px",
											background: "#1e293b",
											borderRadius: "4px",
											fontSize: "12px",
											borderLeft: `3px solid ${PROMPT_COLORS[promptId]}`,
										}}
									>
										<span style={{ fontWeight: 600, color: PROMPT_COLORS[promptId] }}>P{promptId + 1}</span>
										<span style={{ color: "#94a3b8" }}>
											{blocks.length > 0 ? ` → Block ${blocks.join(", Block ")}` : " → (no blocks allocated)"}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>

			{/* Center: GPU KV Storage */}
			<div
				className="kv-visualization-container gpu-column mobile-panel"
				style={{
					border: "1px solid #1e293b",
					borderRadius: "8px",
					background: "#0b1220",
					padding: "12px",
					gridColumn: "2 / 3",
					gridRow: "1 / 3",
				}}
			>
				<div className="kv-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "14px" }}>GPU: KV Cache Blocks</div>
						<div style={{ fontSize: "10px", color: "#64748b", background: "#1e293b", padding: "2px 6px", borderRadius: "3px" }}>Paged KV Storage</div>
					</div>
					<div style={{ fontSize: "11px", color: "#94a3b8" }}>
						{mode === "prefill" ? "Prefill is prompt-aligned (no mixed blocks)" : "Batched decode (1 token per prompt)"}
					</div>
				</div>
				<div className="kv-blocks-scroll" style={{ overflowX: "auto", overflowY: "visible" }}>
					<MultiKVBlocks blocks={BLOCK_COUNT} capacityPerBlock={BLOCK_CAPACITY} entries={entries} promptColors={PROMPT_COLORS} />
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
			<KVCacheExplanation />
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
