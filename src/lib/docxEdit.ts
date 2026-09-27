import JSZip from "jszip";

export interface DocxEdit {
  before: string;
  after: string;
}

export interface DocxEditResult {
  buffer: Buffer;
  applied: number[];
  notFound: number[];
}

/**
 * Applies text edits to a .docx in place. For each edit, the first paragraph
 * whose text contains `before` gets that text replaced by `after`; the
 * paragraph keeps its own properties (style, bullet/numbering, spacing) and
 * the formatting of its first run, so the document's layout is untouched.
 * Edits whose `before` text doesn't match a single paragraph (e.g. a change
 * that spans several bullets) are reported as notFound, never guessed.
 */
export async function applyEditsToDocx(original: Buffer, edits: DocxEdit[]): Promise<DocxEditResult> {
  const zip = await JSZip.loadAsync(original);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Not a Word document (word/document.xml missing).");
  const xml = await file.async("string");

  // `<w:p\b` never matches <w:pPr> or <w:proofErr>, and paragraphs don't nest.
  const paragraphs = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? [];
  const texts = paragraphs.map(paragraphText);
  const replacements = new Map<number, string>(); // paragraph index -> new text
  const applied: number[] = [];
  const notFound: number[] = [];

  // A change often covers several bullets at once ("before" and "after" with
  // one line per bullet). Each line must find its own paragraph; the change
  // is applied all-or-nothing so a half-rewritten list never ships.
  edits.forEach((edit, index) => {
    const pairs = linePairs(edit);
    if (!pairs) {
      notFound.push(index);
      return;
    }
    const plan: { paragraph: number; text: string }[] = [];
    const taken = new Set<number>();
    for (const [before, after] of pairs) {
      const hit = texts.findIndex((t, p) => !taken.has(p) && !replacements.has(p) && t.toLowerCase().includes(before.toLowerCase()));
      if (hit === -1) break;
      taken.add(hit);
      const at = texts[hit].toLowerCase().indexOf(before.toLowerCase());
      plan.push({ paragraph: hit, text: texts[hit].slice(0, at) + after + texts[hit].slice(at + before.length) });
    }
    if (plan.length !== pairs.length) {
      notFound.push(index);
      return;
    }
    for (const step of plan) replacements.set(step.paragraph, step.text);
    applied.push(index);
  });

  let cursor = 0;
  const updated = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const i = cursor++;
    const text = replacements.get(i);
    return text === undefined ? paragraph : rewriteParagraph(paragraph, text);
  });

  zip.file("word/document.xml", updated);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, applied, notFound };
}

/** Splits a change into (before, after) line pairs; null when the line counts don't line up or a side is empty. */
function linePairs(edit: DocxEdit): [string, string][] | null {
  const befores = edit.before.split(/\r?\n/).map(normalize).filter(Boolean);
  const afters = edit.after.split(/\r?\n/).map(normalize).filter(Boolean);
  if (befores.length === 0 || afters.length === 0) return null;
  if (befores.length === 1 && afters.length === 1) return [[befores[0], afters[0]]];
  if (befores.length !== afters.length) return null;
  return befores.map((b, i) => [b, afters[i]]);
}

/** Concatenated, whitespace-normalised text of a paragraph's runs. */
function paragraphText(paragraph: string): string {
  const parts: string[] = [];
  for (const match of paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) parts.push(decode(match[1]));
  for (const _tab of paragraph.matchAll(/<w:tab\/>/g)) parts.push(" ");
  return normalize(parts.join(""));
}

/** Same paragraph properties, first run's formatting, one run of new text. */
function rewriteParagraph(paragraph: string, text: string): string {
  const open = paragraph.match(/^<w:p\b[^>]*>/)![0];
  const pPr = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const firstRun = paragraph.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/)?.[0] ?? "";
  const rPr = firstRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  return `${open}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${encode(text)}</w:t></w:r></w:p>`;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function encode(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
