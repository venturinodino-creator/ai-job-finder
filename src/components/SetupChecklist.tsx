"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SetupState } from "@/lib/searchState";
import { ScoringProgress, requestScoringRun } from "@/components/ScoringRun";

type RunState = "idle" | "running" | "failed";

/**
 * What a new account sees in place of the pipeline: three steps, each
 * showing whether it is done and linking to where it is completed. When
 * the CV and profile are in place and nothing has been scored yet, the
 * first scoring run starts on its own; the page shows that it is running
 * and how long it usually takes, and offers a retry if it fails.
 */
export function SetupChecklist({ setup }: { setup: SetupState }) {
  const router = useRouter();
  const [run, setRun] = useState<RunState>("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const readyToScore = setup.cvParsed && setup.profileWithCv && !setup.scored;

  const startRun = async () => {
    setRun("running");
    setError(null);
    try {
      await requestScoringRun();
      router.refresh();
    } catch (err) {
      setRun("failed");
      setError(err instanceof Error ? err.message : "Scoring failed.");
    }
  };

  // Starts once per page load, not on every re-render or Strict Mode remount.
  useEffect(() => {
    if (readyToScore && !startedRef.current) {
      startedRef.current = true;
      void startRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToScore]);

  const steps = [
    {
      key: "cv",
      done: setup.cvParsed,
      title: "Upload your CV",
      detail: setup.cvParsed ? "Parsed and ready to match." : "A PDF or Word file. It is read once and used to score every posting.",
      href: "/dashboard/cv",
      action: setup.cvParsed ? "Change CV" : "Upload CV",
    },
    {
      key: "profile",
      done: setup.profileWithCv,
      title: "Set up your search profile",
      detail: setup.profileWithCv ? "Target roles set, CV attached." : "Target roles and locations, with your CV attached to the profile.",
      href: "/dashboard/profile",
      action: setup.profileWithCv ? "Edit profile" : "Set up profile",
    },
    {
      key: "score",
      done: setup.scored,
      title: "First scoring run",
      detail: readyToScore
        ? run === "running"
          ? null
          : run === "failed"
            ? (error ?? "Scoring failed.")
            : "Starting…"
        : "Starts on its own once the first two steps are done.",
      href: null,
      action: null,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="card space-y-4" aria-label="Setup checklist" aria-busy={run === "running"}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2 className="font-display text-xl font-semibold mt-1">Three steps to your first matches</h2>
        </div>
        <p className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
          {doneCount} of {steps.length} done
        </p>
      </div>

      <ol className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {steps.map((step, i) => (
          <li key={step.key} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3" aria-label={`${step.title}: ${step.done ? "done" : "to do"}`}>
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="font-data mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={
                  step.done
                    ? { background: "var(--color-secondary)", color: "var(--color-accent-fg)" }
                    : { background: "var(--color-bg)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                }
              >
                {step.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{step.title}</p>
                {step.detail && (
                  <p className="text-sm" style={{ color: step.key === "score" && run === "failed" ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                    {step.detail}
                  </p>
                )}
                {step.key === "score" && run === "running" && <ScoringProgress />}
              </div>
            </div>
            {step.href && step.action && (
              <Link href={step.href} className={step.done ? "btn-secondary shrink-0 text-sm" : "btn-primary shrink-0 text-sm"}>
                {step.action} →
              </Link>
            )}
            {step.key === "score" && run === "failed" && (
              <button type="button" className="btn-primary shrink-0 text-sm" onClick={() => void startRun()}>
                Retry scoring
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
