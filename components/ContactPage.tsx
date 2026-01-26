export default function ContactPage() {
	return (
		<main
			style={{
				minHeight: "100vh",
				padding: "clamp(24px, 5vw, 48px) 16px",
				background: "radial-gradient(1200px at top, #020617, #01030a)",
				color: "#e5e7eb",
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			<section
				style={{
					maxWidth: "min(720px, 100%)",
					margin: "0 auto",
					display: "grid",
					gap: "clamp(18px, 3vw, 28px)",
				}}
			>
				{/* Header */}
				<header style={{ display: "grid", gap: "8px" }}>
					<span
						style={{
							fontSize: "11px",
							fontWeight: 700,
							letterSpacing: "0.12em",
							color: "#60a5fa",
						}}
					>
						CONTACT
					</span>

					<h1
						style={{
							margin: 0,
							fontSize: "clamp(26px, 3.2vw, 32px)",
							fontWeight: 700,
							letterSpacing: "-0.01em",
						}}
					>
						Gandholi Sarat
					</h1>

					<p
						style={{
							margin: 0,
							color: "#94a3b8",
							fontSize: "14px",
							maxWidth: "420px",
							lineHeight: 1.6,
						}}
					>
						Portfolio, social profiles, and open-source work.
					</p>
				</header>

				{/* Contact Links */}
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
							gap: "12px",
						}}
					>
						<IconLink
							label="Website"
							href="https://gandholisarat.vercel.app"
							icon={
								<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
									<path
										fill="currentColor"
										d="M12 2a10 10 0 100 20 10 10 0 000-20zm7.5 9h-3.08a15.6 15.6 0 00-1.4-6.02A8.03 8.03 0 0119.5 11zm-9.14 0H4.5a8.03 8.03 0 014.48-6.02A15.6 15.6 0 0010.36 11zm0 2a15.6 15.6 0 00-1.38 6.02A8.03 8.03 0 014.5 13h5.86zm2 0h5.86a8.03 8.03 0 01-4.48 6.02A15.6 15.6 0 0012.36 13zm0-2h3.08a13.6 13.6 0 00-1.48-5.5c-.45-.83-.98-1.48-1.6-1.92V11zm-2 0V3.58c-.62.44-1.15 1.09-1.6 1.92A13.6 13.6 0 007.42 11h2.94zm0 2H7.42a13.6 13.6 0 001.44 5.5c.45.83.98 1.48 1.6 1.92V13zm2 0v7.42c.62-.44 1.15-1.09 1.6-1.92a13.6 13.6 0 001.44-5.5h-3.04z"
									/>
								</svg>
							}
							value="gandholisarat.vercel.app"
						/>
						<IconLink
							label="GitHub"
							href="https://github.com/GandholiSarat"
							icon={
								<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
									<path
										fill="currentColor"
										d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.68c-2.77.6-3.36-1.34-3.36-1.34-.45-1.14-1.1-1.44-1.1-1.44-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.36 1.08 2.94.82.09-.65.35-1.08.64-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0112 6.8c.85 0 1.71.11 2.51.32 1.9-1.29 2.74-1.02 2.74-1.02.56 1.38.21 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.35 4.7-4.58 4.94.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0012 2z"
									/>
								</svg>
							}
							value="GandholiSarat"
						/>
						<IconLink
							label="LinkedIn"
							href="https://linkedin.com/in/gandholi-sarat"
							icon={
								<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
									<path
										fill="currentColor"
										d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0V8zm7.5 0h4.8v2.2h.07c.67-1.27 2.3-2.6 4.73-2.6C21 7.6 24 9.43 24 14.3V24h-5v-8.5c0-2.03-.04-4.65-2.83-4.65-2.83 0-3.27 2.2-3.27 4.5V24h-5V8z"
									/>
								</svg>
							}
							value="gandholi-sarat"
						/>
						<IconLink
							label="Email"
							href="mailto:gandholisarat@gmail.com"
							icon={
								<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
									<path
										fill="currentColor"
										d="M2 4h20a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v.51l10 6.25 10-6.25V6H2zm20 12v-9.02l-9.47 5.92a1 1 0 01-1.06 0L2 8.98V18h20z"
									/>
								</svg>
							}
							value="gandholisarat@gmail.com"
						/>
					</div>
				</Card>

				{/* Project */}
				<Card>
					<IconLink
						label="Project Repository"
						href="https://github.com/GandholiSarat/kv-cache-visualizer"
						icon={
							<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
								<path
									fill="currentColor"
									d="M3 4a2 2 0 012-2h11a2 2 0 012 2v3h1a2 2 0 012 2v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-3H5a2 2 0 01-2-2V4zm14 0H5v9h2V9a2 2 0 012-2h8V4zm2 6H9v8h10v-8z"
								/>
							</svg>
						}
						value="kv-cache-visualizer"
					/>
					<p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
						Contribute Here! This project is open-source on GitHub. Feel free to explore the code, report issues, or submit pull requests.
					</p>
				</Card>
			</section>
		</main>
	);
}

function Card({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				padding: "clamp(14px, 2.5vw, 18px)",
				borderRadius: "16px",
				border: "1px solid #1e293b",
				background: "linear-gradient(180deg, #0b1220, #070c16)",
				display: "grid",
				gap: "14px",
				boxShadow: "0 10px 40px rgba(2, 6, 23, 0.35)",
			}}
		>
			{children}
		</div>
	);
}

function IconLink({ label, value, href, icon }: { label: string; value: string; href: string; icon: React.ReactNode }) {
	return (
		<a
			href={href}
			target={href.startsWith("mailto:") ? undefined : "_blank"}
			rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
			style={{
				display: "flex",
				alignItems: "center",
				gap: "10px",
				padding: "10px 12px",
				borderRadius: "12px",
				background: "#0f172a",
				border: "1px solid #1f2937",
				textDecoration: "none",
				color: "#e5e7eb",
				minWidth: 0,
			}}
		>
			<span
				style={{
					display: "grid",
					placeItems: "center",
					width: "28px",
					height: "28px",
					borderRadius: "8px",
					background: "#111827",
					color: "#60a5fa",
				}}
			>
				{icon}
			</span>
			<div style={{ display: "grid", gap: "2px", minWidth: 0 }}>
				<span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>{label}</span>
				<span style={{ fontSize: "13px", fontWeight: 600, overflowWrap: "anywhere" }}>{value}</span>
			</div>
		</a>
	);
}
