import { MIN_FOR_PERCENT, share, type BarsChart, type PairsChart, type RatesChart, type Tone, type Chart } from "@/lib/answers";

const BAR: Record<Tone, string> = { continued: "bg-accent", dropped: "bg-warm", neutral: "bg-accent" };
const fmt = (n: number) => n.toLocaleString("en-US");

export function Bars({ chart }: { chart: BarsChart }) {
  const max = Math.max(...chart.bars.map((bar) => bar.n), 1);
  return (
    <figure>
      <figcaption className="text-[13px] font-semibold text-ink-2">{chart.title} <span className="font-normal text-ink-3">(N = {fmt(chart.N)})</span></figcaption>
      <ul className="mt-3 space-y-2.5">
        {chart.bars.map((bar, index) => (
          <li key={bar.label} className="group grid grid-cols-[minmax(5.5rem,10rem)_1fr_3.25rem] items-center gap-2.5 text-[13px]" title={`${bar.label}: ${bar.n} of ${chart.N} posts`}>
            <span className="leading-snug text-ink-2 group-hover:text-ink">{bar.label}</span>
            <span className="h-3 rounded-r-[4px] bg-sunken">
              <span
                className={`grow block h-3 rounded-r-[4px] ${BAR[bar.tone ?? "neutral"]} ${index === 0 ? "" : "opacity-70"} group-hover:opacity-100`}
                style={{ width: `${Math.max((bar.n / max) * 100, 1.5)}%`, animationDelay: `${index * 40}ms` }}
              />
            </span>
            <span className="num text-right text-xs">{share(bar.n, chart.N)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function Pairs({ chart }: { chart: PairsChart }) {
  const [a, b] = chart.groups;
  return (
    <figure>
      <figcaption className="text-[13px] font-semibold text-ink-2">{chart.title}</figcaption>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
        {chart.groups.map((group) => (
          <span key={group.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${BAR[group.tone]}`} />
            {group.label} (N = {fmt(group.N)})
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-3">
        {chart.rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(5.5rem,10rem)_1fr] items-center gap-2.5 text-[13px]">
            <span className="text-ink-2">{row.label}</span>
            <span className="space-y-1">
              {[a, b].map((group, i) => (
                <span key={group.label} className="grid grid-cols-[1fr_3.25rem] items-center gap-3" title={`${group.label}: ${row.n[i]} of ${group.N}`}>
                  <span className="h-2.5 rounded-r-[4px] bg-sunken">
                    <span className={`grow block h-2.5 rounded-r-[4px] ${BAR[group.tone]}`} style={{ width: `${Math.max((row.n[i] / Math.max(group.N, 1)) * 100, 1.5)}%` }} />
                  </span>
                  <span className="num text-right text-xs">{share(row.n[i], group.N)}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function Rates({ chart }: { chart: RatesChart }) {
  return (
    <figure>
      <figcaption className="text-[13px] font-semibold text-ink-2">{chart.title}</figcaption>
      <ul className="mt-3 space-y-2.5">
        {chart.rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(5.5rem,10rem)_1fr_4.5rem] items-center gap-2.5 text-[13px]" title={`${row.label}: ${row.n} of ${row.N} posts`}>
            <span className="text-ink-2">{row.label}</span>
            <span className="h-3 rounded-r-[4px] bg-sunken">
              {row.N >= MIN_FOR_PERCENT && <span className={`grow block h-3 rounded-r-[4px] ${BAR[chart.tone]}`} style={{ width: `${Math.max((row.n / row.N) * 100, 1.5)}%` }} />}
            </span>
            <span className="num text-right text-xs">{share(row.n, row.N)}{row.N >= MIN_FOR_PERCENT && <span className="block text-[10px] text-ink-3">of {fmt(row.N)}</span>}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function ChartView({ chart }: { chart: Chart }) {
  if (chart.kind === "bars") return <Bars chart={chart} />;
  if (chart.kind === "pairs") return <Pairs chart={chart} />;
  return <Rates chart={chart} />;
}
