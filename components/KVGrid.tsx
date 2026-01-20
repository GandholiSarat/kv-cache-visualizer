"use client";

// Canvas-based token × layer grid visualization component.

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { KVCell } from "../lib/kvModel";

export interface KVGridProps {
	kvCells: KVCell[];
	numLayers: number;
	numTokens: number;
	cellSize: number;
}

type CellState = 0 | 1 | 2; // 0 = empty, 1 = new, 2 = reused

const COLOR_EMPTY = "#0f172a";
const COLOR_NEW = "#2563eb"; // blue
const COLOR_REUSED = "#16a34a"; // green
const COLOR_GRID = "#1e293b";
const COLOR_HOVER = "#f8fafc";

export function KVGrid({ kvCells, numLayers, numTokens, cellSize }: KVGridProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
	const hoverRef = useRef<{ token: number; layer: number } | null>(null);

	// Build a compact state buffer for O(1) cell lookup during drawing.
	const stateBuffer = useMemo(() => {
		const totalCells = Math.max(0, numTokens * numLayers);
		const buffer = new Uint8Array(totalCells) as Uint8Array & { [index: number]: CellState };

		for (const cell of kvCells) {
			if (
				cell.tokenIndex < 0 ||
				cell.layerIndex < 0 ||
				cell.tokenIndex >= numTokens ||
				cell.layerIndex >= numLayers
			) {
				continue;
			}
			const index = cell.layerIndex * numTokens + cell.tokenIndex;
			buffer[index] = cell.state === "new" ? 1 : 2;
		}

		return buffer;
	}, [kvCells, numLayers, numTokens]);

	const draw = useCallback((hover?: { token: number; layer: number } | null) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const baseCanvas = baseCanvasRef.current;
		if (!baseCanvas) return;

		const width = numTokens * cellSize;
		const height = numLayers * cellSize;
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}

		// Fast path: draw cached base image, then overlay hover.
		ctx.clearRect(0, 0, width, height);
		ctx.drawImage(baseCanvas, 0, 0);

		if (hover) {
			ctx.strokeStyle = COLOR_HOVER;
			ctx.lineWidth = 2;
			ctx.strokeRect(
				hover.token * cellSize + 1,
				hover.layer * cellSize + 1,
				cellSize - 2,
				cellSize - 2
			);
		}
	}, [numTokens, cellSize]);

	useEffect(() => {
		const width = numTokens * cellSize;
		const height = numLayers * cellSize;

		if (!baseCanvasRef.current) {
			baseCanvasRef.current = document.createElement("canvas");
		}

		const baseCanvas = baseCanvasRef.current;
		if (!baseCanvas) return;

		if (sizeRef.current.width !== width || sizeRef.current.height !== height) {
			baseCanvas.width = width;
			baseCanvas.height = height;
			sizeRef.current = { width, height };
		}

		const baseCtx = baseCanvas.getContext("2d");
		if (!baseCtx) return;

		// Single draw loop for all cells to avoid per-cell React renders.
		baseCtx.clearRect(0, 0, width, height);
		baseCtx.fillStyle = COLOR_EMPTY;
		baseCtx.fillRect(0, 0, width, height);

		for (let layerIndex = 0; layerIndex < numLayers; layerIndex += 1) {
			const rowOffset = layerIndex * numTokens;
			for (let tokenIndex = 0; tokenIndex < numTokens; tokenIndex += 1) {
				const state = stateBuffer[rowOffset + tokenIndex] as CellState;
				if (state === 0) continue;

				baseCtx.fillStyle = state === 1 ? COLOR_NEW : COLOR_REUSED;
				baseCtx.fillRect(
					tokenIndex * cellSize,
					layerIndex * cellSize,
					cellSize,
					cellSize
				);
			}
		}

		// Lightweight grid overlay for legibility.
		baseCtx.strokeStyle = COLOR_GRID;
		baseCtx.lineWidth = 1;
		for (let x = 0; x <= numTokens; x += 1) {
			const xPos = x * cellSize + 0.5;
			baseCtx.beginPath();
			baseCtx.moveTo(xPos, 0);
			baseCtx.lineTo(xPos, height);
			baseCtx.stroke();
		}
		for (let y = 0; y <= numLayers; y += 1) {
			const yPos = y * cellSize + 0.5;
			baseCtx.beginPath();
			baseCtx.moveTo(0, yPos);
			baseCtx.lineTo(width, yPos);
			baseCtx.stroke();
		}

		draw(hoverRef.current);
		// Redraw only when inputs change, not per-cell, to keep React out of the loop.
	}, [stateBuffer, numLayers, numTokens, cellSize, draw]);

	const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const token = Math.floor(x / cellSize);
		const layer = Math.floor(y / cellSize);

		if (token < 0 || layer < 0 || token >= numTokens || layer >= numLayers) {
			if (hoverRef.current) {
				hoverRef.current = null;
				draw(null);
			}
			return;
		}

		const prev = hoverRef.current;
		if (!prev || prev.token !== token || prev.layer !== layer) {
			hoverRef.current = { token, layer };
			draw(hoverRef.current);
		}
	};

	const handleMouseLeave = () => {
		if (hoverRef.current) {
			hoverRef.current = null;
			draw(null);
		}
	};

	return (
		<canvas
			ref={canvasRef}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			aria-label="KV cache grid"
			role="img"
			style={{ display: "block" }}
		/>
	);
}
