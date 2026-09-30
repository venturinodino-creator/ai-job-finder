import { NavPills } from "@/components/NavPills";

const JOBS_VIEWS = [
  { href: "/dashboard/jobs", label: "Matches", exact: true },
  { href: "/dashboard/jobs/companies", label: "Companies" },
  { href: "/dashboard/jobs/archive", label: "Archive" },
];

/** Jobs holds three views with their own addresses and one shared sub-navigation. */
export default function JobsViewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Jobs</p>
        <NavPills items={JOBS_VIEWS} ariaLabel="Jobs views" layoutId="jobs-view-pill" className="max-sm:w-full" />
      </div>
      {children}
    </div>
  );
}
