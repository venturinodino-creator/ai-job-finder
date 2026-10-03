import { afterEach, describe, expect, it, vi } from "vitest";
import { rssHtml, rssItems, rssText } from "../src/agents/sources/rss";
import { parseWeWorkRemotely, splitCompanyTitle, weWorkRemotelyAdapter } from "../src/agents/sources/weworkremotely";
import { jobspressoAdapter, parseJobspresso } from "../src/agents/sources/jobspresso";
import { parseNoDesk, parseRealWorkFromAnywhere, splitRoleAtCompany } from "../src/agents/sources/workFromHomeFeeds";
import { companyFromHnTitle, hackerNewsJobsAdapter, normalizeHnStory } from "../src/agents/sources/hnjobs";
import { normalizeDevItJob } from "../src/agents/sources/devitjobs";
import { companyFromLandingUrl, landingJobsAdapter, normalizeLandingJob } from "../src/agents/sources/landingjobs";
import { fourDayWeekAdapter, normalizeFourDayJob } from "../src/agents/sources/fourdayweek";
import { normalizeWorkableIndexJob, workableJobsAdapter } from "../src/agents/sources/workableJobs";
import { smartRecruitersAdapter, smartRecruitersBody } from "../src/agents/sources/smartrecruiters";
import { workableAdapter } from "../src/agents/sources/workable";
import { parseRecruiteeDate, recruiteeAdapter } from "../src/agents/sources/recruitee";
import { MAX_POSTINGS_PER_BOARD, allCompanyBoards, boardsFor, parseBoardList } from "../src/agents/sources/companyBoards";
import { boardAdapters, companyBoardAdapters, jobSourceAdapters } from "../src/agents/sources";

// The adapters read public feeds we do not control, so these tests feed them
// responses shaped like the real ones (captured from the live endpoints) and
// check what comes out the other side: a clean posting, or nothing at all.

