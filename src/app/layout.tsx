import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import answersFile from "@/data/answers.json";
import overview from "@/data/overview.json";
import type { AnswersFile } from "@/lib/answers";
import "./globals.css";
import { ChatProvider } from "./chat-provider";
import { SiteHeader } from "./site-header";

const display = localFont({ src: "./fonts/familjen-grotesk.woff2", variable: "--nf-display", weight: "400 700", display: "swap" });
const body = localFont({ src: "./fonts/public-sans.woff2", variable: "--nf-body", weight: "100 900", display: "swap" });
const mono = localFont({ src: "./fonts/jetbrains-mono.woff2", variable: "--nf-mono", weight: "100 800", display: "swap" });

export const metadata: Metadata = {
  title: "SIP Discovery Engine",
  description: "Why first-time mutual fund investors keep or drop their SIP, read from public posts and tagged by journey stage.",
};

const { answers } = answersFile as AnswersFile;
const fmt = (n: number) => n.toLocaleString("en-US");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-surface text-ink">
        <ChatProvider answers={answers} ownSip={fmt(overview.funnel[3].n)} firstTime={fmt(answersFile.firstTimePosts)}>
          <SiteHeader />
          <main id="top" className="flex-1">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 text-[13px] text-ink-3 sm:px-8">
              Built from public posts only. No usernames are stored. Not investment advice.
            </div>
          </footer>
        </ChatProvider>
        <Analytics />
      </body>
    </html>
  );
}
