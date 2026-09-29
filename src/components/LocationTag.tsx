/** Marks a role the scorer docked for being outside the profile's locations (on-site/hybrid profiles only). */
export function LocationTag() {
  return (
    <span
      className="font-data text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5"
      style={{ background: "var(--color-gamify-soft)", color: "var(--color-gamify)" }}
      title="This posting is outside the locations on your search profile, so its score includes a location penalty."
    >
      Outside your locations
    </span>
  );
}
