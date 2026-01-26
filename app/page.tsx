"use client";

// Conceptual KV cache visualizer: block-driven, prompt-driven, policy-aware.

import { useState } from "react";
import { SinglePromptSimulator } from "@/modes/SinglePromptSimulator";
import { MultiPromptSimulator } from "@/modes/MultiPromptSimulator";

type InferencePromptMode = "single" | "multi";

export default function Home() {
	const [promptMode, setPromptMode] = useState<InferencePromptMode>("single");

	return (
		<main
			className="responsive-main main-container"
			style={{
				minHeight: "100vh",
				padding: "16px",
				background: "#020617",
				color: "#e2e8f0",
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				flexDirection: "column",
				maxWidth: "100%",
				overflowX: "hidden",
			}}
		>
		<section className="header-section responsive-header" style={{ display: "grid", gap: "6px", marginBottom: "10px" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
					<div style={{ display: "grid", gap: "4px", flex: "1 1 auto", minWidth: "260px" }}>
						<h1 className="main-title" style={{ fontSize: "35px", fontWeight: 700, margin: 5 }}>KV Cache Visualizer</h1>
						<p className="subtitle" style={{ margin: 5, color: "#94a3b8", fontSize: "15px" }}>
							Real-time inference simulation: prefill → decode → streaming → eviction
						</p>
					</div>

					<div
						style={{
							display: "grid",
							gap: "6px",
							padding: "10px",
							border: "1px solid #1e293b",
							borderRadius: "8px",
							background: "#0b1220",
							minWidth: "260px",
						}}
					>
						<div style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}>Mode</div>
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								type="button"
								onClick={() => setPromptMode("single")}
								aria-pressed={promptMode === "single"}
								className="mobile-button"
								style={{
									flex: 1,
									padding: "10px 12px",
									minHeight: "44px",
									borderRadius: "6px",
									border: "1px solid #334155",
									background: promptMode === "single" ? "#1e40af" : "#0f172a",
									color: "#f8fafc",
									fontSize: "13px",
									fontWeight: 700,
									cursor: "pointer",
								}}
							>
								Single Prompt
							</button>
							<button
								type="button"
								onClick={() => setPromptMode("multi")}
								aria-pressed={promptMode === "multi"}
								className="mobile-button"
								style={{
									flex: 1,
									padding: "10px 12px",
									minHeight: "44px",
									borderRadius: "6px",
									border: "1px solid #334155",
									background: promptMode === "multi" ? "#14532d" : "#0f172a",
									color: "#f8fafc",
									fontSize: "13px",
									fontWeight: 700,
									cursor: "pointer",
								}}
							>
								Multi Prompt (Continuous Batching)
							</button>
						</div>
						{/* <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.4 }}>
							Single matches the original behavior. Multi visualizes continuous batching.
						</div> */}
					</div>
				</div>
			</section>

			{promptMode === "single" ? <SinglePromptSimulator /> : <MultiPromptSimulator />}

			<footer
				style={{
					marginTop: "auto",
					paddingTop: "16px",
					borderTop: "1px solid #0f172a",
					fontSize: "12px",
					color: "#94a3b8",
					display: "flex",
					justifyContent: "flex-end",
					gap: "12px",
				}}
			>
				<a
					href="/contact"
					style={{
						color: "#60a5fa",
						textDecoration: "underline",
						fontWeight: 600,
					}}
				>
					Made by Gandholi Sarat · Contributions
				</a>
			</footer>
		</main>
	);
}
   
