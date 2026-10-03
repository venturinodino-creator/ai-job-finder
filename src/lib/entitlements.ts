import { db } from "@/lib/db";
import type { CostlyAction } from "@/generated/prisma/client";

// What a plan lets a user do. The costly things (a scoring run, a CV review, a
// CV tailoring) each have an allowance per plan: a number of uses in a window.
// Every feature that spends AI money asks this module first and records the
// use in the same step, so no feature carries its own limit and two
// simultaneous requests cannot both take the last unit.
//
// Only the Free plan exists so far; Pro arrives with subscriptions, and
// `planFor` is the one place that will learn about it.

export type { CostlyAction };
export type PlanName = "FREE";

/** The span a count covers: the last N days, or the calendar month in UTC. */
export type AllowanceWindow = { kind: "rolling"; days: number } | { kind: "month" };

export interface Allowance {
  limit: number;
  window: AllowanceWindow;
}

/** Where an Upgrade button leads until checkout exists. */
export const UPGRADE_HREF = "/#pricing";

/** The numbers. Change them here; nothing else in the app carries a limit. */
export const PLAN_ALLOWANCES: Record<PlanName, Record<CostlyAction, Allowance>> = {
  FREE: {
    SCORING_RUN: { limit: 1, window: { kind: "rolling", days: 7 } },
    CV_REVIEW: { limit: 1, window: { kind: "month" } },
    CV_TAILORING: { limit: 1, window: { kind: "month" } },
  },
};

const ACTION_WORDS: Record<CostlyAction, { noun: string; plural: string; pro: string }> = {
  SCORING_RUN: { noun: "scoring run", plural: "scoring runs", pro: "daily scoring" },
  CV_REVIEW: { noun: "CV review", plural: "CV reviews", pro: "more reviews" },
  CV_TAILORING: { noun: "CV tailoring", plural: "CV tailorings", pro: "more tailorings" },
};

const DAY_MS = 86_400_000;

/** The plan whose allowances apply to the user right now. */
export async function planFor(userId: string): Promise<PlanName> {
  void userId; // every user is on Free until subscriptions exist
  return "FREE";
}

export interface Refusal {
  allowed: false;
  action: CostlyAction;
  used: number;
  limit: number;
  /** When a unit is next available. */
  resetsAt: Date;
  /** Plain words for the user: what they used, when it opens, what upgrading gives. */
  message: string;
  upgradeHref: string;
}

export type Outcome = { allowed: true; usageId: string } | Refusal;
export type Peek = { allowed: true } | Refusal;

/** Thrown by callers that cannot continue without the allowance, carrying the refusal for the response. */
export class AllowanceExceededError extends Error {
  constructor(public refusal: Refusal) {
    super(refusal.message);
  }
}

type UsageDb = Pick<typeof db, "usageRecord">;

interface Status {
  plan: PlanName;
  allowance: Allowance;
  used: number;
  /** When the next unit frees up; null while the allowance is untouched. */
  resetsAt: Date | null;
}

function windowStart(window: AllowanceWindow, now: Date): Date {
  return window.kind === "rolling"
    ? new Date(now.getTime() - window.days * DAY_MS)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function nextMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function statusOf(client: UsageDb, userId: string, action: CostlyAction, now: Date): Promise<Status> {
  const plan = await planFor(userId);
  const allowance = PLAN_ALLOWANCES[plan][action];
  // Rolling: a use stops counting exactly `days` after it was made, hence `gt`.
  const records = await client.usageRecord.findMany({
    where: { userId, action, createdAt: { gt: windowStart(allowance.window, now), lte: now } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const used = records.length;
  let resetsAt: Date | null = null;
  if (used > 0) {
    if (allowance.window.kind === "month") resetsAt = nextMonth(now);
    else {
      // The unit that, once it ages out, brings the count back under the limit.
      const blocking = records[Math.max(0, used - allowance.limit)];
      resetsAt = new Date(blocking.createdAt.getTime() + allowance.window.days * DAY_MS);
    }
  }
  return { plan, allowance, used, resetsAt };
}

function formatWhen(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date);
  return `${parts.replace(",", "")} UTC`;
}

function periodWords(window: AllowanceWindow): string {
  if (window.kind === "month") return "this month";
  return window.days === 7 ? "this week" : `the last ${window.days} days`;
}

function refusalFor(action: CostlyAction, status: Status): Refusal {
  const words = ACTION_WORDS[action];
  const { limit } = status.allowance;
  const resetsAt = status.resetsAt ?? new Date();
  return {
    allowed: false,
    action,
    used: status.used,
    limit,
    resetsAt,
    upgradeHref: UPGRADE_HREF,
    message:
      `You've used your ${limit} ${limit === 1 ? words.noun : words.plural} for ${periodWords(status.allowance.window)}. ` +
      `The next one opens ${formatWhen(resetsAt)}. Upgrade to Pro for ${words.pro}.`,
  };
}

/** Whether the user may do the action now, without spending anything. */
export async function check(userId: string, action: CostlyAction, now = new Date()): Promise<Peek> {
  const status = await statusOf(db, userId, action, now);
  return status.used < status.allowance.limit ? { allowed: true } : refusalFor(action, status);
}

/**
 * Checks the allowance and spends one unit of it, in one step. Concurrent
 * calls for the same user queue behind a lock, so only as many as the
 * allowance holds are let through. Keep the returned `usageId` to give the
 * unit back with `release` if the action then fails.
 */
export async function consume(userId: string, action: CostlyAction, now = new Date()): Promise<Outcome> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`;
    const status = await statusOf(tx, userId, action, now);
    if (status.used >= status.allowance.limit) return refusalFor(action, status);
    const row = await tx.usageRecord.create({ data: { userId, action, createdAt: now }, select: { id: true } });
    return { allowed: true as const, usageId: row.id };
  });
}

/** Gives back a unit spent by an action that then failed. Harmless if it is already gone. */
export async function release(usageId: string): Promise<void> {
  await db.usageRecord.deleteMany({ where: { id: usageId } });
}

export interface AllowanceStatus {
  plan: PlanName;
  action: CostlyAction;
  used: number;
  limit: number;
  /** "this week" or "this month". */
  period: string;
  /** When the next unit frees up; null while nothing has been used. */
  resetsAt: Date | null;
}

/** Every allowance the user has, with what they have used. For the usage meters. */
export async function usageSummary(userId: string, now = new Date()): Promise<AllowanceStatus[]> {
  const actions = Object.keys(ACTION_WORDS) as CostlyAction[];
  return Promise.all(
    actions.map(async (action) => {
      const status = await statusOf(db, userId, action, now);
      return {
        plan: status.plan,
        action,
        used: status.used,
        limit: status.allowance.limit,
        period: periodWords(status.allowance.window),
        resetsAt: status.resetsAt,
      };
    }),
  );
}

export { ACTION_WORDS };
export { formatWhen as formatAllowanceTime };
