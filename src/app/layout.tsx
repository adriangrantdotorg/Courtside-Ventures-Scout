import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./progress.css";
import { Shell } from "@/components/Shell";
import { Ticker } from "@/components/Ticker";

export const metadata: Metadata = {
  title: { default: "Courtside Ventures Scout", template: "%s · Courtside Ventures Scout" },
  description: "Deal sourcing for Courtside Ventures: startups, trends, sponsors and funds inside Courtside's thesis, every fact linked to its source. A non-commercial demo built by Adrian Grant.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1b1f",
};

// Night is written into the HTML; Day (a saved choice) is applied before paint.
const prePaint = `try{var t=localStorage.getItem("scout.theme");if(t==="light")document.documentElement.dataset.theme="light";var d=localStorage.getItem("scout.density");if(d)document.documentElement.dataset.density=d;var s=localStorage.getItem("scout.text");if(s)document.documentElement.dataset.text=s;}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prePaint }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <linearGradient id="gg" x1="0" x2="1">
              <stop offset="0" stopColor="#cc003d" />
              <stop offset="1" stopColor="#ffbe4c" />
            </linearGradient>
          </defs>
        </svg>
        <Shell ticker={<Ticker />}>{children}</Shell>
      </body>
    </html>
  );
}
