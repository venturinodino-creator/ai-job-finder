/**
 * Which company career pages we pull directly. Greenhouse, Lever and Ashby
 * each expose a public, key-free JSON feed per company, so one adapter
 * instance per configured board gives the job feed (and the company search)
 * a company's *entire* careers page instead of whatever they cross-post to
 * the aggregators.
 *
 * Override the defaults with GREENHOUSE_BOARDS / LEVER_BOARDS / ASHBY_BOARDS,
 * comma-separated `slug` or `slug:Display Name` entries. The slug is the one
 * in the company's board URL, e.g. boards.greenhouse.io/<slug>,
 * jobs.lever.co/<slug>, jobs.ashbyhq.com/<slug>.
 */

export type BoardPlatform = "greenhouse" | "lever" | "ashby";

export interface CompanyBoard {
  platform: BoardPlatform;
  slug: string;
  name: string;
}

/** Newest-first cap per board so a 900-role employer doesn't swamp the daily ingest. */
export const MAX_POSTINGS_PER_BOARD = 120;

const DEFAULT_BOARDS: Record<BoardPlatform, string> = {
  greenhouse:
    "anthropic:Anthropic,xai:xAI,scaleai:Scale AI,databricks:Databricks,cloudflare:Cloudflare," +
    "datadog:Datadog,gitlab:GitLab,adyen:Adyen,elastic:Elastic,stripe:Stripe,figma:Figma,twilio:Twilio," +
    "samsara:Samsara,coinbase:Coinbase",
  lever: "palantir:Palantir,spotify:Spotify,binance:Binance,nium:Nium",
  ashby:
    "openai:OpenAI,cohere:Cohere,perplexity:Perplexity,elevenlabs:ElevenLabs,notion:Notion," +
    "supabase:Supabase,replit:Replit,ramp:Ramp,linear:Linear",
};

const ENV_VAR: Record<BoardPlatform, string> = {
  greenhouse: "GREENHOUSE_BOARDS",
  lever: "LEVER_BOARDS",
  ashby: "ASHBY_BOARDS",
};

/**
 * Parses `slug` / `slug:Name` entries. Slugs are lower-cased and restricted
 * to URL-safe characters so a typo can't turn into a weird fetch URL.
 * Duplicates (by slug) keep the first entry.
 */
export function parseBoardList(platform: BoardPlatform, raw: string): CompanyBoard[] {
  const seen = new Set<string>();
  const boards: CompanyBoard[] = [];
  for (const entry of raw.split(",")) {
    const [rawSlug, ...nameParts] = entry.split(":");
    const slug = (rawSlug ?? "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9._-]+$/.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const name = nameParts.join(":").trim() || titleCase(slug);
    boards.push({ platform, slug, name });
  }
  return boards;
}

type EnvLike = Record<string, string | undefined>;

/** Boards for one platform: the env override when set (even to empty), else the defaults. */
export function boardsFor(platform: BoardPlatform, env: EnvLike = process.env): CompanyBoard[] {
  const override = env[ENV_VAR[platform]];
  return parseBoardList(platform, override !== undefined ? override : DEFAULT_BOARDS[platform]);
}

export function allCompanyBoards(env: EnvLike = process.env): CompanyBoard[] {
  return (["greenhouse", "lever", "ashby"] as const).flatMap((p) => boardsFor(p, env));
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
