// The three steps the posting page shows for one posting, in the order the
// work happens: review the match, tailor the CV (optional), apply. Nothing is
// gated; each step only reports whether it is done. Pure: no database, no React.

export interface PostingStep {
  key: "review" | "tailor" | "apply";
  number: 1 | 2 | 3;
  title: string;
  optional: boolean;
  done: boolean;
  /** One line describing the step's state. */
  detail: string;
  /** The section of the page the step jumps to. */
  href: string;
}

export interface PostingStepsInput {
  /** Tailored changes exist for the active CV. */
  tailored: boolean;
  /** An application draft exists that has not been sent. */
  draft: boolean;
  /** How and when the posting was applied to, when it was. */
  applied: { method: "EMAIL" | "MANUAL" | null; at: Date } | null;
  /** The applied application carries a cover note (it went through a draft). */
  appliedWithNote: boolean;
}

export function postingSteps(input: PostingStepsInput): [PostingStep, PostingStep, PostingStep] {
  const { applied } = input;
  const how = applied?.method === "EMAIL" ? " by email" : applied?.method === "MANUAL" && input.appliedWithNote ? " on the company site" : "";
  return [
    // Arriving on the page is the review: the posting has been opened.
    { key: "review", number: 1, title: "Review the match", optional: false, done: true, detail: "The reading and the posting", href: "#posting" },
    {
      key: "tailor",
      number: 2,
      title: "Tailor your CV",
      optional: true,
      done: input.tailored,
      detail: input.tailored ? "Changes ready to review" : "Optional",
      href: "#tailor",
    },
    {
      key: "apply",
      number: 3,
      title: "Apply",
      optional: false,
      done: applied !== null,
      detail: applied ? `Applied ${formatDay(applied.at)}${how}` : input.draft ? "Draft ready to send" : "Not applied yet",
      href: "#apply",
    },
  ];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "5 Oct 2026", in UTC so the server and every viewer agree. */
function formatDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
