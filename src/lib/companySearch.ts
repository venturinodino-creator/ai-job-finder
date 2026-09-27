/**
 * Company search on the job feed: the user types one or more company names
 * (comma-separated) and gets every ingested posting from those companies,
 * grouped per company, with an explicit "nothing open" entry for companies
 * that have no postings in our sources.
 *
 * Pure helpers only — no DB access — so they can be unit-tested directly.
 */

export const MAX_COMPANIES = 10;
export const MAX_COMPANY_NAME_LENGTH = 80;

/**
 * Turns the raw `?companies=` query value into a clean list of names:
 * split on commas / newlines / semicolons, trimmed, de-duplicated
 * case-insensitively, capped in count and length.
 */
export function parseCompanyQuery(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of text.split(/[,;\n]/)) {
    const name = part.trim().slice(0, MAX_COMPANY_NAME_LENGTH);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= MAX_COMPANIES) break;
  }

  return names;
}

export interface CompanyGroup<T> {
  name: string;
  postings: T[];
}

/**
 * Buckets postings under each requested company name using a
 * case-insensitive substring match on the posting's company field, so
 * "OpenAI" also catches "OpenAI Inc." A posting may land in more than one
 * bucket if the names overlap (e.g. "Google" and "Google DeepMind").
 * Every requested name gets a group, even when it has zero postings.
 */
export function groupPostingsByCompany<T extends { company: string }>(
  names: string[],
  postings: T[],
): CompanyGroup<T>[] {
  return names.map((name) => {
    const needle = name.toLowerCase();
    return {
      name,
      postings: postings.filter((p) => p.company.toLowerCase().includes(needle)),
    };
  });
}
