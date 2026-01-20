// Memory usage calculations for KV cache.

export interface MemoryConfig {
	tokens: number;
	layers: number;
	heads: number;
	headDim: number;
	bytesPerElement?: number; // default: fp16 (2 bytes)
}

/**
 * Compute KV cache memory bytes using:
 * tokens × layers × heads × headDim × 2 (K+V) × bytesPerElement
 *
 * This maps to storing K and V vectors for every token and layer.
 */
export function calculateKVBytes({
	tokens,
	layers,
	heads,
	headDim,
	bytesPerElement = 2,
}: MemoryConfig): number {
	return tokens * layers * heads * headDim * 2 * bytesPerElement;
}

export function formatBytes(bytes: number): { value: number; unit: "MB" | "GB" } {
	const gb = 1024 * 1024 * 1024;
	if (bytes >= gb) {
		return { value: bytes / gb, unit: "GB" };
	}
	return { value: bytes / (1024 * 1024), unit: "MB" };
}
