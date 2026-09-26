import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "./env";
import { db } from "./db";

export const SESSION_COOKIE = "jobfinder_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(userId: string): string {
  const env = getEnv();
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySessionToken(token: string): { userId: string } | null {
  const env = getEnv();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

/**
 * Reads the session cookie in a Server Component / Route Handler and returns
 * the user id, if any. Also confirms the user still exists — a valid-looking
 * cookie can outlive its user (switched databases in dev, an admin deleted
 * the account), and every caller downstream assumes the id is real, so this
 * is the one place to catch it. Callers redirecting to /login on a null
 * return is what "logs out" a stale session — this function itself can't
 * clear the cookie, since it's called from Server Components during render,
 * where Next.js only allows reading cookies, not mutating them (mutation is
 * limited to Server Actions/Route Handlers, e.g. POST /api/auth/logout).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = verifySessionToken(token)?.userId;
  if (!userId) return null;

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  return user ? userId : null;
}

/**
 * For dashboard pages: returns the current user id, or redirects to /login.
 * The dashboard layout already redirects unauthenticated visitors, but
 * Next.js can still invoke a page's own data-fetching concurrently with its
 * layout's, so a page can't assume the layout's redirect already ran by the
 * time it executes — each page needs its own guard, and this is it.
 */
export async function requireDashboardUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  return userId;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
