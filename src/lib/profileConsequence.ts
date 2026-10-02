import { profileSnapshot, snapshotsDiffer, type ProfileSnapshot } from "@/lib/profileSnapshot";

// What the profile page says before the user presses Save: whether the form
// differs from the saved search, the sentence that states the consequence
// with real numbers, and what the button is called. "Differs" is read the
// way the server reads it, so a reordering or a change of casing is not a
// change. Pure: no database, no React.

/** The fields the profile form edits (the attached CV is changed on the CV page). */
export type ProfileFormValues = Omit<ProfileSnapshot, "activeCvId">;

type ValuesLike = Parameters<typeof profileSnapshot>[0];

/** The form's values for a saved profile, normalised the way the server reads them. */
export function valuesFromProfile(profile: ValuesLike): ProfileFormValues {
  const { activeCvId: _cv, ...values } = profileSnapshot(profile);
  void _cv;
  return values;
}

export interface SaveConsequence {
  /** The form differs from the saved search (always true for a first search). */
  dirty: boolean;
  /** Saving will replace the current search: archive it, drop unacted scores, re-score. */
  replaces: boolean;
  /** One or two sentences saying what saving will do, or null when there is nothing to say. */
  statement: string | null;
  buttonLabel: string;
}

const DURATION = "1–3 minutes";

export function saveConsequence(input: {
  /** The saved search, or null when this is the user's first. */
  saved: ProfileFormValues | null;
  edited: ProfileFormValues;
  /** Scored matches of the current search, wildcards included. */
  scored: number;
  /** Matches the user applied to, which a new search keeps. */
  applied: number;
}): SaveConsequence {
  const { saved, edited, scored, applied } = input;

  if (saved === null) {
    return {
      dirty: true,
      replaces: false,
      statement: "Creating your search takes you to the Overview, where the first scoring run starts as soon as a CV is attached.",
      buttonLabel: "Create search profile",
    };
  }

  const dirty = snapshotsDiffer(profileSnapshot({ ...saved, activeCvId: null }), profileSnapshot({ ...edited, activeCvId: null }));
  if (!dirty) return { dirty: false, replaces: false, statement: null, buttonLabel: "No changes to save" };

  if (scored === 0) {
    return {
      dirty: true,
      replaces: true,
      statement: `Saving starts a new search and re-scores it, which takes ${DURATION}. Nothing is archived: the current search has no matches.`,
      buttonLabel: "Save and re-score",
    };
  }

  const archived = `archived with its ${scored} ${scored === 1 ? "match" : "matches"}`;
  const kept = applied > 0 ? `, the ${applied} you applied to ${applied === 1 ? "is" : "are"} kept` : "";
  return {
    dirty: true,
    replaces: true,
    statement: `Saving replaces your current search: it is ${archived}${kept}, and re-scoring takes ${DURATION}.`,
    buttonLabel: "Save and re-score",
  };
}
