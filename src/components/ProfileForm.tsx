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

// Slider ceiling/step per currency: a sensible annual-salary range differs by
// an order of magnitude between e.g. EUR and ZAR. Typed amounts are never
// clamped — the slider just pins at its ceiling if you type past it.
const CURRENCIES: { code: string; max: number; step: number }[] = [
  { code: "EUR", max: 300_000, step: 1_000 },
  { code: "USD", max: 300_000, step: 1_000 },
  { code: "GBP", max: 250_000, step: 1_000 },
  { code: "ZAR", max: 3_000_000, step: 10_000 },
  { code: "CHF", max: 300_000, step: 1_000 },
  { code: "SEK", max: 2_000_000, step: 10_000 },
  { code: "DKK", max: 2_000_000, step: 10_000 },
  { code: "NOK", max: 2_000_000, step: 10_000 },
  { code: "PLN", max: 600_000, step: 5_000 },
  { code: "CAD", max: 300_000, step: 1_000 },
  { code: "AUD", max: 300_000, step: 1_000 },
  { code: "SGD", max: 300_000, step: 1_000 },
  { code: "AED", max: 1_000_000, step: 5_000 },
  { code: "INR", max: 10_000_000, step: 50_000 },
  { code: "JPY", max: 30_000_000, step: 100_000 },
];
const DEFAULT_CURRENCY = "USD";

export function ProfileForm({ profile }: { profile: SearchProfile | null }) {
  const router = useRouter();
  const [targetRoles, setTargetRoles] = useState(profile?.targetRoles.join(", ") ?? "");
  const [locations, setLocations] = useState(profile?.locations.join(", ") ?? "");
  const [remotePref, setRemotePref] = useState<RemotePreference>(profile?.remotePref ?? "ANY");
  const [seniority, setSeniority] = useState<Seniority | "">(profile?.seniority ?? "");
  const [currency, setCurrency] = useState(profile?.salaryCurrency ?? DEFAULT_CURRENCY);
  const [salaryMin, setSalaryMin] = useState(profile?.salaryMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(profile?.salaryMax?.toString() ?? "");
  const [industries, setIndustries] = useState(profile?.industries.join(", ") ?? "");
  const [languages, setLanguages] = useState(profile?.languages.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cur = CURRENCIES.find((c) => c.code === currency) ?? { code: currency, max: 300_000, step: 1_000 };
  const minNum = salaryMin === "" ? null : Number(salaryMin);
  const maxNum = salaryMax === "" ? null : Number(salaryMax);

  function updateMin(value: string) {
    setSalaryMin(value);
    if (value !== "" && salaryMax !== "" && Number(value) > Number(salaryMax)) setSalaryMax(value);
  }
  function updateMax(value: string) {
    setSalaryMax(value);
    if (value !== "" && salaryMin !== "" && Number(value) < Number(salaryMin)) setSalaryMin(value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setError("Minimum salary can't exceed the maximum.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      targetRoles: splitList(targetRoles),
      locations: splitList(locations),
      remotePref,
      seniority: seniority || null,
      salaryMin: minNum,
      salaryMax: maxNum,
      salaryCurrency: currency,
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
            <option value="">No preference</option>
            {SENIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Salary range (optional)</span>
          {(salaryMin !== "" || salaryMax !== "") && (
            <button
              type="button"
              className="text-xs underline"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => {
                setSalaryMin("");
                setSalaryMax("");
              }}
            >
              Clear
            </button>
          )}
        </div>

        <SalaryBound
          label="Minimum"
          value={salaryMin}
          onChange={updateMin}
          max={cur.max}
          step={cur.step}
        />
        <SalaryBound
          label="Maximum"
          value={salaryMax}
          onChange={updateMax}
          max={cur.max}
          step={cur.step}
        />

        <p className="font-data text-sm" style={{ color: "var(--color-text-muted)" }}>
          {describeRange(minNum, maxNum, currency)}
        </p>
      </div>

      <Field label="Industries (optional)" hint="Comma-separated">
        <input className="input" value={industries} onChange={(e) => setIndustries(e.target.value)} />
      </Field>

      <Field label="Languages (optional)" hint="Comma-separated">
        <input className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} />
      </Field>

      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving..." : profile ? "Save changes" : "Create search profile"}
      </button>
    </form>
  );
}

// One salary bound: a slider and a number field bound to the same value, so
// you can drag or type, whichever you prefer.
function SalaryBound({
  label,
  value,
  onChange,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  step: number;
}) {
  const sliderValue = value === "" ? 0 : Math.min(Number(value), max);
  return (
    <div className="grid grid-cols-[5rem_1fr_8rem] items-center gap-3">
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={sliderValue}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} salary`}
        className="w-full"
        style={{ accentColor: "var(--color-accent)" }}
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="Any"
        className="input font-data"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} salary amount`}
      />
    </div>
  );
}

function describeRange(min: number | null, max: number | null, currency: string): string {
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency} ${n.toLocaleString()}`;
    }
  };
  if (min === null && max === null) return "No salary preference — leave blank to match any range.";
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)} per year`;
  if (min !== null) return `From ${fmt(min)} per year`;
  return `Up to ${fmt(max as number)} per year`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{hint}</span>}
    </label>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
