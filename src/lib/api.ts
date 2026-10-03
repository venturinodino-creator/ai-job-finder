import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUserId } from "./auth";
import type { Refusal } from "./entitlements";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Extra fields for the JSON body, beside `error`. */
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** The response for an action the user's plan does not allow right now: 429, the words to show, and the numbers behind them. */
export function allowanceError(refusal: Refusal, lead = ""): ApiError {
  const { action, used, limit, resetsAt, upgradeHref } = refusal;
  return new ApiError(429, `${lead}${refusal.message}`, { refusal: { action, used, limit, resetsAt: resetsAt.toISOString(), upgradeHref } });
}

/** Returns the current user's id or throws a 401 ApiError. Use inside a try/catch wrapped by `handle`. */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new ApiError(401, "Not authenticated");
  return userId;
}

/** Wraps a route handler body, turning ApiError (and zod/unexpected errors) into consistent JSON responses. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, ...err.details }, { status: err.status });
    }
    // Input that failed schema validation is the caller's problem, not ours:
    // a 400 with one line per field, not a 500 with a stack of Zod internals.
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message }));
      return NextResponse.json(
        { error: `Invalid input: ${issues.map((i) => `${i.field} — ${i.message}`).join("; ")}`, issues },
        { status: 400 },
      );
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
