import type { Metadata } from "next";
import { Suspense } from "react";
import { OpenFromLink } from "../chat-provider";
import { ChatPage } from "../chat";

export const metadata: Metadata = {
  title: "Chat · SIP Discovery Engine",
  description: "Ask the engine about first-time SIP investors. Every answer shows the posts behind it.",
};

// Reads ?q= (like /chat?q=q3) so a link can open one answer straight away.
async function LinkedChat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <OpenFromLink id={q} />;
}

export default function Chat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <>
      <ChatPage />
      <Suspense fallback={null}>
        <LinkedChat searchParams={searchParams} />
      </Suspense>
    </>
  );
}
