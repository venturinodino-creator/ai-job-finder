import { db } from "@/lib/db";
import { ApiError, allowanceError } from "@/lib/api";
import { check } from "@/lib/entitlements";
import { recordActivity } from "@/lib/gamification";
import { describeSnapshot, profileSnapshot, snapshotsDiffer } from "@/lib/profileSnapshot";
import { recordSearch } from "@/lib/searchHistory";
import { toArchivedResults } from "@/lib/archivedResults";
import type { RemotePreference, SearchProfile, Seniority } from "@/generated/prisma/client";

// Saving a search. A search profile is what every reading in the product is
// taken against, so changing it is not a plain update: anything the matcher
// looks at replaces the search. This module is the one place that rule lives.

/** The fields a save may set. Lists are stored trimmed, without empty entries. */
export interface SearchProfileFields {
  name?: string;
  isActive?: boolean;
  targetRoles?: string[];
  locations?: string[];
  remotePref?: RemotePreference;
  seniority?: Seniority | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  expectsCommission?: boolean;
  industries?: string[];
  languages?: string[];
  activeCvId?: string | null;
}

export interface SavedSearch {
  profile: SearchProfile;
  /** The search changed, so its postings need scoring. Never true for a newly created search. */
  rescore: boolean;
}

const LIST_FIELDS = ["targetRoles", "locations", "industries", "languages"] as const;

/**
 * Creates a search profile for the user. A search needs at least one target
 * role. The user's first profile is attached to their most recent parsed CV
 * when they did not choose one, so a new user does not have to visit the CV
 * page to connect the two. Nothing is scored here: a new profile has no
 * scores to replace, and the setup checklist starts the first run once a CV
 * is attached, which is why this never asks for a re-score. Nothing goes to
 * the Archive until this search is replaced by another.
 */
export async function createSearchProfile(userId: string, fields: SearchProfileFields): Promise<SavedSearch> {
  const data = normalise(fields);
  requireRole(data.targetRoles ?? []);

  const isFirst = (await db.searchProfile.count({ where: { userId } })) === 0;
  if (data.activeCvId === undefined && isFirst) data.activeCvId = (await newestParsedCvId(userId)) ?? undefined;

  const profile = await db.searchProfile.create({ data: { ...data, userId } });
  if (isFirst) await recordActivity(userId, "PROFILE_CREATED");
  return { profile, rescore: false };
}

/** The user's most recently uploaded CV that has been parsed, or null. */
async function newestParsedCvId(userId: string): Promise<string | null> {
  const cvs = await db.cv.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, parsed: true } });
  return cvs.find((cv) => cv.parsed !== null)?.id ?? null;
}

/**
 * Saves changes to one of the user's profiles. When anything the matcher
 * looks at differs (roles, locations, remote preference, seniority, salary,
 * industries, languages, the attached CV), the search is replaced: the one
 * being replaced is filed in the Archive with the matches the feed showed
 * for it, the scores the user has not acted on are dropped, the scores of
 * postings they applied to are kept, and the caller is told to re-score.
 * A save that changes none of those is just a save.
 */
export async function updateSearchProfile(userId: string, profileId: string, fields: SearchProfileFields): Promise<SavedSearch> {
  const before = await db.searchProfile.findUnique({ where: { id: profileId } });
  if (!before || before.userId !== userId) throw new ApiError(404, "Search profile not found");

  const data = normalise(fields);
  if (data.targetRoles !== undefined) requireRole(data.targetRoles);

  // A change the matcher would look at needs a new scoring run, and the save drops the
  // scores it replaces. Without a run to follow it the user would be left with an empty
  // feed, so a save the allowance cannot follow is refused before it replaces anything.
  const merged: Record<string, unknown> = { ...before };
  for (const [key, value] of Object.entries(data)) if (value !== undefined) merged[key] = value;
  if (snapshotsDiffer(profileSnapshot(before), profileSnapshot(merged as Parameters<typeof profileSnapshot>[0]))) {
    const peek = await check(userId, "SCORING_RUN");
    if (!peek.allowed) throw allowanceError(peek, "This change needs a new scoring run, so it was not saved. ");
  }

  const profile = await db.searchProfile.update({ where: { id: profileId }, data });

  const previous = profileSnapshot(before);
  const rescore = snapshotsDiffer(previous, profileSnapshot(profile));
  if (rescore) {
    const matches = await db.matchScore.findMany({
      where: { profileId },
      include: { jobPosting: { select: { id: true, title: true, company: true, location: true, url: true, source: { select: { name: true } } } } },
    });
    await recordSearch(userId, "PROFILE_CHANGE", describeSnapshot(previous), { ...previous }, toArchivedResults(matches));
    await db.matchScore.deleteMany({ where: { profileId, appliedAt: null } });
  }
  return { profile, rescore };
}

function normalise(fields: SearchProfileFields): SearchProfileFields {
  const out: SearchProfileFields = { ...fields };
  for (const key of LIST_FIELDS) {
    const list = fields[key];
    if (list !== undefined) out[key] = list.map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

function requireRole(targetRoles: string[]): void {
  if (targetRoles.length === 0) throw new ApiError(400, "Add at least one target role: it is what postings are scored against.");
}
