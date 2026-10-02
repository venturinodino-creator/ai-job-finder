// The rules for turning typed text into the list a chips field holds.
// Pure: no React, no DOM.

/** Splits typed or pasted text on commas and new lines, trimming and dropping empty entries. */
export function parseChips(input: string): string[] {
  return input
    .split(/[,\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Adds what was typed or pasted to the list. An entry already there is
 * ignored whatever its casing, and the first spelling is kept. The list
 * given is not modified.
 */
export function addChips(list: string[], input: string): string[] {
  const out = [...list];
  const seen = new Set(out.map((s) => s.toLowerCase()));
  for (const entry of parseChips(input)) {
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/** The list without the chip at `index`; an index that is not there changes nothing. */
export function removeChip(list: string[], index: number): string[] {
  return index >= 0 && index < list.length ? list.filter((_, i) => i !== index) : [...list];
}
