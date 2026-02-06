import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TopNav } from "@/components/layout/TopNav";
import { cn } from "@/lib/cn";

import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Inbox Copilot",
  description: "Gmail -> AI summary/draft -> push -> review/send",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#fbfbf7"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(sans.variable)}>
      <body className={cn(sans.className, "min-h-screen font-sans")}> 
        <ServiceWorkerRegister />
        <TopNav />
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
