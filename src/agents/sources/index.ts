import type { JobSourceAdapter } from "./types";
import { remotiveAdapter } from "./remotive";
import { arbeitnowAdapter } from "./arbeitnow";
import { remoteokAdapter } from "./remoteok";
import { jobicyAdapter } from "./jobicy";

// Add new sources here — each adapter is self-contained (see ./types.ts).
// Company-board sources (Greenhouse/Lever, which expose a public JSON API
// per company) are a natural next addition: one adapter per configured
// company slug. See BUILD_SPEC.md "Job sources" for the roadmap.
export const jobSourceAdapters: JobSourceAdapter[] = [remotiveAdapter, arbeitnowAdapter, remoteokAdapter, jobicyAdapter];

export { remotiveAdapter, arbeitnowAdapter, remoteokAdapter, jobicyAdapter };
export type { JobSourceAdapter, NormalizedJobPosting } from "./types";
