import { decodeEntities, htmlToText } from "./html";

// Minimal RSS reader for the feed adapters. Feeds here are plain RSS 2.0 with
// a handful of tags per <item>, so a regex pass is enough and avoids pulling
// in an XML dependency. Text is either wrapped in CDATA (already HTML) or
// entity-encoded (WeWorkRemotely); both come out as readable plain text.

/** Every `<item>…</item>` (or the given tag) in the document, as raw XML. */
export function rssItems(xml: string, tag = "item"): string[] {
  return xml.match(new RegExp(`<${tag}[ >][\\s\\S]*?</${tag}>`, "g")) ?? [];
}

/** Raw inner content of the first `<tag>` in `item`, CDATA unwrapped and entities decoded to HTML. */
function innerHtml(item: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = item.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`));
  if (!match) return null;
  const raw = match[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (!cdata) return decodeEntities(raw);
  const body = cdata[1];
  // Some feeds entity-encode their HTML and then wrap that in CDATA as well.
  return /&lt;\/?[a-z]/i.test(body) && !/<[a-z]/i.test(body) ? decodeEntities(body) : body;
}

/** The tag's content as plain text (tags stripped, whitespace collapsed), or null when absent or empty. */
export function rssText(item: string, tag: string): string | null {
  const html = innerHtml(item, tag);
  if (html === null) return null;
  const text = htmlToText(html);
  return text || null;
}

/** The tag's content as HTML (CDATA unwrapped), for callers that need to split on markup before flattening. */
export function rssHtml(item: string, tag: string): string | null {
  const html = innerHtml(item, tag);
  return html === null || !html.trim() ? null : html;
}
