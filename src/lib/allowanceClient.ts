// Client-side half of the allowance refusal: the 429 an action returns when the
// user's plan has no unit left. Kept free of server imports so components can use it.

/** The user's plan has no unit of this action left. `message` says what was used and when the next opens. */
export class AllowanceRefusedError extends Error {
  constructor(
    message: string,
    public upgradeHref: string,
  ) {
    super(message);
  }
}

/** The error to throw for a failed API response body: a refusal when it carries one, otherwise a plain error. */
export function errorFromResponse(data: { error?: string; refusal?: { upgradeHref?: string } } | null | undefined, fallback: string): Error {
  const message = data?.error || fallback;
  return data?.refusal ? new AllowanceRefusedError(message, data.refusal.upgradeHref ?? "/") : new Error(message);
}
