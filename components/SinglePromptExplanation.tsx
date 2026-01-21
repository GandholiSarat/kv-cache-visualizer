export default function SinglePromptExplanation() {
	return (
		<div
			style={{
				padding: "16px",
				border: "1px solid #334155",
				borderRadius: "8px",
				background: "#0b1220",
				fontSize: "12px",
				color: "#e2e8f0",
				lineHeight: "1.7",
			}}
		>
			<div style={{ marginBottom: "14px" }}>
				<strong style={{ fontSize: "14px", color: "#e2e8f0" }}>How Policies Map to Real LLM Serving</strong>
			</div>

			<ul style={{ margin: "0 0 0 14px", padding: 0, color: "#cbd5e1" }}>
				<li style={{ marginBottom: "8px" }}>
					<strong>Inference Clock:</strong> Each tick = one forward pass through the model.
				</li>
				<li style={{ marginBottom: "8px" }}>
					<strong>Prefill Phase:</strong> Processes all prompt tokens in parallel; allocates KV cache.
				</li>
				<li style={{ marginBottom: "8px" }}>
					<strong>Decode Phase:</strong> Autoregressive: reads cached KV, computes next token, appends new KV.
				</li>
				<li style={{ marginBottom: "8px" }}>
					<strong>Sliding Window:</strong> Evicts oldest tokens when cache overflows (Mistral, Llama 3.1 long-context).
				</li>
				<li style={{ marginBottom: "8px" }}>
					<strong>Pinned Prefix:</strong> Locks system prompt in cache; useful for chat models and multi-turn context.
				</li>
				<li style={{ marginBottom: "8px" }}>
					<strong>Recent-N Tokens:</strong> Maintains recent history only; ideal for streaming/low-latency inference.
				</li>
				<li>
					<strong>Context Windows:</strong> Each policy manages the trade-off between memory usage and context recall.
				</li>
			</ul>
		</div>
	);
}