/** A route's body, or `{ status }` to make that URL fail. The longest matching URL prefix wins. */
function respondWith(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const hit = Object.keys(routes)
      .filter((prefix) => url.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];
    if (!hit) return new Response("not found", { status: 404, statusText: "Not Found" });
    const body = routes[hit] as { status?: number } | string;
    if (typeof body === "object" && body !== null && "status" in body && Object.keys(body).length === 1) {
      return new Response("error", { status: body.status });
    }
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("rss reading", () => {
  it("unwraps CDATA, decodes entity-encoded HTML and strips the tags", () => {
    const xml = `<item><title><![CDATA[Acme &amp; Co]]></title><description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description></item>`;
    const [item] = rssItems(xml);
    expect(rssText(item, "title")).toBe("Acme & Co");
    expect(rssText(item, "description")).toBe("Hello world");
  });

  it("decodes entity-encoded HTML that was wrapped in CDATA as well", () => {
    const item = `<item><description><![CDATA[&lt;div&gt;&lt;p&gt;Real &amp;amp; true&lt;/p&gt;&lt;/div&gt;]]></description></item>`;
    expect(rssText(item, "description")).toBe("Real & true");
  });

  it("keeps real markup inside CDATA, including escaped angle brackets in the text", () => {
    const item = `<item><content:encoded><![CDATA[<p>Use a &lt;div&gt; here</p>]]></content:encoded></item>`;
    expect(rssText(item, "content:encoded")).toBe("Use a <div> here");
  });

  it("returns null for missing or empty tags", () => {
    const item = `<item><country></country><title>x</title></item>`;
    expect(rssText(item, "country")).toBeNull();
    expect(rssText(item, "region")).toBeNull();
    expect(rssHtml(item, "country")).toBeNull();
  });

  it("matches tags with attributes, like <guid isPermaLink>", () => {
    expect(rssText(`<item><guid isPermaLink="false">abc</guid></item>`, "guid")).toBe("abc");
  });
});

describe("We Work Remotely", () => {
  const feed = `<rss><channel>
    <item>
      <title>Vercel: Senior Manager, Solutions Architect</title>
      <region>Anywhere in the World</region><country></country>
      <category>DevOps and Sysadmin</category><type>Full-Time</type>
      <description>&lt;p&gt;&lt;strong&gt;Headquarters:&lt;/strong&gt; Remote - Australia&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Lead the team&lt;/li&gt;&lt;/ul&gt;</description>
      <pubDate>Sat, 03 Oct 2026 07:31:20 +0000</pubDate>
      <guid>https://weworkremotely.com/remote-jobs/vercel-senior-manager</guid>
      <link>https://weworkremotely.com/remote-jobs/vercel-senior-manager</link>
    </item>
    <item><title>No link here</title></item>
  </channel></rss>`;

  it("splits Company: Role titles", () => {
    expect(splitCompanyTitle("Vercel: Senior Manager, Solutions Architect")).toEqual({ company: "Vercel", title: "Senior Manager, Solutions Architect" });
    expect(splitCompanyTitle("Just a title")).toEqual({ company: "Unknown company", title: "Just a title" });
  });

  it("turns an item into a remote posting and drops items without a link", () => {
    const postings = parseWeWorkRemotely(feed);
    expect(postings).toHaveLength(1);
    expect(postings[0]).toMatchObject({
      externalId: "https://weworkremotely.com/remote-jobs/vercel-senior-manager",
      title: "Senior Manager, Solutions Architect",
      company: "Vercel",
      location: "Anywhere in the World",
      remoteType: "REMOTE",
      industries: ["DevOps and Sysadmin", "Full-Time"],
      url: "https://weworkremotely.com/remote-jobs/vercel-senior-manager",
    });
    expect(postings[0].description).toBe("Headquarters: Remote - Australia\nLead the team");
    expect(postings[0].postedAt?.toISOString()).toBe("2026-10-03T07:31:20.000Z");
  });

  it("reads every category feed once and tolerates one of them failing", async () => {
    const fetchMock = respondWith({ "https://weworkremotely.com/remote-jobs.rss": feed, "https://weworkremotely.com/categories/remote-programming-jobs.rss": feed });

    const postings = await weWorkRemotelyAdapter.fetch();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
    expect(postings).toHaveLength(1); // the same posting in two feeds is listed once
  });

  it("fails loudly when every feed fails", async () => {
    respondWith({});
    await expect(weWorkRemotelyAdapter.fetch()).rejects.toThrow(/We Work Remotely fetch failed: 404/);
  });
});

describe("Jobspresso", () => {
  const feed = `<rss><channel><item>
    <title>Principal Product Manager, Conversational AI</title>
    <link>https://jobspresso.co/job/principal-product-manager-conversational-ai/</link>
    <dc:creator>Hopper<br>⚲&nbsp;Various US States</dc:creator>
    <pubDate>Sat, 29 Aug 2026 02:12:12 +0000</pubDate>
    <guid isPermaLink="false">https://jobspresso.co/?post_type=job_listing&#038;p=163413</guid>
    <description><p>Short teaser</p></description>
    <content:encoded><![CDATA[<p>HTS Assist is Hopper&#8217;s agentic AI assistant.</p><ul><li>Own the roadmap</li></ul>]]></content:encoded>
  </item></channel></rss>`;

  it("splits company and location out of the creator tag and uses the full body", () => {
    const [posting] = parseJobspresso(feed);
    expect(posting).toMatchObject({ title: "Principal Product Manager, Conversational AI", company: "Hopper", location: "Various US States", remoteType: "REMOTE" });
    expect(posting.description).toBe("HTS Assist is Hopper’s agentic AI assistant.\nOwn the roadmap");
    expect(posting.externalId).toContain("p=163413");
  });

  it("keeps the first page when a later page errors", async () => {
    respondWith({ "https://jobspresso.co/feed/?post_type=job_listing": feed, "https://jobspresso.co/feed/?post_type=job_listing&paged=": { status: 500 } });
    expect(await jobspressoAdapter.fetch()).toHaveLength(1);
  });
});

describe("NoDesk and Real Work From Anywhere", () => {
  it("splits on the last ' at '", () => {
    expect(splitRoleAtCompany("Head of Growth at Scale at Acme")).toEqual({ title: "Head of Growth at Scale", company: "Acme" });
    expect(splitRoleAtCompany("Designer")).toEqual({ title: "Designer", company: null });
  });

  it("reads a NoDesk item", () => {
    const xml = `<channel><item><title>Web Design and Marketing Partners at B12</title><description>
The Role: We build websites.</description><pubDate>Fri, 02 Oct 2026 08:00:00 +0200</pubDate><guid>https://nodesk.co/remote-jobs/b12-web-design/</guid><link>https://nodesk.co/remote-jobs/b12-web-design/</link></item></channel>`;
    const [posting] = parseNoDesk(xml);
    expect(posting).toMatchObject({ title: "Web Design and Marketing Partners", company: "B12", remoteType: "REMOTE", description: "The Role: We build websites." });
    expect(posting.postedAt?.toISOString()).toBe("2026-10-02T06:00:00.000Z");
  });

  it("prefers the author tag for the company on Real Work From Anywhere", () => {
    const xml = `<item><title>Junior Analyst at OMEGA ENTERPRISES LTD</title><description><![CDATA[<p>Join us.</p>]]></description><link>https://www.realworkfromanywhere.com/jobs/junior-analyst-520</link><guid>https://www.realworkfromanywhere.com/jobs/junior-analyst-520</guid><author>OMEGA ENTERPRISES LTD</author></item>`;
    const [posting] = parseRealWorkFromAnywhere(xml);
    expect(posting).toMatchObject({ title: "Junior Analyst", company: "OMEGA ENTERPRISES LTD", description: "Join us." });
  });
});

describe("Hacker News Jobs", () => {
  it("finds the company in 'X (YC S23) Is Hiring …' and 'X is hiring …' titles", () => {
    expect(companyFromHnTitle("Truemetrics (YC S23) Is Hiring a GTM Founder's Associate")).toBe("Truemetrics");
    expect(companyFromHnTitle("Acme is hiring a senior engineer")).toBe("Acme");
    expect(companyFromHnTitle("Senior engineer wanted in Berlin")).toBe("Hacker News");
  });

  it("normalises a job story and skips dead or non-job items", () => {
    const story = { id: 49919680, by: "truemetricsIngo", time: 1790848098, title: "Truemetrics (YC S23) Is Hiring a GTM Founder's Associate", type: "job", url: "https://www.ycombinator.com/companies/truemetrics/jobs/THLEzXI" };
    expect(normalizeHnStory(story)).toMatchObject({ externalId: "49919680", company: "Truemetrics", url: story.url, remoteType: "ANY" });
    expect(normalizeHnStory({ ...story, dead: true })).toBeNull();
    expect(normalizeHnStory({ ...story, type: "story" })).toBeNull();
    expect(normalizeHnStory({ ...story, url: undefined })?.url).toBe("https://news.ycombinator.com/item?id=49919680");
  });

  it("lists the current stories and ignores one that fails to load", async () => {
    respondWith({
      "https://hacker-news.firebaseio.com/v0/jobstories.json": [1, 2],
      "https://hacker-news.firebaseio.com/v0/item/1.json": { id: 1, type: "job", title: "Foo is hiring a designer", url: "https://foo.test/jobs/1", time: 1790848098 },
    });
    const postings = await hackerNewsJobsAdapter.fetch();
    expect(postings.map((p) => p.company)).toEqual(["Foo"]);
  });
});

describe("DevITjobs UK", () => {
  const job = {
    _id: "6abf",
    jobUrl: "Peregrine-Livefoods-WordPress--WooCommerce-Developer",
    name: "WordPress & WooCommerce Developer",
    company: "Peregrine Livefoods",
    workplace: "remote",
    actualCity: "ONGAR",
    activeFrom: "2026-10-03T00:00:00.000+02:00",
    jobType: "Full-Time",
    expLevel: "Regular",
    annualSalaryFrom: 40000,
    annualSalaryTo: 45000,
    techCategory: "PHP",
    technologies: ["CSS", "PHP", "WordPress"],
    hasVisaSponsorship: "No",
  };

  it("builds a posting with GBP salary and a description from the listing facts", () => {
    const posting = normalizeDevItJob(job)!;
    expect(posting).toMatchObject({
      externalId: job.jobUrl,
      company: "Peregrine Livefoods",
      location: "Ongar, UK",
      remoteType: "REMOTE",
      salaryMin: 40000,
      salaryMax: 45000,
      salaryCurrency: "GBP",
      url: `https://devitjobs.uk/jobs/${job.jobUrl}`,
    });
    expect(posting.description).toContain("Tech stack: CSS, PHP, WordPress");
    expect(posting.industries).toEqual(["PHP", "CSS", "WordPress"]);
  });

  it("leaves salary empty when none is given and maps office to on-site", () => {
    const posting = normalizeDevItJob({ ...job, annualSalaryFrom: 0, annualSalaryTo: 0, workplace: "office" })!;
    expect(posting).toMatchObject({ salaryMin: null, salaryMax: null, salaryCurrency: null, remoteType: "ON_SITE" });
  });

  it("skips paused jobs", () => {
    expect(normalizeDevItJob({ ...job, isPaused: true })).toBeNull();
  });
});

describe("Landing.jobs", () => {
  const job = {
    id: 19066,
    title: "Senior Java Software Developer",
    url: "https://landing.jobs/at/inscale-consulting/senior-java-software-developer-in-lisbon-2025",
    remote: false,
    expires_at: "2027-03-02",
    published_at: "2025-02-26T09:38:38.127Z",
    currency_code: "EUR",
    gross_salary_low: 50000,
    gross_salary_high: 67000,
    tags: ["Java", "SQL"],
    locations: [{ city: "Lisbon", country_code: "PT" }],
    role_description: "<div>Our client is a retail chain.</div>",
    main_requirements: "<ul><li>6-8 years of Java.</li></ul>",
    perks: "<ul><li>14 salaries</li></ul>",
  };

  it("reads the company out of the posting url", () => {
    expect(companyFromLandingUrl(job.url)).toBe("Inscale Consulting");
    expect(companyFromLandingUrl("https://landing.jobs/jobs/1")).toBe("Landing.jobs");
  });

  it("normalises salary, location and the joined description", () => {
    const posting = normalizeLandingJob(job, new Date("2026-10-03"))!;
    expect(posting).toMatchObject({ externalId: "19066", location: "Lisbon, PT", salaryMin: 50000, salaryMax: 67000, salaryCurrency: "EUR", industries: ["Java", "SQL"], remoteType: "ANY" });
    expect(posting.description).toBe("Our client is a retail chain.\n\n6-8 years of Java.\n\n14 salaries");
  });

  it("drops a job that has expired", () => {
    expect(normalizeLandingJob({ ...job, expires_at: "2026-01-01" }, new Date("2026-10-03"))).toBeNull();
  });

  it("pages through the API 50 at a time and stops on a short page", async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ ...job, id: from + i }));
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const offset = Number(new URL(String(input)).searchParams.get("offset"));
      return new Response(JSON.stringify(offset === 0 ? page(1, 50) : page(51, 7)), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const postings = await landingJobsAdapter.fetch();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(postings).toHaveLength(57);
  });
});

