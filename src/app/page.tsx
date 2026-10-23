import { Suspense } from "react";
import answersFile from "@/data/answers.json";
import overview from "@/data/overview.json";
import type { AnswersFile } from "@/lib/answers";
import { Chat } from "./chat";
import { Hero, HowItWorks, Journey } from "./story";

const { answers } = answersFile as AnswersFile;
const firstTime = overview.funnel[4].n.toLocaleString("en-US");

// Reads ?q= from the link (like /?q=q3#chat) so the deck can open one answer directly.
// It sits inside <Suspense>, so the rest of the page is still built ahead of time.
async function LinkedChat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <Chat answers={answers} firstTime={firstTime} linked={q} />;
}

export default function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Journey />
      <Suspense fallback={<Chat answers={answers} firstTime={firstTime} />}>
        <LinkedChat searchParams={searchParams} />
      </Suspense>
    </>
  );
}
