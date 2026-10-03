import Link from "next/link";
import { BrandMark, SampleReadout, type SampleSignal } from "@/components/Brand";

const SAMPLE_SIGNALS: SampleSignal[] = [
  { score: 92, title: "Staff Backend Engineer", company: "Passionfroot", tone: "strong" },
  { score: 74, title: "Senior Platform Engineer", company: "SoSafe", tone: "strong" },
  { score: 61, title: "Senior Fullstack Engineer", company: "Doctolib", tone: "strong" },
  { score: 31, title: "QA Automation Engineer", company: "TransPerfect", tone: "mid" },
];

const STEPS = [
  { title: "Tell us what you want", body: "Target roles, locations, remote preference and salary. Upload your CV once." },
  { title: "We read the market daily", body: "Hundreds of company career pages and job boards, scored against you while you sleep." },
  { title: "Act on the best ones", body: "Open a match, tailor your CV to it in a click, and track every application." },
];

const FEATURES = [
  {
    eyebrow: "Scoring",
    title: "Ranked daily feed",
    body: "Every match scored 0–100% with a one-line reason: strong skills fit, missing X, location matches.",
    color: "var(--color-secondary)",
    icon: <path d="M4 19V9m6 10V5m6 14v-7m6 7H2" />,
  },
  {
    eyebrow: "Discovery",
    title: "Wildcard picks",
    body: "A few surprise roles outside your exact search that your skills would still crush.",
    color: "var(--color-gamify)",
    icon: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  },
  {
    eyebrow: "Coaching",
    title: "CV intelligence",
    body: "A rated CV review with concrete fixes, one-click tailoring, and streaks and badges as you go.",
    color: "var(--color-accent)",
    icon: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 13h6m-6 4h4" />,
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <BrandMark />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-12">
        <div className="hero p-8 sm:p-12">
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <p className="eyebrow">Daily signal report</p>
              <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">
                Every job market has a signal, buried in noise.
              </h1>
              <p className="max-w-lg text-lg" style={{ color: "var(--hero-ink-muted)" }}>
                Set up your search once. Every day, agents scan the market, score every role against your CV, and hand you
                a ranked shortlist — plus a few wildcards you wouldn&apos;t have searched for yourself.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/register" className="hero-cta">
                  Get started <span aria-hidden>→</span>
                </Link>
                <Link href="/login" className="hero-link">
                  Log in
                </Link>
              </div>
            </div>
            <SampleReadout signals={SAMPLE_SIGNALS} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10" aria-label="How it works">
        <p className="eyebrow">How it works</p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card flex gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <span
                aria-hidden
                className="font-data flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
              >
                {i + 1}
              </span>
              <div>
                <h2 className="font-display font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t" style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}>
        <div className="mx-auto grid max-w-6xl gap-5 px-6 py-14 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="card card-link relative overflow-hidden"
              style={{ borderTop: `3px solid ${f.color}`, boxShadow: "var(--shadow-card)" }}
            >
              <span
                aria-hidden
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: `color-mix(in srgb, ${f.color} 14%, transparent)`, color: f.color }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
              </span>
              <p className="eyebrow">{f.eyebrow}</p>
              <h3 className="font-display mb-1.5 mt-1 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="hero flex flex-col items-start justify-between gap-5 p-8 sm:flex-row sm:items-center">
          <div className="relative">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Your next role is probably already posted.</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--hero-ink-muted)" }}>
              Set up your search in a few minutes and see your first ranked shortlist.
            </p>
          </div>
          <Link href="/register" className="hero-cta relative shrink-0">
            Create your account <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <footer className="px-6 pb-10 pt-2 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        AI Job Finder · daily AI-ranked matches and CV coaching
      </footer>
    </main>
  );
}
