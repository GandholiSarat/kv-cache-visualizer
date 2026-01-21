"use client";

// Div-based KV cache block visualization with prompt ownership metadata.

import React from "react";
import type { MultiKVEntry, MultiKVEntryStatus } from "@/core/types";

export interface MultiKVBlocksProps {
	blocks: number;
	capacityPerBlock: number;
	entries: MultiKVEntry[];
	promptColors: string[];
}

const STATUS_BORDER_COLORS: Record<Exclude<MultiKVEntryStatus, "empty">, string> = {
	new: "#2563eb",
	reused: "#16a34a",
	pinned: "#8b5cf6",
	evicted: "#64748b",
	inactive: "#475569",
};

export function MultiKVBlocks({ blocks, capacityPerBlock, entries, promptColors }: MultiKVBlocksProps) {
	const totalSlots = blocks * capacityPerBlock;
	const paddedEntries: MultiKVEntry[] = Array.from({ length: totalSlots }, (_, idx) => {
		return entries[idx] ?? { token: "", status: "empty" };
	});

	return (
		<div style={{ display: "grid", gap: "12px", minWidth: "280px" }}>
			{Array.from({ length: blocks }).map((_, blockIndex) => {
				const start = blockIndex * capacityPerBlock;
				const blockEntries = paddedEntries.slice(start, start + capacityPerBlock);

				return (
					<div
						key={blockIndex}
						style={{
							border: "1px solid #1e293b",
							borderRadius: "8px",
							padding: "10px",
							background: "#0b1220",
						}}
					>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "8px",
								color: "#e2e8f0",
								fontSize: "13px",
								fontWeight: 600,
							}}
						>
							<span>Block {blockIndex + 1}</span>
							<span style={{ color: "#94a3b8", fontSize: "12px" }}>
								Capacity {blockEntries.filter((e) => e.status !== "empty" && e.status !== "evicted").length}/{capacityPerBlock}
							</span>
						</div>

						<div
							className="kv-block-grid"
							style={{
								display: "grid",
								gridTemplateColumns: `repeat(${capacityPerBlock}, 1fr)`,
								gap: "6px",
								minWidth: "280px",
							}}
						>
							{blockEntries.map((entry, idx) => {
								const globalSlot = start + idx;
								const blockSlot = idx;
								const isEmpty = entry.status === "empty";
								const isEvicted = entry.status === "evicted";
								const isInactive = entry.status === "inactive";
								const showPin = entry.status === "pinned";

								const ownerColor =
									!isEmpty && entry.promptId != null && promptColors[entry.promptId]
										? promptColors[entry.promptId]
										: "#1e293b";

								const borderColor = isEmpty
									? "#334155"
									: STATUS_BORDER_COLORS[entry.status as Exclude<MultiKVEntryStatus, "empty">] ?? "#0f172a";

								const tokenTextColor = isEmpty ? "#475569" : isInactive ? "#cbd5e1" : "#0b1220";
								const overlayTextColor = "#0b1220";

								const promptLabel = entry.promptId != null ? `P${entry.promptId + 1}` : undefined;
								const posLabel = entry.promptPos != null ? entry.promptPos + 1 : undefined;

								return (
									<div
										key={idx}
										style={{
											height: "42px",
											borderRadius: "6px",
											background: isEmpty ? "#1e293b" : ownerColor,
											border: isEmpty ? "1px dashed #334155" : `2px solid ${borderColor}`,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											color: tokenTextColor,
											fontSize: "10px",
											textOverflow: "ellipsis",
											overflow: "hidden",
											whiteSpace: "nowrap",
											opacity: isEvicted ? 0.35 : isInactive ? 0.6 : 1,
											transition: "opacity 0.35s ease",
											position: "relative",
										}}
										title={
											isEmpty
												? `Empty (block ${blockIndex + 1}, slot ${blockSlot + 1})`
												: `${promptLabel ?? "?"} • pos ${posLabel ?? "?"} • block ${blockIndex + 1} slot ${blockSlot + 1} (global ${globalSlot + 1}) • ${entry.token}`
										}
									>
										{showPin && (
											<div style={{ position: "absolute", top: "4px", right: "4px", fontSize: "8px" }}>
												🔒
											</div>
										)}

										{promptLabel && !isEmpty && (
											<div
												style={{
													position: "absolute",
													left: "4px",
													top: "4px",
													fontSize: "8px",
													fontWeight: 800,
													padding: "1px 4px",
													borderRadius: "4px",
													background: "rgba(2, 6, 23, 0.55)",
													color: "#e2e8f0",
													border: "1px solid rgba(226, 232, 240, 0.18)",
												}}
											>
												{promptLabel}
											</div>
										)}

										{posLabel != null && !isEmpty && (
											<div
												style={{
													position: "absolute",
													right: "4px",
													bottom: "4px",
													fontSize: "8px",
													fontWeight: 800,
													color: overlayTextColor,
													opacity: 0.85,
												}}
											>
												{posLabel}
											</div>
										)}

										<span style={{ flex: 1, textAlign: "center" }}>{entry.token || "Empty"}</span>
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
