"use client";

import { errorFromResponse } from "@/lib/allowanceClient";
import { useState } from "react";
import { ChipsInput, type ChipNote } from "@/components/ChipsInput";
import { Field, FormSection } from "@/components/FormSection";
import { DEFAULT_CURRENCY, SalaryFields } from "@/components/SalaryFields";
import { SaveSearchStatus, useSaveSearch } from "@/components/ScoringRun";
import { describeLocation } from "@/lib/locationFit";
import { saveConsequence, valuesFromProfile, type ProfileFormValues } from "@/lib/profileConsequence";
import { REMOTE_LABELS, REMOTE_ORDER, SENIORITY_LABELS, SENIORITY_ORDER, remoteRule } from "@/lib/profileLabels";
import type { RemotePreference, Seniority, SearchProfile } from "@/generated/prisma/client";

/**
 * The search profile as grouped sections (What, Where, Pay, Languages).
 * Once the form differs from the saved search, the save area says what
 * saving will do with the real counts, the button says it re-scores, and
 * the changes can be discarded. An unchanged form offers nothing to save.
 */
export function ProfileForm({ profile, scored, applied }: { profile: SearchProfile | null; scored: number; applied: number }) {
  const flow = useSaveSearch();
  const saved: ProfileFormValues | null = profile ? valuesFromProfile(profile) : null;

  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.targetRoles ?? []);
  const [locations, setLocations] = useState<string[]>(profile?.locations ?? []);
  const [remotePref, setRemotePref] = useState<RemotePreference>(profile?.remotePref ?? "ANY");
  const [seniority, setSeniority] = useState<Seniority | "">(profile?.seniority ?? "");
  const [currency, setCurrency] = useState(profile?.salaryCurrency ?? DEFAULT_CURRENCY);
  const [salaryMin, setSalaryMin] = useState(profile?.salaryMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(profile?.salaryMax?.toString() ?? "");
  const [expectsCommission, setExpectsCommission] = useState(profile?.expectsCommission ?? false);
  const [industries, setIndustries] = useState<string[]>(profile?.industries ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [error, setError] = useState<string | null>(null);

  const minNum = salaryMin === "" ? null : Number(salaryMin);
  const maxNum = salaryMax === "" ? null : Number(salaryMax);

  const edited: ProfileFormValues = {
    targetRoles,
    locations,
    remotePref,
    seniority: seniority || null,
    salaryMin: minNum,
    salaryMax: maxNum,
    salaryCurrency: currency,
    expectsCommission,
    industries,
    languages,
  };
  const consequence = saveConsequence({ saved, edited, scored, applied });

  function discard() {
    setTargetRoles(profile?.targetRoles ?? []);
    setLocations(profile?.locations ?? []);
    setRemotePref(profile?.remotePref ?? "ANY");
    setSeniority(profile?.seniority ?? "");
    setCurrency(profile?.salaryCurrency ?? DEFAULT_CURRENCY);
    setSalaryMin(profile?.salaryMin?.toString() ?? "");
    setSalaryMax(profile?.salaryMax?.toString() ?? "");
    setExpectsCommission(profile?.expectsCommission ?? false);
    setIndustries(profile?.industries ?? []);
    setLanguages(profile?.languages ?? []);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (targetRoles.length === 0) {
      setError("Add at least one target role: it is what postings are scored against.");
      return;
    }
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setError("Minimum salary can't exceed the maximum.");
      return;
    }
    setError(null);

    // Save, then (when the search changed) re-score with visible progress and
    // land on Matches: the same flow the Archive's restore control uses.
    await flow.save(async () => {
      const res = await fetch(profile ? `/api/profile/${profile.id}` : "/api/profile", {
        method: profile ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited),
      });
      const data = await res.json();
      if (!res.ok) throw errorFromResponse(data, "Failed to save profile.");
      // A new profile has no scores to replace: the Overview's setup checklist
      // takes it from here and starts the first run once a CV is attached.
      return { rescore: Boolean(data.rescore), land: profile ? undefined : "/dashboard" };
    });
  }

  const nothingToSave = profile !== null && !consequence.dirty;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormSection id="what" title="What you are looking for">
        <ChipsInput
          label="Target role(s)"
          hint="Type a role and press Enter or comma, e.g. Senior Backend Engineer. At least one is needed."
          values={targetRoles}
          onChange={setTargetRoles}
          placeholder="Add a role"
        />
        <Field label="Seniority (optional)">
          <select className="input" value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority | "")}>
            <option value="">No preference</option>
            {SENIORITY_ORDER.map((opt) => (
              <option key={opt} value={opt}>
                {SENIORITY_LABELS[opt]}
              </option>
            ))}
          </select>
        </Field>
        <ChipsInput label="Industries (optional)" hint="Type an industry and press Enter or comma." values={industries} onChange={setIndustries} placeholder="Add an industry" />
      </FormSection>

      <FormSection id="where" title="Where">
        <ChipsInput
          label="Region / location(s)"
          hint="Countries, cities or groups such as EU, e.g. Berlin, Netherlands, EU."
          values={locations}
          onChange={setLocations}
          placeholder="Add a place"
          annotate={annotateLocation}
        />
        <Field label="Remote preference" hint={remoteRule(remotePref, locations)}>
          <select className="input" value={remotePref} onChange={(e) => setRemotePref(e.target.value as RemotePreference)}>
            {REMOTE_ORDER.map((opt) => (
              <option key={opt} value={opt}>
                {REMOTE_LABELS[opt]}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection id="pay" title="Pay">
        <SalaryFields
          currency={currency}
          onCurrency={setCurrency}
          min={salaryMin}
          max={salaryMax}
          onMin={setSalaryMin}
          onMax={setSalaryMax}
          expectsCommission={expectsCommission}
          onCommission={setExpectsCommission}
        />
      </FormSection>

      <FormSection id="languages" title="Languages">
        <ChipsInput label="Languages (optional)" hint="Languages you work in or that postings require." values={languages} onChange={setLanguages} placeholder="Add a language" />
      </FormSection>

      <div className="card space-y-3" style={consequence.replaces ? { borderColor: "var(--color-accent)" } : undefined}>
        {consequence.statement && (
          <p role="status" className="text-sm">
            {consequence.statement}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={flow.busy || nothingToSave} className="btn-primary">
            {flow.phase === "saving" ? "Saving..." : consequence.buttonLabel}
          </button>
          {consequence.dirty && profile && !flow.busy && (
            <button type="button" className="text-sm underline" style={{ color: "var(--color-text-muted)" }} onClick={discard}>
              Discard changes
            </button>
          )}
        </div>
        <SaveSearchStatus flow={flow} savedNote="Search saved." />
      </div>
    </form>
  );
}

/** What a location chip says about itself: recognised (and where), a group, or matched only as typed. */
function annotateLocation(value: string): ChipNote {
  const reading = describeLocation(value);
  if (reading.kind === "typed") return { tone: "warn", suffix: "as typed", hint: reading.hint };
  if (reading.kind === "region") return { tone: "ok", suffix: reading.region?.toLowerCase() === value.trim().toLowerCase() ? undefined : `in ${reading.region}`, hint: reading.hint };
  return { tone: "ok", suffix: "group", hint: reading.hint };
}
