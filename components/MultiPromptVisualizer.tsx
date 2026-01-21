"use client";

// Multi-prompt (continuous batching) KV cache visualizer.
// Presentational component: receives all state via props.

import { MultiKVBlocks } from "./MultiKVBlocks";
import type { MultiKVEntry } from "@/core/types";
import { MultiPromptControls, type MultiVisualizationMode } from "./MultiPromptControls";
import KVCacheExplanation from "./KVCacheExplanation";
import { EvictionPolicy } from "../lib/constants";

export interface MultiPromptVisualizerProps {
	promptCount: number;
	prompts: string[];
	onPromptCountChange: (count: number) => void;
	onPromptChange: (promptIndex: number, text: string) => void;
	promptColors: string[];

	mode: MultiVisualizationMode;
	onModeToggle: () => void;
	onStep: () => void;
	onReset: () => void;
	progressLabel: string;
	disableStep: boolean;
	isPlaying: boolean;
	onPlayToggle: () => void;
	speed: number;
	onSpeedChange: (speed: number) => void;

	evictionPolicy: EvictionPolicy;
	onEvictionPolicyChange: (policy: EvictionPolicy) => void;
	recentNWindow: number;
	onRecentNWindowChange: (value: number) => void;

	inferenceTick: number;
	phaseLabel: string;

	entries: MultiKVEntry[];
	blocks: number;
	capacityPerBlock: number;
	freeBlocks: number[];
	promptBlockOwnership: Map<number, number[]>;
}

export function MultiPromptVisualizer({
	promptCount,
	prompts,
	onPromptCountChange,
	onPromptChange,
	promptColors,
	mode,
	onModeToggle,
	onStep,
	onReset,
	progressLabel,
	disableStep,
	isPlaying,
	onPlayToggle,
	speed,
	onSpeedChange,
	evictionPolicy,
	onEvictionPolicyChange,
	recentNWindow,
	onRecentNWindowChange,
	inferenceTick,
	phaseLabel,
	entries,
	blocks,
	capacityPerBlock,
	freeBlocks,
	promptBlockOwnership,
}: MultiPromptVisualizerProps) {
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
					onPromptCountChange={onPromptCountChange}
					prompts={prompts}
					onPromptChange={onPromptChange}
					promptColors={promptColors}
					mode={mode}
					onModeToggle={onModeToggle}
					onStep={onStep}
					onReset={onReset}
					progressLabel={progressLabel}
					disableStep={disableStep}
					isPlaying={isPlaying}
					onPlayToggle={onPlayToggle}
					speed={speed}
					onSpeedChange={onSpeedChange}
					evictionPolicy={evictionPolicy}
					onEvictionPolicyChange={onEvictionPolicyChange}
					recentNWindow={recentNWindow}
					onRecentNWindowChange={onRecentNWindowChange}
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
									<div style={{ width: "14px", height: "14px", borderRadius: "3px", background: promptColors[i] }} />
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
											borderLeft: `3px solid ${promptColors[promptId]}`,
										}}
									>
										<span style={{ fontWeight: 600, color: promptColors[promptId] }}>P{promptId + 1}</span>
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
					<MultiKVBlocks blocks={blocks} capacityPerBlock={capacityPerBlock} entries={entries} promptColors={promptColors} />
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
