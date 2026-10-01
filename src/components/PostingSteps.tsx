import type { PostingStep } from "@/lib/postingSteps";

/**
 * The three steps for a posting as a compact list: number or tick, title,
 * and one line of state. Each step jumps to its section of the page. The
 * done state is spoken as well as shown.
 */
export function PostingSteps({ steps, className }: { steps: PostingStep[]; className?: string }) {
  return (
    <nav aria-label="Steps for this posting" className={className}>
      <div className="card space-y-3">
        <p className="eyebrow">Steps</p>
        <ol className="space-y-1">
          {steps.map((step) => (
            <li key={step.key}>
              <a
                href={step.href}
                className="pipeline-step flex items-start gap-3 rounded-md"
                aria-label={`Step ${step.number}, ${step.title}${step.optional ? ", optional" : ""}: ${step.done ? "done" : "not done"}. ${step.detail}. Jump to section`}
              >
                <span
                  aria-hidden
                  className="font-data mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={
                    step.done
                      ? { background: "var(--color-secondary)", color: "var(--color-accent-fg)" }
                      : { background: "var(--color-bg)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                  }
                >
                  {step.done ? "✓" : step.number}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {step.detail}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
