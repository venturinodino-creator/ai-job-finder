import { db } from "@/lib/db";
import { ACHIEVEMENTS, type AchievementStats } from "@/lib/achievements";
import { Prisma, type ActivityType } from "@/generated/prisma/client";

export const POINTS: Record<ActivityType, number> = {
  PROFILE_CREATED: 10,
  CV_UPLOADED: 10,
  CV_REVIEWED: 5,
  CV_TAILORED: 15,
  JOB_VIEWED: 1,
  JOB_APPLIED: 15,
  DAILY_VISIT: 5,
};

const POINTS_PER_LEVEL = 100;

export function levelForPoints(points: number): number {
  return Math.floor(points / POINTS_PER_LEVEL) + 1;
}

// Registration creates this row up front (see /api/auth/register), so this
// is normally just a read. The create-then-catch fallback exists for users
// created before this feature shipped, and is written to tolerate two
// concurrent callers both finding it missing at once — Next.js renders a
// layout and its page's data fetches concurrently, so two callers hitting
// this for the same brand-new user in the same request is a real case, not
// a hypothetical.
async function ensureProgress(userId: string) {
  const existing = await db.userProgress.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await db.userProgress.create({ data: { userId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return db.userProgress.findUniqueOrThrow({ where: { userId } });
    }
    throw err;
  }
}

/** Logs one point-earning action, updates total points/level, then re-checks achievements. */
export async function recordActivity(
  userId: string,
  type: ActivityType,
  metadata?: Prisma.InputJsonObject,
): Promise<void> {
  const points = POINTS[type];
  await db.activityEvent.create({ data: { userId, type, points, metadata } });

  await ensureProgress(userId);
  const progress = await db.userProgress.update({
    where: { userId },
    data: { points: { increment: points } },
  });
  await db.userProgress.update({
    where: { userId },
    data: { level: levelForPoints(progress.points) },
  });

  await checkAchievements(userId);
}

/**
 * Call once per authenticated page view. No-ops unless this is the user's
 * first visit today, so it's cheap to call from a layout/server component.
 */
export async function touchDailyStreak(userId: string): Promise<void> {
  const progress = await ensureProgress(userId);
  const today = startOfDay(new Date());
  if (progress.lastActiveOn && startOfDay(progress.lastActiveOn).getTime() === today.getTime()) {
    return; // already counted today
  }

  const isConsecutive =
    progress.lastActiveOn && startOfDay(progress.lastActiveOn).getTime() === today.getTime() - ONE_DAY_MS;
  const currentStreak = isConsecutive ? progress.currentStreak + 1 : 1;

  await db.userProgress.update({
    where: { userId },
    data: {
      lastActiveOn: today,
      currentStreak,
      longestStreak: Math.max(progress.longestStreak, currentStreak),
    },
  });

  await recordActivity(userId, "DAILY_VISIT");
}

/** Unlocks any achievement whose criteria are now met and weren't already unlocked. */
export async function checkAchievements(userId: string) {
  const [profileCount, cvCount, topReview, tailoredCount, appliedCount, viewedCount, progress, unlocked] =
    await Promise.all([
      db.searchProfile.count({ where: { userId } }),
      db.cv.count({ where: { userId } }),
      db.cvReview.findFirst({ where: { cv: { userId } }, orderBy: { overallScore: "desc" } }),
      db.tailoredCv.count({ where: { cv: { userId } } }),
      db.matchScore.count({ where: { profile: { userId }, appliedAt: { not: null } } }),
      db.matchScore.count({ where: { profile: { userId }, viewedAt: { not: null } } }),
      ensureProgress(userId),
      db.userAchievement.findMany({ where: { userId }, select: { achievement: { select: { key: true } } } }),
    ]);

  const stats: AchievementStats = {
    profileCount,
    cvCount,
    topCvScore: topReview?.overallScore ?? 0,
    tailoredCount,
    appliedCount,
    viewedCount,
    longestStreak: progress.longestStreak,
  };

  const unlockedKeys = new Set(unlocked.map((u) => u.achievement.key));
  const newlyUnlocked = ACHIEVEMENTS.filter((a) => !unlockedKeys.has(a.key) && a.check(stats));
  if (newlyUnlocked.length === 0) return [];

  for (const achievement of newlyUnlocked) {
    const row = await db.achievement.upsert({
      where: { key: achievement.key },
      create: {
        key: achievement.key,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        points: achievement.points,
        sortOrder: achievement.sortOrder,
      },
      update: {},
    });
    await db.userAchievement.create({ data: { userId, achievementId: row.id } });
    await db.userProgress.update({ where: { userId }, data: { points: { increment: achievement.points } } });
  }

  const updated = await db.userProgress.findUniqueOrThrow({ where: { userId } });
  await db.userProgress.update({ where: { userId }, data: { level: levelForPoints(updated.points) } });

  return newlyUnlocked;
}

export interface GamificationSummary {
  points: number;
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  achievements: {
    key: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    unlocked: boolean;
    unlockedAt: Date | null;
  }[];
}

/** Everything the gamification widgets need, in one call — used by both the API route and dashboard pages. */
export async function getGamificationSummary(userId: string): Promise<GamificationSummary> {
  const [progress, unlocked] = await Promise.all([
    ensureProgress(userId),
    db.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
  ]);

  // The static catalog (src/lib/achievements.ts) is the source of truth for
  // definitions — this doesn't depend on `npm run db:seed` having populated
  // the Achievement table yet, so locked achievements still show up.
  const unlockedByKey = new Map(unlocked.map((u) => [u.achievement.key, u.unlockedAt]));

  return {
    points: progress.points,
    level: levelForPoints(progress.points),
    pointsIntoLevel: progress.points % POINTS_PER_LEVEL,
    pointsForNextLevel: POINTS_PER_LEVEL,
    currentStreak: progress.currentStreak,
    longestStreak: progress.longestStreak,
    achievements: [...ACHIEVEMENTS]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({
        key: a.key,
        name: a.name,
        description: a.description,
        icon: a.icon,
        points: a.points,
        unlocked: unlockedByKey.has(a.key),
        unlockedAt: unlockedByKey.get(a.key) ?? null,
      })),
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
