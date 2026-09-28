// Shared text clean-up for adapters that return HTML (or entity-encoded HTML,
// as Greenhouse does). Kept tiny on purpose: postings only need readable
// plain text for embeddings, the LLM, and the description view.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
  middot: "·",
  euro: "€",
  pound: "£",
};

/** Decodes named and numeric HTML entities (`&amp;`, `&#39;`, `&#x27;`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (lower.startsWith("#")) {
      const code = parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[lower] ?? whole;
  });
}

/**
 * Strips tags and collapses whitespace, keeping paragraph/list breaks as
 * newlines so the text still reads as sections rather than one blob.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
