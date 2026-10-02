/** A titled group of fields on a form, with an address so a link can land on it. */
export function FormSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="card space-y-4 scroll-mt-24">
      <h2 id={`${id}-heading`} className="eyebrow">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A labelled control with an optional line of help beneath it. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
