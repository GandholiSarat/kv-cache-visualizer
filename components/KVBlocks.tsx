"use client";

// Div-based KV cache block visualization (conceptual, not to scale).

import React from "react";
import type { KVEntry, KVEntryStatus } from "@/core/types";

export interface KVBlocksProps {
  blocks: number;
  capacityPerBlock: number;
  entries: KVEntry[];
}

const STATUS_COLORS: Record<KVEntryStatus, string> = {
  empty: "#1e293b",
  new: "#2563eb",
  reused: "#16a34a",
  pinned: "#8b5cf6", // purple for pinned blocks
  evicted: "#64748b", // grey for evicted blocks (fade-out)
  inactive: "#475569", // desaturated slate for retained but inactive tokens
};

export function KVBlocks({ blocks, capacityPerBlock, entries }: KVBlocksProps) {
  const totalSlots = blocks * capacityPerBlock;
  const paddedEntries: KVEntry[] = Array.from({ length: totalSlots }, (_, idx) => {
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
                minWidth: "280px"
              }}
            >
              {blockEntries.map((entry, idx) => {
                const color = STATUS_COLORS[entry.status];
                const showPin = entry.status === "pinned";
                const isEvicted = entry.status === "evicted";
                const isInactive = entry.status === "inactive";
                const textColor = entry.status === "empty" ? "#475569" : isInactive ? "#94a3b8" : "#e2e8f0";
                return (
                  <div
                    key={idx}
                    style={{
                      height: "42px",
                      borderRadius: "6px",
                      background: color,
                      border: entry.status === "empty" ? "1px dashed #334155" : "1px solid #0f172a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: textColor,
                      fontSize: "10px",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      opacity: isEvicted ? 0.6 : 1,
                      transition: "opacity 0.3s ease",
                      position: "relative",
                    }}
                    title={entry.token || "Empty"}
                  >
                    {showPin && (
                      <div style={{ position: "absolute", top: "4px", right: "4px", fontSize: "8px" }}>
                        🔒
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
