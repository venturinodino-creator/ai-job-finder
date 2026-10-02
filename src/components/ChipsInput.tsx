"use client";

import { useId, useState } from "react";
import { addChips, parseChips, removeChip } from "@/lib/chips";

export interface ChipNote {
  /** A short suffix shown inside the chip ("in South Africa"). */
  suffix?: string;
  /** "warn" styles the chip as needing attention and lists its hint beneath the field. */
  tone?: "ok" | "warn";
  /** A sentence for the user; shown beneath the field for "warn" chips and as the chip's tooltip. */
  hint?: string;
}

/**
 * A list field as chips: type a value and press Enter or comma to add it,
 * paste a comma-separated list to add several, Backspace on an empty box
 * removes the last chip, and each chip has its own remove button. What is
 * typed but not yet entered is added when the box loses focus, so it is
 * never silently dropped on save. `annotate` can describe each chip.
 */
export function ChipsInput({
  label,
  hint,
  values,
  onChange,
  placeholder,
  annotate,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  annotate?: (value: string) => ChipNote;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  const commit = (text: string) => {
    if (parseChips(text).length > 0) onChange(addChips(values, text));
    setDraft("");
  };

  const notes = values.map((v) => (annotate ? annotate(v) : {}));
  const warnings = values.map((v, i) => ({ v, note: notes[i] })).filter((x) => x.note.tone === "warn" && x.note.hint);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div
        className="input flex min-h-[2.5rem] flex-wrap items-center gap-1.5 !py-1.5"
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
      >
        {values.map((value, i) => {
          const note = notes[i];
          const warn = note.tone === "warn";
          return (
            <span
              key={value.toLowerCase()}
              title={note.hint}
              className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs"
              style={
                warn
                  ? { background: "var(--color-gamify-soft)", color: "var(--color-gamify)" }
                  : { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
              }
            >
              {value}
              {note.suffix && <span className="opacity-70">· {note.suffix}</span>}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(removeChip(values, i));
                }}
              >
                <span aria-hidden>×</span>
              </button>
            </span>
          );
        })}
        <input
          id={id}
          value={draft}
          placeholder={values.length === 0 ? placeholder : undefined}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
          autoComplete="off"
          onChange={(e) => {
            const text = e.target.value;
            // A comma ends an entry: add what came before it and keep what follows.
            if (text.includes(",")) {
              const [head, ...rest] = text.split(",");
              commit(head);
              setDraft(rest.join(","));
            } else {
              setDraft(text);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Enter adds the chip; with nothing typed it must not submit the form by accident.
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              onChange(removeChip(values, values.length - 1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n\r]/.test(text)) {
              e.preventDefault();
              commit(draft + text);
            }
          }}
          onBlur={() => commit(draft)}
        />
      </div>
      {hint && (
        <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </span>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-0.5 text-xs" role="status" style={{ color: "var(--color-gamify)" }}>
          {warnings.map(({ v, note }) => (
            <li key={v}>{note.hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
