import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futbool — market-aware football analysts",
  description:
    "Sharp, data-grounded football analysts for the Premier League, Championship and beyond. Market reads, upset paths, confidence scores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
