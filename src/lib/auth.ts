import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getEnv } from "./env";

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

/** Reads the session cookie in a Server Component / Route Handler and returns the user id, if any. */
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token)?.userId ?? null;
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
