import type { Metadata } from "next";
import { Familjen_Grotesk, JetBrains_Mono, Public_Sans } from "next/font/google";
import answersFile from "@/data/answers.json";
import overview from "@/data/overview.json";
import type { AnswersFile } from "@/lib/answers";
import "./globals.css";
import { ChatProvider } from "./chat-provider";
import { SiteHeader } from "./site-header";

const display = Familjen_Grotesk({ variable: "--nf-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Public_Sans({ variable: "--nf-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--nf-mono", subsets: ["latin"], weight: ["400", "500"] });

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
      </body>
    </html>
  );
}
