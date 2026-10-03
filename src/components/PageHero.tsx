import { HeroStats, type HeroStat } from "@/components/HeroStats";
import { RingGauge } from "@/components/RingGauge";

/**
 * The top of every dashboard page: the same deep blue panel as the Overview,
 * so the product reads as one place. An eyebrow and title say where you are,
 * the description says what the page is for, optional stats give the page's
 * numbers at a glance, and the actions are the one or two things to do here.
 * A ring on the right shows the page's single most important reading.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  leading,
  chips,
  stats,
  actions,
  ring,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sits before the title, e.g. a company monogram. */
  leading?: React.ReactNode;
  chips?: string[];
  stats?: HeroStat[];
  actions?: React.ReactNode;
  /** The page's headline reading, 0–100. `text` replaces the percentage in the centre. */
  ring?: { value: number; label: string; caption: string; text?: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="hero p-6 sm:p-8" aria-label={eyebrow}>
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start gap-4">
            {leading}
            <div className="min-w-0">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
              {description && (
                <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--hero-ink-muted)" }}>
                  {description}
                </p>
              )}
            </div>
          </div>

          {chips && chips.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Current search">
              {chips.slice(0, 6).map((chip) => (
                <li key={chip} className="hero-chip">
                  {chip}
                </li>
              ))}
              {chips.length > 6 && <li className="hero-chip">+{chips.length - 6} more</li>}
            </ul>
          )}

          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          {stats && stats.length > 0 && <HeroStats stats={stats} />}
          {children}
        </div>

        {ring && (
          <div className="flex items-center gap-4 md:flex-col md:gap-2">
            <RingGauge
              value={ring.value}
              size={112}
              stroke={10}
              color="var(--hero-signal)"
              track="rgba(255,255,255,0.16)"
              label={ring.label}
            >
              <span className="font-data text-3xl font-semibold leading-none">{ring.text ?? `${Math.round(ring.value)}%`}</span>
            </RingGauge>
            <p className="eyebrow text-center">{ring.caption}</p>
          </div>
        )}
      </div>
    </section>
  );
}
