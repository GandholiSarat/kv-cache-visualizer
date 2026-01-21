export default function KVCacheExplanation() {
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
				<strong style={{ fontSize: "14px", color: "#e2e8f0" }}>How KV Cache Works (Conceptual)</strong>
			</div>

			<div style={{ color: "#cbd5e1" }}>
				<div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
					<div style={{ fontWeight: 600, color: "#38bdf8", marginBottom: "6px" }}>Prefill Phase</div>
					<ul style={{ margin: "0 0 0 14px", padding: 0 }}>
						<li>All prompt tokens are processed in a batch</li>
						<li>Each prompt gets its own KV blocks</li>
						<li>Blocks are allocated per-prompt, not shared</li>
					</ul>
				</div>

				<div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
					<div style={{ fontWeight: 600, color: "#34d399", marginBottom: "6px" }}>Decode Phase</div>
					<ul style={{ margin: "0 0 0 14px", padding: 0 }}>
						<li>All cached KV is read (reuse phase)</li>
						<li>One new token generated per prompt</li>
						<li>Each prompt appends to its own last block</li>
						<li>If block is full → allocate a new block for that prompt</li>
					</ul>
				</div>

				<div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
					<div style={{ fontWeight: 600, color: "#a78bfa", marginBottom: "6px" }}>Eviction & Policies</div>
					<ul style={{ margin: "0 0 0 14px", padding: 0 }}>
						<li><strong>Sliding Window:</strong> evict oldest block when full</li>
						<li><strong>Pinned Prefix:</strong> first block is never evicted</li>
						<li><strong>Recent-N:</strong> retain only recent blocks per prompt</li>
						<li><strong>Rule:</strong> only full blocks are evicted; partial blocks remain</li>
					</ul>
				</div>

				<div>
					<div style={{ fontWeight: 600, color: "#fbbf24", marginBottom: "6px" }}>Key Insight</div>
					<p style={{ margin: "0 0 0 14px", fontSize: "11px" }}>
						<strong>GPU stores KV blocks; CPU manages allocation.</strong> Continuous batching batches <em>compute</em>, not <em>memory ownership</em>.
						Each prompt owns its blocks exclusively. Batching improves throughput, not memory sharing.
					</p>
				</div>
			</div>
		</div>
	);
}