describe("4 Day Week", () => {
  const job = {
    id: "01a0ff2e",
    title: "Senior Learning and Development Advisor",
    slug: "senior-learning-and-development-advisor-at-behaviour-9bc9f6c6",
    company_name: "Behaviour",
    work_arrangement: "hybrid",
    locations: [{ city: "Montreal", state: "Quebec", country: "Canada", is_primary: true }],
    posted: 1790987613,
    schedule_type: "4_day_week_pro_rata",
    category: "hr",
    level: "senior",
    is_expired: false,
  };

  it("builds the posting url from the slug and describes the shorter week", () => {
    const posting = normalizeFourDayJob(job)!;
    expect(posting).toMatchObject({ company: "Behaviour", location: "Montreal, Quebec, Canada", remoteType: "HYBRID", url: `https://4dayweek.io/job/${job.slug}` });
    expect(posting.description).toContain("4 day week pro rata");
    expect(posting.postedAt?.getTime()).toBe(1790987613 * 1000);
  });

  it("skips expired jobs", () => {
    expect(normalizeFourDayJob({ ...job, is_expired: true })).toBeNull();
  });

  it("follows has_more through the pages", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return new Response(JSON.stringify({ jobs: [{ ...job, id: `job-${page}`, slug: `slug-${page}` }], has_more: page < 3 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const postings = await fourDayWeekAdapter.fetch();

    expect(postings.map((p) => p.externalId).sort()).toEqual(["job-1", "job-2", "job-3"]);
  });
});

describe("Workable Jobs index", () => {
  const job = {
    id: "874918d1",
    title: "Account Manager",
    url: "https://jobs.workable.com/view/hGVK/hybrid-account-manager-in-prague-at-usercentrics",
    department: "Direct Sales",
    description: "<p><strong>Hybrid</strong> account manager</p>",
    requirementsSection: "<ul><li>Monitor accounts</li></ul>",
    employmentType: "Full-time",
    workplace: "hybrid",
    created: "2026-10-01T12:55:11.776Z",
    location: { city: "Prague", subregion: "Prague", countryName: "Czechia" },
    company: { title: "Usercentrics" },
  };

  it("normalises company, location (without repeating the city) and body", () => {
    const posting = normalizeWorkableIndexJob(job)!;
    expect(posting).toMatchObject({ company: "Usercentrics", location: "Prague, Czechia", remoteType: "HYBRID", industries: ["Direct Sales", "Full-time"] });
    expect(posting.description).toBe("Hybrid account manager\n\nMonitor accounts");
  });

  it("walks the page tokens until they run out", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const token = new URL(String(input)).searchParams.get("pageToken");
      const body = token === null ? { jobs: [{ ...job, id: "a" }], nextPageToken: "t1" } : token === "t1" ? { jobs: [{ ...job, id: "b" }] } : { jobs: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const postings = await workableJobsAdapter.fetch();

    expect(postings.map((p) => p.externalId)).toEqual(["a", "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("company board platforms", () => {
  const board = (platform: "smartrecruiters" | "workable" | "recruitee", slug: string, name: string) => ({ platform, slug, name });

  describe("SmartRecruiters", () => {
    const list = {
      content: [
        { id: "1", name: "Older role", releasedDate: "2026-09-01T00:00:00Z", location: { fullLocation: "Sydney, , Australia", hybrid: true } },
        { id: "2", name: "Newest role", releasedDate: "2026-10-02T00:00:00Z", location: { fullLocation: "Remote", remote: true }, department: { label: "Sales" } },
      ],
    };
    const detail = (id: string) => ({
      postingUrl: `https://jobs.smartrecruiters.com/Canva/${id}-role`,
      jobAd: { sections: { companyDescription: { title: "Company", text: "<p>We design.</p>" }, jobDescription: { title: "Job", text: "<p>Do things.</p>" } } },
    });

    it("joins the ad sections in reading order", () => {
      expect(smartRecruitersBody(detail("1"))).toBe("Company\nWe design.\n\nJob\nDo things.");
      expect(smartRecruitersBody(null)).toBe("");
    });

    it("lists newest first, fetches each body and tidies the location", async () => {
      respondWith({
        "https://api.smartrecruiters.com/v1/companies/canva/postings/1": detail("1"),
        "https://api.smartrecruiters.com/v1/companies/canva/postings/2": detail("2"),
        "https://api.smartrecruiters.com/v1/companies/canva/postings?": list,
      });

      const postings = await smartRecruitersAdapter(board("smartrecruiters", "canva", "Canva")).fetch();

      expect(postings.map((p) => p.title)).toEqual(["Newest role", "Older role"]);
      expect(postings[0]).toMatchObject({ company: "Canva", remoteType: "REMOTE", industries: ["Sales"], url: "https://jobs.smartrecruiters.com/Canva/2-role" });
      expect(postings[1]).toMatchObject({ location: "Sydney, Australia", remoteType: "HYBRID" });
      expect(postings[1].description).toContain("Do things.");
    });

    it("still lists a posting whose detail call fails, by its title", async () => {
      respondWith({ "https://api.smartrecruiters.com/v1/companies/canva/postings?": list });

      const postings = await smartRecruitersAdapter(board("smartrecruiters", "canva", "Canva")).fetch();

      expect(postings).toHaveLength(2);
      expect(postings[0].description).toBe("Newest role");
      expect(postings[0].url).toBe("https://jobs.smartrecruiters.com/canva/2");
    });

    it("keeps only the newest postings of a large board", async () => {
      const many = { content: Array.from({ length: MAX_POSTINGS_PER_BOARD + 25 }, (_, i) => ({ id: String(i), name: `Role ${i}`, releasedDate: new Date(2026, 0, 1 + i).toISOString() })) };
      respondWith({ "https://api.smartrecruiters.com/v1/companies/big/postings?": many });

      const postings = await smartRecruitersAdapter(board("smartrecruiters", "big", "Big")).fetch();

      expect(postings).toHaveLength(MAX_POSTINGS_PER_BOARD);
      expect(postings[0].title).toBe(`Role ${MAX_POSTINGS_PER_BOARD + 24}`);
    });
  });

  describe("Workable account boards", () => {
    it("lists a job once even when it is open in several locations", async () => {
      const job = { shortcode: "0DA49B0B28", title: "Android Engineer", url: "https://apply.workable.com/j/0DA49B0B28", department: "Technology", city: "Manchester", country: "United Kingdom", published_on: "2026-07-08", description: "<p>Build the app.</p>" };
      respondWith({ "https://apply.workable.com/api/v1/widget/accounts/starling-bank": { name: "Starling", jobs: [job, { ...job, city: "London" }, { ...job, shortcode: "ZZ", telecommuting: true, title: "Remote role" }] } });

      const postings = await workableAdapter(board("workable", "starling-bank", "Starling Bank")).fetch();

      expect(postings.map((p) => p.externalId).sort()).toEqual(["0DA49B0B28", "ZZ"]);
      expect(postings.find((p) => p.externalId === "ZZ")?.remoteType).toBe("REMOTE");
      expect(postings.find((p) => p.externalId === "0DA49B0B28")).toMatchObject({ company: "Starling Bank", location: "Manchester, United Kingdom", description: "Build the app." });
    });
  });

  describe("Recruitee", () => {
    it("reads Recruitee's timestamp format", () => {
      expect(parseRecruiteeDate("2026-10-02 13:38:06 UTC")?.toISOString()).toBe("2026-10-02T13:38:06.000Z");
      expect(parseRecruiteeDate(undefined)).toBeNull();
    });

    it("maps remote/hybrid flags and yearly salary", async () => {
      respondWith({
        "https://bunq.recruitee.com/api/offers/": {
          offers: [
            { id: 1, title: "Cards Experience Guide", careers_url: "https://careers.bunq.com/o/cards-experience-guide", location: "Amsterdam, Netherlands", department: "Support", description: "<p>Help users.</p>", requirements: "<ul><li>Empathy</li></ul>", hybrid: true, published_at: "2026-10-02 13:38:06 UTC", salary: { min: 40000, max: 50000, period: "year", currency: "EUR" } },
            { id: 2, title: "Remote role", remote: true, published_at: "2026-10-01 09:00:00 UTC", salary: { min: 20, max: 30, period: "hour", currency: "EUR" } },
          ],
        },
      });

      const postings = await recruiteeAdapter(board("recruitee", "bunq", "bunq")).fetch();

      expect(postings[0]).toMatchObject({ externalId: "1", remoteType: "HYBRID", salaryMin: 40000, salaryMax: 50000, salaryCurrency: "EUR", url: "https://careers.bunq.com/o/cards-experience-guide" });
      expect(postings[0].description).toBe("Help users.\n\nEmpathy");
      expect(postings[1]).toMatchObject({ remoteType: "REMOTE", salaryMin: null, salaryCurrency: null });
      expect(postings[1].url).toBe("https://bunq.recruitee.com/o/2");
    });

    it("reports a board that does not exist by name and status", async () => {
      respondWith({});
      await expect(recruiteeAdapter(board("recruitee", "nope", "Nope")).fetch()).rejects.toThrow(/Recruitee \(nope\) fetch failed: 404/);
    });
  });
});

describe("configured sources", () => {
  it("covers all six board platforms with unique source keys across everything we ingest", () => {
    const boards = allCompanyBoards({});
    expect(new Set(boards.map((b) => b.platform))).toEqual(new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"]));
    const keys = jobSourceAdapters.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("builds an adapter for every configured board, keyed platform:slug", () => {
    const boards = allCompanyBoards({});
    expect(companyBoardAdapters(boards).map((a) => a.key)).toEqual(boards.map((b) => `${b.platform}:${b.slug}`));
  });

  it("lets each new platform be overridden or switched off by its own env var", () => {
    expect(boardsFor("smartrecruiters", { SMARTRECRUITERS_BOARDS: "canva" })).toEqual([{ platform: "smartrecruiters", slug: "canva", name: "Canva" }]);
    expect(boardsFor("workable", { WORKABLE_BOARDS: "" })).toEqual([]);
    expect(boardsFor("recruitee", { RECRUITEE_BOARDS: "bunq:bunq" })).toEqual([{ platform: "recruitee", slug: "bunq", name: "bunq" }]);
  });

  it("accepts every default slug (none is silently dropped as malformed)", () => {
    for (const platform of ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"] as const) {
      const defaults = boardsFor(platform, {});
      expect(defaults.length).toBeGreaterThan(0);
      expect(parseBoardList(platform, defaults.map((b) => `${b.slug}:${b.name}`).join(","))).toEqual(defaults);
    }
  });

  it("includes the aggregator feeds as ingestible sources of the right kind", () => {
    const byKey = Object.fromEntries(boardAdapters.map((a) => [a.key, a]));
    for (const key of ["weworkremotely", "jobspresso", "nodesk", "realworkfromanywhere", "hackernews-jobs", "devitjobs", "landingjobs", "4dayweek", "workable-jobs"]) {
      expect(byKey[key], key).toBeDefined();
    }
    expect(byKey.weworkremotely.kind).toBe("RSS");
    expect(byKey.devitjobs.kind).toBe("PUBLIC_API");
  });
});
