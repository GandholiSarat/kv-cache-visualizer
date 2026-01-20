// Shared constants for the visualizer.

/**
 * Eviction policy types: determines how KV blocks are discarded when cache is full.
 *
 * Mapping to real LLM serving:
 * - Sliding Window: keeps only the most recent N tokens (e.g., Mistral, Llama 3.1)
 * - Pinned Prefix: keeps system prompt fixed, evicts older context (chat models, multi-turn)
 * - Recent-N Tokens: maintains a rolling window of exactly N tokens (streaming, low-latency)
 */
export enum EvictionPolicy {
	SlidingWindow = "sliding-window",
	PinnedPrefix = "pinned-prefix",
	RecentN = "recent-n",
}

/** Default eviction policy. */
export const DEFAULT_EVICTION_POLICY = EvictionPolicy.SlidingWindow;

/** Default window size for Recent-N policy (as number of tokens to keep). */
export const DEFAULT_RECENT_N_WINDOW = 8;
