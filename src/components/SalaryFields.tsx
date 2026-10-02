"use client";

import { Field } from "@/components/FormSection";

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

export const DEFAULT_CURRENCY = "USD";

/**
 * The pay part of the profile: currency, a salary range with a slider and a
 * number field for each bound, and whether commission is expected. The two
 * bounds keep each other in order: moving one past the other drags it along.
 */
export function SalaryFields({
  currency,
  onCurrency,
  min,
  max,
  onMin,
  onMax,
  expectsCommission,
  onCommission,
}: {
  currency: string;
  onCurrency: (code: string) => void;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  expectsCommission: boolean;
  onCommission: (value: boolean) => void;
}) {
  const cur = CURRENCIES.find((c) => c.code === currency) ?? { code: currency, max: 300_000, step: 1_000 };
  const minNum = min === "" ? null : Number(min);
  const maxNum = max === "" ? null : Number(max);

  function updateMin(value: string) {
    onMin(value);
    if (value !== "" && max !== "" && Number(value) > Number(max)) onMax(value);
  }
  function updateMax(value: string) {
    onMax(value);
    if (value !== "" && min !== "" && Number(value) < Number(min)) onMin(value);
  }

  return (
    <>
      <Field label="Currency">
        <select className="input" value={currency} onChange={(e) => onCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Salary range (optional)</span>
          {(min !== "" || max !== "") && (
            <button
              type="button"
              className="text-xs underline"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => {
                onMin("");
                onMax("");
              }}
            >
              Clear
            </button>
          )}
        </div>

        <SalaryBound label="Minimum" value={min} onChange={updateMin} max={cur.max} step={cur.step} />
        <SalaryBound label="Maximum" value={max} onChange={updateMax} max={cur.max} step={cur.step} />

        <p className="font-data text-sm" style={{ color: "var(--color-text-muted)" }}>
          {describeRange(minNum, maxNum, currency)}
          {expectsCommission && (minNum !== null || maxNum !== null) ? " + commission" : ""}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            aria-pressed={expectsCommission}
            onClick={() => onCommission(!expectsCommission)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={
              expectsCommission
                ? { background: "var(--color-accent-soft)", borderColor: "var(--color-accent)", color: "var(--color-accent)" }
                : { borderColor: "var(--color-border)", color: "var(--color-text-muted)" }
            }
          >
            {expectsCommission ? "✓ Expects commission" : "Expects commission"}
          </button>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {expectsCommission
              ? "Roles offering commission / OTE on top of base will score higher."
              : "Turn on if you expect commission or OTE on top of base salary."}
          </span>
        </div>
      </div>
    </>
  );
}

// One salary bound: a slider and a number field bound to the same value, so
// you can drag or type, whichever you prefer.
function SalaryBound({ label, value, onChange, max, step }: { label: string; value: string; onChange: (value: string) => void; max: number; step: number }) {
  const sliderValue = value === "" ? 0 : Math.min(Number(value), max);
  return (
    <div className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-3">
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
        className="w-full min-w-0"
        style={{ accentColor: "var(--color-accent)" }}
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="Any"
        className="input font-data min-w-0"
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
