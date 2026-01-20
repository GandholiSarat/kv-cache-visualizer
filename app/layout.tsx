import type { Metadata } from "next";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "KV Cache Visualizer",
  description: "Interactive visualization of KV cache in transformer inference",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
