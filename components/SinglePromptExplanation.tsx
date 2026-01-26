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

			<div style={{ color: "#cbd5e1" }}>
				<div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
					<div style={{ fontWeight: 600, color: "#38bdf8", marginBottom: "6px" }}>Inference Loop</div>
					<ul style={{ margin: "0 0 0 14px", padding: 0 }}>
						<li><strong>Inference clock:</strong> one tick = one forward pass through the model.</li>
						<li><strong>Prefill phase:</strong> batch prompt tokens, allocate KV, fill initial blocks.</li>
						<li><strong>Decode phase:</strong> read cached KV, generate next token, append KV to last block.</li>
					</ul>
				</div>

				<div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
					<div style={{ fontWeight: 600, color: "#34d399", marginBottom: "6px" }}>Policy Behavior</div>
					<ul style={{ margin: "0 0 0 14px", padding: 0 }}>
						<li><strong>Sliding window:</strong> evict oldest tokens when cache is full (long-context models).</li>
						<li><strong>Pinned prefix:</strong> protect the system prompt; reduces eviction risk for core instructions.</li>
						<li><strong>Recent-N:</strong> keep only recent history for low-latency streaming.</li>
					</ul>
				</div>

				<div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
					<div style={{ fontWeight: 600, color: "#a78bfa", marginBottom: "6px" }}>Operational Impact</div>
					<ul style={{ margin: "0 0 0 14px", padding: 0 }}>
						<li><strong>Latency:</strong> more reuse → faster decode; more eviction → more recompute.</li>
						<li><strong>Throughput:</strong> batching improves compute utilization, not memory sharing.</li>
						<li><strong>Recall:</strong> larger retained window improves grounding but raises memory pressure.</li>
					</ul>
				</div>

				<div>
					<div style={{ fontWeight: 600, color: "#fbbf24", marginBottom: "6px" }}>When to Use What</div>
					<p style={{ margin: "0 0 0 14px", fontSize: "11px" }}>
						<strong>Sliding window</strong> for long contexts, <strong>pinned prefix</strong> for stable system prompts,
						<strong>recent-N</strong> for streaming. Each policy trades memory usage for context recall.
					</p>
				</div>
			</div>
		</div>
	);
}
