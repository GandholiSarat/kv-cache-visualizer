"use client";

// Conceptual memory usage summary for block-based KV cache.

export interface MemoryStatsProps {
	totalSlots: number;
	newCount: number;
	reusedCount: number;
	retainedCount?: number;
	pinnedCount: number;
	emptyCount: number;
}

export function MemoryStats({ totalSlots, newCount, reusedCount, retainedCount = 0, pinnedCount, emptyCount }: MemoryStatsProps) {
	const used = newCount + reusedCount + retainedCount + pinnedCount;
	const usedPercent = Math.min(100, Math.round((used / totalSlots) * 100));
	const barColor = usedPercent > 85 ? "#f59e0b" : usedPercent > 60 ? "#10b981" : "#2563eb";

	return (
		<div
			className="memory-stats"
			style={{
				color: "#e2e8f0",
			}}
		>
			<div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", marginBottom: "10px" }}>
				KV Cache Blocks
			</div>
			<div style={{ fontSize: "24px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>
				{used}/{totalSlots} slots used
			</div>

			<div
				style={{
					height: "6px",
					background: "#0f172a",
					borderRadius: "3px",
					marginTop: "8px",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						height: "100%",
						background: barColor,
						width: `${usedPercent}%`,
						transition: "width 0.25s ease",
					}}
				/>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "12px" }}>
				<StatChip label="New" value={newCount} color="#2563eb" />
				<StatChip label="Reused (attention reads)" value={reusedCount} color="#16a34a" />
				{retainedCount > 0 && <StatChip label="Retained (not attended)" value={retainedCount} color="#475569" />}
				{pinnedCount > 0 && <StatChip label="Pinned" value={pinnedCount} color="#8b5cf6" />}
				<StatChip label="Empty" value={emptyCount} color="#475569" />
			</div>
		</div>
	);
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<div
			style={{
				border: `1px solid ${color}`,
				borderRadius: "6px",
				padding: "8px",
				textAlign: "center",
				color,
				fontSize: "12px",
				fontWeight: 600,
				background: "#0f172a",
			}}
		>
			<div style={{ fontSize: "11px", color: "#cbd5e1", marginBottom: "4px" }}>{label}</div>
			<div style={{ fontSize: "16px", color }}>{value}</div>
		</div>
	);
}
