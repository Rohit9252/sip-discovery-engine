import { Suspense } from "react";
import { OpenFromLink } from "./chat-provider";
import { Findings, Hero, HowItWorks, Journey } from "./story";
import { Opportunities } from "./opportunities";
import { Accuracy } from "./accuracy";

// Reads ?q= from the link (like /?q=q3) so the deck can open one answer in the chat directly.
// It sits inside <Suspense>, so the rest of the page is still built ahead of time.
async function LinkedChat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <OpenFromLink id={q} />;
}

export default function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <>
      <Hero />
      <Findings />
      <HowItWorks />
      <Journey />
      <Opportunities />
      <Accuracy />
      <Suspense fallback={null}>
        <LinkedChat searchParams={searchParams} />
      </Suspense>
    </>
  );
}
