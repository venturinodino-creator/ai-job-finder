import Link from "next/link";
import { BrandMark, SampleReadout, type SampleSignal } from "@/components/Brand";

const SIGNALS: SampleSignal[] = [
  { score: 88, title: "Senior Account Manager", company: "Mollie", tone: "strong" },
  { score: 71, title: "Partner Success Lead", company: "Canva", tone: "strong" },
  { score: 44, title: "Operations Analyst", company: "Coolblue", tone: "mid" },
];

const POINTS = ["Roles from hundreds of company career pages and boards", "Every match scored against your CV, with the reason", "One-click CV tailoring and application tracking"];

/** Sign-in and sign-up share one split screen: the pitch on the dark panel, the form beside it. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="flex-1 grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="hero hidden rounded-none p-10 lg:flex lg:flex-col lg:justify-between" aria-label="About AI Job Finder">
        <div className="relative">
          <Link href="/" aria-label="AI Job Finder home">
            <BrandMark onDark />
          </Link>
        </div>
        <div className="relative space-y-6">
          <h2 className="font-display text-3xl font-semibold leading-tight">Stop scrolling job boards. Start with the shortlist.</h2>
          <ul className="space-y-2.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm" style={{ color: "var(--hero-ink-muted)" }}>
                <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs" style={{ background: "rgba(95,211,168,0.18)", color: "var(--hero-signal)" }}>
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
          <SampleReadout signals={SIGNALS} label="Example shortlist" />
        </div>
        <p className="relative text-xs" style={{ color: "var(--hero-ink-muted)" }}>
          Daily AI-ranked matches and CV coaching.
        </p>
      </aside>

      <section className="flex flex-col items-center justify-center gap-6 px-6 py-16">
        <Link href="/" className="lg:hidden" aria-label="AI Job Finder home">
          <BrandMark />
        </Link>
        <div className="w-full max-w-sm space-y-1">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        </div>
        {children}
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {footer}
        </p>
      </section>
    </main>
  );
}
