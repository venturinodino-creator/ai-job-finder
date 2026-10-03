/** The hour (0–23) it is right now in the given IANA timezone; falls back to UTC for an unknown zone. */
function hourIn(timezone: string | null | undefined, now: Date): number {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone || "UTC" }).format(now);
    return Number(hour) % 24;
  } catch {
    return now.getUTCHours();
  }
}

/** "Good morning, Dino": the time of day in the user's own timezone and their first name when we have one. */
export function greetingFor(name: string | null | undefined, timezone: string | null | undefined, now = new Date()): string {
  const hour = hourIn(timezone, now);
  const part = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}
