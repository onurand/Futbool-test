import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { I18nProvider } from "@/lib/i18n/context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futbool — akıllı futbol analizi",
  description:
    "Premier League ve Championship için market-aware, veriyle konuşan futbol analizleri.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <I18nProvider>
          <AppHeader />
          {children}
          <BottomNav />
        </I18nProvider>
      </body>
    </html>
  );
}
