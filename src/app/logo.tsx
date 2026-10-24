// The mark: six small dots, five filled (kept going) and one hollow ring (dropped off).
export function LogoMark({ size = 6 }: { size?: number }) {
  const dot = { width: size, height: size };
  return (
    <span aria-hidden="true" className="inline-grid shrink-0" style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gap: Math.max(2, Math.round(size / 2)) }}>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className="rounded-full bg-accent" style={dot} />)}
      <span className="box-border rounded-full border-[1.5px] border-warm" style={dot} />
    </span>
  );
}
