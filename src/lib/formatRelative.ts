/** "just now", "12 min ago", "3 h ago", "2 d ago" for a past date. */
export function formatRelative(date: Date, now = Date.now()): string {
  const minutes = Math.round((now - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
