export function Sparkline({ label, suffix = "", values }: { label: string; suffix?: string; values: number[] }) {
  const latest = values[values.length - 1] ?? 0;
  const max = Math.max(...values, 1);
  return (
    <article className="sparkline-card">
      <div className="sparkline-head">
        <span>{label}</span>
        <strong>
          {Number.isInteger(latest) ? latest : latest.toFixed(1)}
          {suffix}
        </strong>
      </div>
      <div className="sparkline" role="img" aria-label={`${label} ${latest}${suffix}`}>
        {values.length === 0 ? <span className="muted">No samples</span> : values.map((value, index) => (
          <span key={`${label}-${index}`} style={{ height: `${Math.max(6, (value / max) * 100)}%` }} />
        ))}
      </div>
    </article>
  );
}
