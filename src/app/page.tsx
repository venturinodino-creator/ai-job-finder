import Link from "next/link";

const SAMPLE_SIGNALS = [
  { score: 92, title: "Staff Backend Engineer", company: "Passionfroot", tone: "secondary" as const },
  { score: 74, title: "Senior Platform Engineer", company: "SoSafe", tone: "secondary" as const },
  { score: 61, title: "Senior Fullstack Engineer", company: "Doctolib", tone: "accent" as const },
  { score: 31, title: "QA Automation Engineer", company: "TransPerfect", tone: "accent" as const },
];

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      <section className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto w-full px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="eyebrow">Daily signal report</p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05]">
              Every job market has a signal, buried in noise.
            </h1>
            <p className="text-lg max-w-md" style={{ color: "var(--color-text-muted)" }}>
              Set up your search once. Every day, agents scan the market, score every role against your CV, and
              hand you a ranked shortlist — plus a few wildcards you wouldn&apos;t have searched for yourself.
            </p>
            <div className="flex gap-3 pt-2">
              <Link href="/register" className="btn-primary">
                Get started
              </Link>
              <Link href="/login" className="btn-secondary">
                Log in
              </Link>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="eyebrow">Live readout</span>
              <span className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
                4 signals detected
              </span>
            </div>
            <div>
              {SAMPLE_SIGNALS.map((s, i) => (
                <div
                  key={s.title}
                  className="px-4 py-3.5 flex items-center justify-between gap-4"
                  style={{ borderBottom: i < SAMPLE_SIGNALS.length - 1 ? "1px solid var(--color-border)" : undefined }}
                >
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {s.company}
                    </p>
                  </div>
                  <span
                    className="font-data text-lg font-semibold shrink-0"
                    style={{ color: s.tone === "secondary" ? "var(--color-secondary)" : "var(--color-accent)" }}
                  >
                    {s.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-t"
        style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8">
          <Feature
            eyebrow="Scoring"
            title="Ranked daily feed"
            body="Every match scored 0–100% with a one-line reason: strong skills fit, missing X, location matches."
          />
          <Feature
            eyebrow="Discovery"
            title="Wildcard picks"
            body="A few surprise roles outside your exact search that your skills would still crush."
          />
          <Feature
            eyebrow="Coaching"
            title="CV intelligence"
            body="A rated CV review with concrete fixes, one-click tailoring, and streaks and badges as you go."
          />
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        Open source and self-hostable — see{" "}
        <a className="underline" href="https://github.com" target="_blank" rel="noreferrer">
          BUILD_SPEC.md
        </a>{" "}
        for the full architecture.
      </footer>
    </main>
  );
}

function Feature({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="font-display text-lg font-semibold mt-1 mb-1.5">{title}</h3>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {body}
      </p>
    </div>
  );
}
