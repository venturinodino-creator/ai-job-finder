import Link from "next/link";
import { SignalBar } from "@/components/SignalBar";
import { formatRelative } from "@/lib/formatRelative";
import { readingTone } from "@/lib/posting";
import type { PostingState } from "@/lib/searchState";

/**
 * Why this posting was worth opening: the score in the signal bar, the
 * explanation, and the skills that matched and the ones that are missing.
 * A posting the search has not scored says so and points to where scoring
 * happens, rather than showing a zero. The tags sit in the page header.
 */
export function PostingReadingPanel({ reading, tailorHref }: { reading: PostingState["reading"]; tailorHref?: string }) {
  if (!reading) {
    return (
      <section className="card space-y-2" aria-label="Your match">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Your match</p>
          <span
            className="font-data rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide"
            style={{ background: "var(--color-bg)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
          >
            Not scored
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Your current search has not scored this posting, so there is no reading yet. You can still tailor your CV and apply.{" "}
          <Link href="/dashboard/jobs" className="underline" style={{ color: "var(--color-text)" }}>
            Refresh matches
          </Link>{" "}
          to score today&apos;s postings.
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-4" aria-label="Your match">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Your match</p>
        <p className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
          Scored {formatRelative(reading.scoredAt)}
        </p>
      </div>

      <SignalBar value={reading.score} tone={readingTone(reading)} label={`Match score ${reading.score} of 100`} />

      {reading.explanation && <p className="text-sm">{reading.explanation}</p>}
      {reading.wildcardReason && (
        <p className="text-sm" style={{ color: "var(--color-gamify)" }}>
          Why a wildcard: {reading.wildcardReason}
        </p>
      )}

      {(reading.matchedSkills.length > 0 || reading.missingSkills.length > 0) && (
        <div className="grid gap-4">
          <SkillList title="Matched" skills={reading.matchedSkills} tone="secondary" empty="No specific skills were matched." />
          <div className="space-y-2">
            <SkillList title="Missing" skills={reading.missingSkills} tone="muted" empty="Nothing the posting asks for is missing from your CV." />
            {reading.missingSkills.length > 0 && tailorHref && (
              <a href={tailorHref} className="text-xs underline" style={{ color: "var(--color-text-muted)" }}>
                Tailor your CV to address these →
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SkillList({ title, skills, tone, empty }: { title: string; skills: string[]; tone: "secondary" | "muted"; empty: string }) {
  return (
    <div>
      <p className="eyebrow">
        {title} <span className="font-data">({skills.length})</span>
      </p>
      {skills.length === 0 ? (
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {empty}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${title} skills`}>
          {skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full px-2.5 py-1 text-xs"
              style={
                tone === "secondary"
                  ? { background: "var(--color-secondary-soft)", color: "var(--color-secondary)" }
                  : { background: "var(--color-bg)", color: "var(--color-text)", border: "1px dashed var(--color-border)" }
              }
            >
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
