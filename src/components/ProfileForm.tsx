"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RemotePreference, Seniority, SearchProfile } from "@/generated/prisma/client";

const REMOTE_OPTIONS: RemotePreference[] = ["ANY", "REMOTE", "HYBRID", "ON_SITE"];
const SENIORITY_OPTIONS: Seniority[] = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "STAFF",
  "PRINCIPAL",
  "MANAGER",
  "DIRECTOR",
  "EXECUTIVE",
];

export function ProfileForm({ profile }: { profile: SearchProfile | null }) {
  const router = useRouter();
  const [targetRoles, setTargetRoles] = useState(profile?.targetRoles.join(", ") ?? "");
  const [locations, setLocations] = useState(profile?.locations.join(", ") ?? "");
  const [remotePref, setRemotePref] = useState<RemotePreference>(profile?.remotePref ?? "ANY");
  const [seniority, setSeniority] = useState<Seniority | "">(profile?.seniority ?? "");
  const [salaryMin, setSalaryMin] = useState(profile?.salaryMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(profile?.salaryMax?.toString() ?? "");
  const [industries, setIndustries] = useState(profile?.industries.join(", ") ?? "");
  const [languages, setLanguages] = useState(profile?.languages.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      targetRoles: splitList(targetRoles),
      locations: splitList(locations),
      remotePref,
      seniority: seniority || null,
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      industries: splitList(industries),
      languages: splitList(languages),
    };

    try {
      const res = await fetch(profile ? `/api/profile/${profile.id}` : "/api/profile", {
        method: profile ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save profile.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <Field label="Target role(s)" hint="Comma-separated, e.g. Senior Backend Engineer, Staff Engineer">
        <input className="input" value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} />
      </Field>

      <Field label="Region / location(s)" hint="Comma-separated, e.g. Berlin, Netherlands, EU">
        <input className="input" value={locations} onChange={(e) => setLocations(e.target.value)} />
      </Field>

      <Field label="Remote preference">
        <select className="input" value={remotePref} onChange={(e) => setRemotePref(e.target.value as RemotePreference)}>
          {REMOTE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Seniority (optional)">
          <select className="input" value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority | "")}>
            <option value="">Any</option>
            {SENIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salary range (optional)">
          <div className="flex gap-2">
            <input className="input" placeholder="Min" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
            <input className="input" placeholder="Max" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
        </Field>
      </div>

      <Field label="Industries (optional)" hint="Comma-separated">
        <input className="input" value={industries} onChange={(e) => setIndustries(e.target.value)} />
      </Field>

      <Field label="Languages (optional)" hint="Comma-separated">
        <input className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving..." : profile ? "Save changes" : "Create search profile"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
