import Link from "next/link";
import { AskButton, ChatIcon } from "./ask";
import { LogoMark } from "./logo";

const JUMPS = [
  { href: "/#how", label: "How it works" },
  { href: "/#journey", label: "The journey" },
  { href: "/#opportunities", label: "Opportunities" },
  { href: "/#accuracy", label: "Accuracy" },
];

// On phones only the Ask button stays, so the bar never crowds.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-2.5 sm:px-8 sm:py-3">
        <Link href="/#top" className="flex min-h-11 items-center gap-2.5 font-display text-base font-bold text-ink sm:text-lg">
          <LogoMark />
          SIP Discovery Engine
        </Link>
        <nav aria-label="Jump to" className="flex items-center gap-1 text-sm">
          {JUMPS.map((jump) => (
            <Link key={jump.href} href={jump.href} className="hidden min-h-11 items-center rounded-lg px-3 text-ink-2 hover:text-ink md:inline-flex">
              {jump.label}
            </Link>
          ))}
          <AskButton className="inline-flex min-h-11 items-center gap-2 rounded-full bg-dark px-4 text-sm font-semibold text-white hover:bg-dark-2 sm:px-[18px]">
            <ChatIcon />
            <span className="sm:hidden">Ask</span>
            <span className="hidden sm:inline">Ask the engine</span>
          </AskButton>
        </nav>
      </div>
    </header>
  );
}
