import { Resend } from "resend";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { runMatchForProfile } from "./match";

const MAIN_ENTRIES_PER_DIGEST = 10;
const WILDCARD_ENTRIES_PER_DIGEST = 3;

/** Re-scores every active profile for `userId`, then compiles + sends today's digest. */
export async function runDigestForUser(userId: string) {
  const profiles = await db.searchProfile.findMany({ where: { userId, isActive: true } });
  if (profiles.length === 0) return null;

  for (const profile of profiles) {
    await runMatchForProfile(profile.id);
  }

  const today = startOfToday();
  const digest = await db.dailyDigest.upsert({
    where: { userId_digestDate: { userId, digestDate: today } },
    create: { userId, digestDate: today },
    update: {},
  });

  // Rebuild entries from scratch so re-running today's digest reflects the latest scores.
  await db.dailyDigestEntry.deleteMany({ where: { digestId: digest.id } });

  let rank = 0;
  for (const profile of profiles) {
    const matches = await db.matchScore.findMany({
      where: { profileId: profile.id },
      orderBy: { score: "desc" },
      include: { jobPosting: true },
    });
    type Match = (typeof matches)[number];

    const main = matches.filter((m: Match) => !m.isWildcard).slice(0, MAIN_ENTRIES_PER_DIGEST);
    const wildcards = matches.filter((m: Match) => m.isWildcard).slice(0, WILDCARD_ENTRIES_PER_DIGEST);

    for (const match of [...main, ...wildcards]) {
      await db.dailyDigestEntry.create({
        data: { digestId: digest.id, profileId: profile.id, matchScoreId: match.id, rank: rank++ },
      });
    }
  }

  const entries = await db.dailyDigestEntry.findMany({
    where: { digestId: digest.id },
    orderBy: { rank: "asc" },
    include: { matchScore: { include: { jobPosting: true } } },
  });

  if (entries.length > 0) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    await sendDigestEmail(user.email, entries);
  }

  return db.dailyDigest.update({ where: { id: digest.id }, data: { sentAt: new Date() } });
}

/** Runs the daily digest for every user with at least one active search profile. */
export async function runDigestAll() {
  const users = await db.user.findMany({
    where: { profiles: { some: { isActive: true } } },
    select: { id: true },
  });
  const results = [];
  for (const user of users) {
    results.push(await runDigestForUser(user.id));
  }
  return results;
}

type DigestEntryWithJob = Awaited<ReturnType<typeof db.dailyDigestEntry.findMany>>[number] & {
  matchScore: { score: number; explanation: string; isWildcard: boolean; wildcardReason: string | null; jobPosting: { title: string; company: string; url: string } };
};

async function sendDigestEmail(to: string, entries: DigestEntryWithJob[]) {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    console.log(`[digest] RESEND_API_KEY not set — skipping email to ${to} (${entries.length} entries generated in-app).`);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const rows = entries
    .map((e) => {
      const j = e.matchScore.jobPosting;
      const badge = e.matchScore.isWildcard ? " 🎲 wildcard" : "";
      return `<li><strong>${j.title}</strong> at ${j.company} — ${e.matchScore.score}%${badge}<br/><small>${e.matchScore.explanation}</small><br/><a href="${j.url}">View posting</a></li>`;
    })
    .join("");

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `Your AI Job Finder digest — ${entries.length} new matches`,
    html: `<h2>Today's matches</h2><ul>${rows}</ul><p><a href="${env.APP_BASE_URL}/dashboard/jobs">View all in the app</a></p>`,
  });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
