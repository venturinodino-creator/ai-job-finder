import { describe, expect, it } from "vitest";
import { postingSteps } from "../src/lib/postingSteps";

// The three steps the posting page shows for one posting: what each is
// called, whether it is done, the one line that describes its state, and
// the section it jumps to.

const nothing = { tailored: false, draft: false, applied: null, appliedWithNote: false };

describe("postingSteps", () => {
  it("lists review, tailor and apply in order, each jumping to its section", () => {
    const steps = postingSteps(nothing);
    expect(steps.map((s) => [s.number, s.key, s.href])).toEqual([
      [1, "review", "#posting"],
      [2, "tailor", "#tailor"],
      [3, "apply", "#apply"],
    ]);
  });

  it("counts reviewing as done on arrival, and marks only tailoring optional", () => {
    const [review, tailor, apply] = postingSteps(nothing);
    expect(review.done).toBe(true);
    expect([review.optional, tailor.optional, apply.optional]).toEqual([false, true, false]);
    expect(tailor).toMatchObject({ done: false, detail: "Optional" });
    expect(apply).toMatchObject({ done: false, detail: "Not applied yet" });
  });

  it("marks tailoring done once changes exist for the active CV", () => {
    const [, tailor] = postingSteps({ ...nothing, tailored: true });
    expect(tailor).toMatchObject({ done: true, detail: "Changes ready to review" });
  });

  it("shows a draft as progress on the apply step without calling it done", () => {
    const [, , apply] = postingSteps({ ...nothing, draft: true });
    expect(apply).toMatchObject({ done: false, detail: "Draft ready to send" });
  });

  it("says when and how the posting was applied to", () => {
    const at = new Date("2026-10-05T09:00:00Z");
    expect(postingSteps({ ...nothing, applied: { method: "EMAIL", at }, appliedWithNote: true })[2]).toMatchObject({ done: true, detail: "Applied 5 Oct 2026 by email" });
    expect(postingSteps({ ...nothing, applied: { method: "MANUAL", at }, appliedWithNote: true })[2]).toMatchObject({ done: true, detail: "Applied 5 Oct 2026 on the company site" });
    expect(postingSteps({ ...nothing, applied: { method: "MANUAL", at }, appliedWithNote: false })[2]).toMatchObject({ done: true, detail: "Applied 5 Oct 2026" });
    expect(postingSteps({ ...nothing, applied: { method: null, at }, appliedWithNote: false })[2]).toMatchObject({ done: true, detail: "Applied 5 Oct 2026" });
  });

  it("allows applying without tailoring: the steps are not gated", () => {
    const [, tailor, apply] = postingSteps({ ...nothing, applied: { method: "MANUAL", at: new Date("2026-10-05T09:00:00Z") }, appliedWithNote: false });
    expect(tailor.done).toBe(false);
    expect(apply.done).toBe(true);
  });
});
