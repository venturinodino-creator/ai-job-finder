/**
 * Merges the adapters configured in code with what the DB knows about each
 * source, so the Overview can list every ingest agent — including ones that
 * are configured but haven't had their first run yet.
 *
 * Pure: no DB access, so it's unit-tested directly.
 */

export type SourceKind = "PUBLIC_API" | "RSS" | "COMPANY_BOARD";

export interface ConfiguredSource {
  key: string;
  name: string;
  baseUrl: string;
  kind?: SourceKind;
}

export interface StoredSource {
  key: string;
  enabled: boolean;
  lastFetchedAt: Date | null;
  lastError: string | null;
  postings: number;
}

export type SourceHealth = "ok" | "error" | "pending" | "disabled";

export interface SourceStatus {
  key: string;
  name: string;
  baseUrl: string;
  kind: SourceKind;
  health: SourceHealth;
  postings: number;
  lastFetchedAt: Date | null;
  lastError: string | null;
}

export function buildSourceStatus(configured: ConfiguredSource[], stored: StoredSource[]): SourceStatus[] {
  const byKey = new Map(stored.map((s) => [s.key, s]));
  return configured
    .map((c): SourceStatus => {
      const row = byKey.get(c.key);
      const kind = c.kind ?? "PUBLIC_API";
      if (!row) {
        return { key: c.key, name: c.name, baseUrl: c.baseUrl, kind, health: "pending", postings: 0, lastFetchedAt: null, lastError: null };
      }
      const health: SourceHealth = !row.enabled
        ? "disabled"
        : row.lastError
          ? "error"
          : row.lastFetchedAt
            ? "ok"
            : "pending";
      return {
        key: c.key,
        name: c.name,
        baseUrl: c.baseUrl,
        kind,
        health,
        postings: row.postings,
        lastFetchedAt: row.lastFetchedAt,
        lastError: row.lastError,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The one-line reading of all sources: how many, how many postings they hold, and how many are failing. */
export function summariseSources(sources: SourceStatus[]): { sources: number; postings: number; failing: number } {
  return {
    sources: sources.length,
    postings: sources.reduce((n, s) => n + s.postings, 0),
    failing: sources.filter((s) => s.health === "error").length,
  };
}
