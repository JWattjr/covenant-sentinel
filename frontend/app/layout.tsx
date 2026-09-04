import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Covenant Sentinel",
  description:
    "Policy-bound treasury enforcement on GenLayer: consensus-evaluated proposals, approved evidence, and a finality-guarded vault.",
  manifest: "/site.webmanifest",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { themeColor: "#080b14" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
