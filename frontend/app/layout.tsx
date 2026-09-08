import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Covenant Sentinel", template: "%s — Covenant Sentinel" },
  description:
    "Policy-bound treasury enforcement on GenLayer: consensus-evaluated proposals, approved evidence, and a finality-guarded vault.",
  manifest: "/site.webmanifest",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { themeColor: "#f4f4f1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={bricolage.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
