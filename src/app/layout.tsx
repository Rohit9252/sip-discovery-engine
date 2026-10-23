import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIP Discovery Engine",
  description: "Why first-time mutual fund investors keep or drop their SIP, read from public posts and tagged by journey stage.",
};

const JUMPS = [
  { href: "#how", label: "How it works" },
  { href: "#journey", label: "The journey" },
  { href: "#chat", label: "Ask" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" className="h-6 w-6" />
              SIP Discovery Engine
            </a>
            <nav aria-label="Jump to" className="flex items-center gap-1 text-sm">
              {JUMPS.map((jump) => (
                <a key={jump.href} href={jump.href} className={`hidden rounded-full px-3 py-1.5 text-ink-2 hover:bg-sunken hover:text-ink sm:inline ${jump.href === "#chat" ? "!inline bg-accent font-medium text-white hover:!bg-accent-strong hover:!text-white" : ""}`}>
                  {jump.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main id="top" className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-3 sm:px-6">
            Built from public posts only. No usernames are stored. Not investment advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
