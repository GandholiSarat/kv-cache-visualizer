"use client";

// UI controls for multi-prompt (continuous batching) mode.

import { EvictionPolicy } from "../lib/constants";

export type MultiVisualizationMode = "prefill" | "decode";

export interface MultiPromptControlsProps {
	promptCount: number;
	onPromptCountChange: (count: number) => void;
	prompts: string[];
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
}

export function MultiPromptControls({
	promptCount,
	onPromptCountChange,
	prompts,
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
}: MultiPromptControlsProps) {
	const speedLabel = speed === 0.25 ? "0.25×" : speed === 0.5 ? "0.5×" : speed === 1 ? "1×" : speed === 2 ? "2×" : "4×";

	return (
		<div
			className="controls-panel"
			style={{
				display: "grid",
				gap: "12px",
				padding: "12px",
				border: "1px solid #1e293b",
				borderRadius: "8px",
				background: "#0b1220",
				color: "#e2e8f0",
			}}
		>
			<div>
				<div style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
					Multi-Prompt Inputs
				</div>
				<div style={{ display: "grid", gap: "8px" }}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<div style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1" }}>Prompts</div>
						<select
							value={promptCount}
							onChange={(e) => onPromptCountChange(parseInt(e.target.value))}
							className="mobile-select"
							style={{
								padding: "10px",
								minHeight: "44px",
								borderRadius: "6px",
								border: "1px solid #334155",
								background: "#0f172a",
								color: "#e2e8f0",
								fontSize: "13px",
								cursor: "pointer",
							}}
						>
							<option value={2}>2 prompts</option>
							<option value={3}>3 prompts</option>
							<option value={4}>4 prompts</option>
						</select>
					</div>

					{prompts.slice(0, promptCount).map((text, idx) => (
						<div key={idx} style={{ display: "grid", gap: "6px" }}>
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
								<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
									<div style={{ width: "10px", height: "10px", borderRadius: "3px", background: promptColors[idx] }} />
									<div style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}>P{idx + 1}</div>
								</div>
								<div style={{ fontSize: "11px", color: "#94a3b8" }}>Independent sequence</div>
							</div>
							<textarea
								value={text}
								onChange={(event) => onPromptChange(idx, event.target.value)}
								rows={2}
								placeholder={`Enter prompt for P${idx + 1}`}
								className="mobile-textarea"
								style={{
									width: "100%",
									padding: "10px",
									minHeight: "64px",
									borderRadius: "6px",
									border: "1px solid #334155",
									background: "#0f172a",
									color: "#e2e8f0",
									resize: "vertical",
									fontSize: "13px",
								}}
							/>
						</div>
					))}
				</div>
			</div>

			{/* Eviction Policy Selector (shared) */}
			<div>
				<div style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>Eviction Policy</div>
				<select
					value={evictionPolicy}
					onChange={(e) => onEvictionPolicyChange(e.target.value as EvictionPolicy)}
					className="mobile-select"
					style={{
						width: "100%",
						padding: "10px",
						minHeight: "44px",
						borderRadius: "6px",
						border: "1px solid #334155",
						background: "#0f172a",
						color: "#e2e8f0",
						fontSize: "13px",
						cursor: "pointer",
					}}
				>
					<option value={EvictionPolicy.SlidingWindow}>Sliding Window</option>
					<option value={EvictionPolicy.PinnedPrefix}>Pinned Prefix</option>
					<option value={EvictionPolicy.RecentN}>Recent-N Tokens</option>
				</select>
				<div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", lineHeight: 1.4 }}>
					{evictionPolicy === EvictionPolicy.SlidingWindow && "Evicts oldest tokens when cache is full."}
					{evictionPolicy === EvictionPolicy.PinnedPrefix && "Keeps the first slot pinned; evicts older context."}
					{evictionPolicy === EvictionPolicy.RecentN && "Shows attention reuse for only the last N tokens during decode."}
				</div>

				{evictionPolicy === EvictionPolicy.RecentN && (
					<div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #334155" }}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
							<label style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1" }}>Attention Window (N):</label>
							<span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981" }}>{recentNWindow}</span>
						</div>
						<input
							type="range"
							min="1"
							max="32"
							step="1"
							value={recentNWindow}
							onChange={(e) => onRecentNWindowChange(parseInt(e.target.value))}
							style={{ width: "100%", cursor: "pointer" }}
						/>
						<div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
							Only the last {recentNWindow} token{recentNWindow !== 1 ? "s" : ""} are highlighted as reused.
						</div>
					</div>
				)}
			</div>

			<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
				<span style={{ fontSize: "12px" }}>Mode:</span>
				<button
					type="button"
					onClick={onModeToggle}
					aria-pressed={mode === "decode"}
					className="mobile-button"
					style={{
						padding: "10px 16px",
						minHeight: "44px",
						borderRadius: "6px",
						border: "1px solid #334155",
						background: mode === "prefill" ? "#1e40af" : "#14532d",
						color: "#f8fafc",
						fontSize: "13px",
						fontWeight: 600,
						cursor: "pointer",
					}}
				>
					{mode === "prefill" ? "Prefill (batched)" : "Decode (batched)"}
				</button>
			</div>

			<div style={{ display: "flex", gap: "10px" }}>
				<button
					type="button"
					onClick={onPlayToggle}
					className="mobile-button"
					style={{
						width: "96px",
						padding: "10px 12px",
						minHeight: "44px",
						borderRadius: "6px",
						border: "1px solid #334155",
						background: isPlaying ? "#b45309" : "#0f766e",
						color: "#f8fafc",
						fontWeight: 700,
						fontSize: "13px",
						cursor: "pointer",
					}}
				>
					{isPlaying ? "Pause" : "Play"}
				</button>
				<button
					type="button"
					onClick={onStep}
					disabled={disableStep || isPlaying}
					className="mobile-button"
					style={{
						flex: 1,
						padding: "10px 12px",
						minHeight: "44px",
						borderRadius: "6px",
						border: "1px solid #334155",
						background: disableStep || isPlaying ? "#1e293b" : "#0f766e",
						color: "#f8fafc",
						fontWeight: 700,
						fontSize: "13px",
						cursor: disableStep || isPlaying ? "not-allowed" : "pointer",
						opacity: disableStep || isPlaying ? 0.5 : 1,
					}}
				>
					Step
				</button>
			</div>

			<button
				type="button"
				onClick={onReset}
				className="mobile-button"
				style={{
					padding: "10px 12px",
					minHeight: "44px",
					borderRadius: "6px",
					border: "1px solid #334155",
					background: "#b91c1c",
					color: "#f8fafc",
					fontWeight: 600,
					fontSize: "13px",
					cursor: "pointer",
				}}
			>
				Reset
			</button>

			<div style={{ borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
				<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
					<span style={{ fontSize: "13px", color: "#cbd5e1" }}>Speed</span>
					<span style={{ fontSize: "13px", fontWeight: 600, color: "#10b981" }}>{speedLabel}</span>
				</div>
				<input
					type="range"
					min="0"
					max="4"
					step="1"
					value={speed === 0.25 ? 0 : speed === 0.5 ? 1 : speed === 1 ? 2 : speed === 2 ? 3 : 4}
					onChange={(e) => {
						const val = Number(e.target.value);
						const speedMap = [0.25, 0.5, 1, 2, 4];
						onSpeedChange(speedMap[val]);
					}}
					style={{ width: "100%", cursor: "pointer" }}
				/>
			</div>

			<div style={{ fontSize: "12px", color: "#94a3b8" }}>{progressLabel}</div>
		</div>
	);
}
