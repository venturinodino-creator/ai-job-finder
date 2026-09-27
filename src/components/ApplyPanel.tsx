"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ApplicationView {
  id: string;
  status: "DRAFT" | "SENT" | "APPLIED";
  method: "EMAIL" | "MANUAL" | null;
  subject: string;
  coverNote: string;
  sentTo: string | null;
  sentAt: string | null;
  tailoredCv: { id: string } | null;
  cv: { id: string; fileName: string } | null;
}

export function ApplyPanel({
  jobId,
  jobUrl,
  applyEmail,
  hasActiveCv,
  hasTailoredCv,
  emailEnabled,
  initial,
}: {
  jobId: string;
  jobUrl: string;
  applyEmail: string | null;
  hasActiveCv: boolean;
  hasTailoredCv: boolean;
  emailEnabled: boolean;
  initial: ApplicationView | null;
}) {
  const router = useRouter();
  const [app, setApp] = useState<ApplicationView | null>(initial);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [note, setNote] = useState(initial?.coverNote ?? "");
  const [busy, setBusy] = useState<null | "prepare" | "email" | "manual">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(path: string, init: RequestInit) {
    const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function prepare() {
    setBusy("prepare");
    setError(null);
    try {
      const data = await call(`/api/jobs/${jobId}/application`, { method: "POST" });
      setApp(data.application);
      setSubject(data.application.subject);
      setNote(data.application.coverNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the application.");
    } finally {
      setBusy(null);
    }
  }

  async function submit(method: "EMAIL" | "MANUAL") {
    setBusy(method === "EMAIL" ? "email" : "manual");
    setError(null);
    try {
      await call(`/api/jobs/${jobId}/application`, { method: "PATCH", body: JSON.stringify({ subject, coverNote: note }) });
      if (method === "MANUAL") window.open(jobUrl, "_blank", "noopener,noreferrer");
      const data = await call(`/api/jobs/${jobId}/application/send`, { method: "POST", body: JSON.stringify({ method }) });
      setApp(data.application);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the application.");
    } finally {
      setBusy(null);
    }
  }

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${note}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the text and copy it manually.");
    }
  }

  const muted = { color: "var(--color-text-muted)" } as const;

  if (!hasActiveCv) {
    return (
      <p className="text-sm" style={muted}>
        Upload a CV and set it active on your search profile to apply from here.
      </p>
    );
  }

  if (app && app.status !== "DRAFT") {
    const when = app.sentAt ? new Date(app.sentAt).toLocaleDateString() : "";
    return (
      <div className="card space-y-3">
        <p className="text-sm font-medium">
          {app.status === "SENT" ? `Application sent to ${app.sentTo} on ${when}` : `Marked as applied on ${when} — via the company site`}
        </p>
        <p className="text-xs" style={muted}>
          Attached: {app.tailoredCv ? "your tailored CV for this role (.docx)" : app.cv ? `your CV (${app.cv.fileName})` : "no CV"}.
        </p>
        <details>
          <summary className="cursor-pointer text-sm underline">Cover note</summary>
          <p className="text-sm whitespace-pre-wrap mt-2">{app.coverNote}</p>
        </details>
        <button type="button" className="btn-secondary" onClick={copyNote}>
          {copied ? "Copied" : "Copy cover note"}
        </button>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-2">
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={prepare}>
          {busy === "prepare" ? "Drafting your application (calls the LLM, ~10s)..." : "Prepare my application"}
        </button>
        <p className="text-xs" style={muted}>
          Attaches {hasTailoredCv ? "your tailored CV for this role" : "your CV (tailor it first for a closer fit)"} and drafts a short cover
          note from it — nothing invented. You review everything before anything is sent.
        </p>
        {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      </div>
    );
  }

  const canEmail = Boolean(applyEmail) && emailEnabled;
  return (
    <div className="card space-y-3">
      <p className="text-xs" style={muted}>
        Attaching: {app.tailoredCv ? "your tailored CV for this role (.docx)" : app.cv ? `your CV (${app.cv.fileName})` : "no CV"}
      </p>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Subject</span>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Cover note</span>
        <textarea className="input min-h-44" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {canEmail ? (
          <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => submit("EMAIL")}>
            {busy === "email" ? "Sending..." : `Send by email to ${applyEmail}`}
          </button>
        ) : (
          <span className="text-xs" style={muted}>
            {applyEmail ? "Email sending isn't configured on this server yet." : "This posting has no application email — apply on the company site."}
          </span>
        )}
        <button type="button" className={canEmail ? "btn-secondary" : "btn-primary"} disabled={busy !== null} onClick={() => submit("MANUAL")}>
          {busy === "manual" ? "Recording..." : "Apply on the company site"}
        </button>
        <button type="button" className="btn-secondary" onClick={copyNote}>
          {copied ? "Copied" : "Copy cover note"}
        </button>
        <button type="button" className="text-xs underline" disabled={busy !== null} onClick={prepare} style={muted}>
          Redraft
        </button>
      </div>
      <p className="text-xs" style={muted}>
        &quot;Apply on the company site&quot; opens their page in a new tab with your CV downloadable above and this note ready to paste,
        and records the application here.
      </p>
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
