/** The product mark: four signal bars and the name. */
export function BrandMark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="font-display flex items-center gap-2 text-lg font-semibold">
      <span aria-hidden className="inline-flex items-end gap-[2px]">
        {[3, 5, 8, 6].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-[1px]"
            style={{ height: `${h * 2}px`, background: i === 3 ? (onDark ? "#ffffff" : "var(--color-accent)") : onDark ? "var(--hero-signal)" : "var(--color-secondary)" }}
          />
        ))}
      </span>
      AI Job Finder
    </span>
  );
}

export interface SampleSignal {
  score: number;
  title: string;
  company: string;
  tone: "strong" | "mid";
}

/** A small, static example of a ranked shortlist, used on the landing and sign-in screens. */
export function SampleReadout({ signals, label = "Live readout" }: { signals: SampleSignal[]; label?: string }) {
  return (
    <div className="hero-stat space-y-1 p-0 overflow-hidden" role="img" aria-label={`Example shortlist: ${signals.map((s) => `${s.title} at ${s.company}, ${s.score}%`).join("; ")}`}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
        <span className="eyebrow">{label}</span>
        <span className="font-data text-xs" style={{ color: "var(--hero-ink-muted)" }}>
          {signals.length} signals detected
        </span>
      </div>
      {signals.map((s, i) => (
        <div key={s.title} className="flex items-center justify-between gap-4 px-4 py-3" style={{ borderBottom: i < signals.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined }}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.title}</p>
            <p className="text-xs" style={{ color: "var(--hero-ink-muted)" }}>
              {s.company}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span aria-hidden className="flex items-end gap-[2px]">
              {Array.from({ length: 10 }).map((_, b) => (
                <span
                  key={b}
                  className={b < Math.round(s.score / 10) ? "signal-seg block h-2.5 w-1 rounded-[1px]" : "block h-2.5 w-1 rounded-[1px]"}
                  style={{
                    background: b < Math.round(s.score / 10) ? (s.tone === "strong" ? "var(--hero-signal)" : "rgba(255,255,255,0.65)") : "rgba(255,255,255,0.16)",
                    animationDelay: `${200 + i * 120 + b * 30}ms`,
                  }}
                />
              ))}
            </span>
            <span className="font-data w-12 text-right text-lg font-semibold" style={{ color: s.tone === "strong" ? "var(--hero-signal)" : "var(--hero-ink)" }}>
              {s.score}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
