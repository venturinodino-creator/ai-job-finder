import Link from "next/link";

/** The Upgrade button shown wherever a plan limit stops the user. Leads to checkout once it exists. */
export function UpgradeLink({ href, onHero = false }: { href: string; onHero?: boolean }) {
  return (
    <Link href={href} className={onHero ? "hero-link" : "btn-primary text-sm"}>
      Upgrade to Pro
    </Link>
  );
}
