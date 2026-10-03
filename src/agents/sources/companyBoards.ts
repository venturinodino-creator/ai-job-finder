/**
 * Which company career pages we pull directly. Greenhouse, Lever and Ashby
 * each expose a public, key-free JSON feed per company, so one adapter
 * instance per configured board gives the job feed (and the company search)
 * a company's *entire* careers page instead of whatever they cross-post to
 * the aggregators.
 *
 * SmartRecruiters, Workable and Recruitee publish the same kind of key-free
 * feed, so they are read the same way.
 *
 * Override the defaults with GREENHOUSE_BOARDS / LEVER_BOARDS / ASHBY_BOARDS /
 * SMARTRECRUITERS_BOARDS / WORKABLE_BOARDS / RECRUITEE_BOARDS, comma-separated
 * `slug` or `slug:Display Name` entries. The slug is the one in the company's
 * board URL, e.g. boards.greenhouse.io/<slug>, jobs.lever.co/<slug>,
 * jobs.ashbyhq.com/<slug>, jobs.smartrecruiters.com/<slug>,
 * apply.workable.com/<slug>, <slug>.recruitee.com.
 */

export type BoardPlatform = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee";

export interface CompanyBoard {
  platform: BoardPlatform;
  slug: string;
  name: string;
}

/**
 * Newest-first cap per board so a 900-role employer doesn't swamp the daily
 * ingest. Every stored posting carries an embedding (~12 KB), so with a couple
 * of hundred boards this is also what keeps the database growth bounded.
 */
export const MAX_POSTINGS_PER_BOARD = 40;

const DEFAULT_BOARDS: Record<BoardPlatform, string> = {
  greenhouse:
    "anthropic:Anthropic,xai:xAI,scaleai:Scale AI,databricks:Databricks,cloudflare:Cloudflare," +
    "datadog:Datadog,gitlab:GitLab,adyen:Adyen,elastic:Elastic,stripe:Stripe,figma:Figma,twilio:Twilio," +
    "samsara:Samsara,coinbase:Coinbase," +
    // Added with the source expansion: boards verified live (open jobs, and the
    // company name the board reports matches the slug) on 2026-10-03.
    "hellofresh:HelloFresh,mongodb:MongoDB,okta:Okta,braze:Braze,sumup:SumUp,toast:Toast,brex:Brex," +
    "roblox:Roblox,block:Block,celonis:Celonis,wolt:Wolt,tripactions:Navan,lyft:Lyft,affirm:Affirm," +
    "deliveroo:Deliveroo,fivetran:Fivetran,pinterest:Pinterest,scopely:Scopely,riotgames:Riot Games," +
    "robinhood:Robinhood,airbnb:Airbnb,reddit:Reddit,epicgames:Epic Games,klaviyo:Klaviyo," +
    "instacart:Instacart,ripple:Ripple,grafanalabs:Grafana Labs,intercom:Intercom,tripadvisor:Tripadvisor," +
    "asana:Asana,gusto:Gusto,vercel:Vercel,faire:Faire,carta:Carta,monzo:Monzo,sigmacomputing:Sigma Computing," +
    "chime:Chime,mixpanel:Mixpanel,proton:Proton,mercury:Mercury,getyourguide:GetYourGuide,tanium:Tanium," +
    "pagerduty:PagerDuty,n26:N26,discord:Discord,newrelic:New Relic,catawiki:Catawiki,billcom:Bill.com," +
    "dropbox:Dropbox,bitgo:BitGo,algolia:Algolia,commercetools:Commercetools,stockx:StockX,raisin:Raisin," +
    "freenow:Free Now,bitwarden:Bitwarden,gemini:Gemini,squarespace:Squarespace,attentive:Attentive," +
    "fireblocks:Fireblocks,turing:Turing,customerio:Customer.io,mirakl:Mirakl,gocardless:GoCardless," +
    "webflow:Webflow,zuora:Zuora,bitpanda:Bitpanda,dataiku:Dataiku,contentful:Contentful," +
    "cockroachlabs:Cockroach Labs,dashlane:Dashlane,typeform:Typeform,lastpass:LastPass,lattice:Lattice," +
    "planetscale:PlanetScale,calendly:Calendly,orcasecurity:Orca Security,form3:Form3,consensys:Consensys," +
    "stabilityai:Stability AI,airtable:Airtable,offerzen:OfferZen,luno:Luno,entersekt:Entersekt",
  lever:
    "palantir:Palantir,spotify:Spotify,binance:Binance,nium:Nium," +
    "mendix:Mendix,coupa:Coupa,toptal:Toptal,moonpay:MoonPay,outreach:Outreach,anchorage:Anchorage," +
    "jamcity:Jam City,pipedrive:Pipedrive,immutable:Immutable",
  ashby:
    "openai:OpenAI,cohere:Cohere,perplexity:Perplexity,elevenlabs:ElevenLabs,notion:Notion," +
    "supabase:Supabase,replit:Replit,ramp:Ramp,linear:Linear," +
    "snowflake:Snowflake,harvey:Harvey,sierra:Sierra,decagon:Decagon,nord-security:Nord Security,plaid:Plaid," +
    "xero:Xero,mercor:Mercor,langchain:LangChain,1password:1Password,temporal:Temporal,ashby:Ashby," +
    "synthesia:Synthesia,mollie:Mollie,thought-machine:Thought Machine,sentry:Sentry,circle:Circle.so," +
    "amplitude:Amplitude,hex:Hex,backmarket:Back Market,supercell:Supercell,pleo:Pleo,poshmark:Poshmark," +
    "trainline:Trainline,miro:Miro,trustly:Trustly,paddle:Paddle,surfshark:Surfshark,anyscale:Anyscale," +
    "dapper:Dapper,alchemy:Alchemy,hopper:Hopper,confluent:Confluent,andela:Andela,iterable:Iterable," +
    "snyk:Snyk,airbyte:Airbyte,zapier:Zapier,prosus:Prosus,llamaindex:LlamaIndex,prefect:Prefect," +
    "ledger:Ledger,uniswap:Uniswap,sisense:Sisense,kiwi-com:Kiwi.com,pinecone:Pinecone,runway:Runway (planning)," +
    "expensify:Expensify,sorare:Sorare,weaviate:Weaviate,opensea:OpenSea",
  smartrecruiters:
    "deliveryhero:Delivery Hero,coolblue:Coolblue,wise:Wise,canva:Canva,freshworks:Freshworks," +
    "picnic:Picnic,omio:Omio",
  workable: "starling-bank:Starling Bank,huggingface:Hugging Face",
  recruitee: "bunq:bunq",
};

const ENV_VAR: Record<BoardPlatform, string> = {
  greenhouse: "GREENHOUSE_BOARDS",
  lever: "LEVER_BOARDS",
  ashby: "ASHBY_BOARDS",
  smartrecruiters: "SMARTRECRUITERS_BOARDS",
  workable: "WORKABLE_BOARDS",
  recruitee: "RECRUITEE_BOARDS",
};

const PLATFORMS: BoardPlatform[] = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"];

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
  return PLATFORMS.flatMap((p) => boardsFor(p, env));
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
