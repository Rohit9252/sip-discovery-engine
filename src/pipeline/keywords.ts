// The cheap filter that runs before any AI. A post passes if it mentions SIPs or
// mutual funds at all; whether it is actually relevant is decided by AI pass 1.
// Dropped posts are kept in the database so the recall check can read them.
const LATIN_TERMS = [
  "sip", "sips", "mutual fund", "mutual funds", "mf", "mfs", "mandate", "autopay",
  "auto pay", "auto-pay", "auto debit", "auto-debit", "autodebit", "instalment",
  "instalments", "installment", "installments", "nav", "xirr", "index fund",
  "index funds", "elss", "step up", "step-up", "systematic investment",
];

const DEVANAGARI_TERMS = ["एसआईपी", "सिप", "म्यूचुअल", "म्युचुअल", "किस्त"];

const latinPatterns = LATIN_TERMS.map(
  (term) => [term, new RegExp(`(^|[^a-z0-9])${term.replace(/[-]/g, "\\-")}([^a-z0-9]|$)`, "i")] as const,
);

export function matchedTerms(text: string): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const hits = latinPatterns.filter(([, pattern]) => pattern.test(normalized)).map(([term]) => term);
  for (const term of DEVANAGARI_TERMS) if (normalized.includes(term)) hits.push(term);
  return hits;
}
