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
  attachedFileName: string | null;
}

/** How and when the posting was applied to; the method is null when it was only marked on the match row. */
export interface AppliedView {
  method: "EMAIL" | "MANUAL" | null;
  at: string;
}

type Busy = null | "prepare" | "email" | "manual" | "already" | "undo";

/**
 * The one place a posting is marked applied or un-applied. Three ways in:
 * send the drafted application by email, apply on the company's site, or
 * say "I already applied" without drafting anything. The two paths that
 * did not send an email can be undone.
 */
export function ApplyPanel({
  jobId,
  jobUrl,
  applyEmail,
  hasActiveCv,
  attachmentLabel,
  emailEnabled,
  initial,
  appliedInitially,
}: {
  jobId: string;
  jobUrl: string;
  applyEmail: string | null;
  hasActiveCv: boolean;
  attachmentLabel: string;
  emailEnabled: boolean;
  initial: ApplicationView | null;
  appliedInitially: AppliedView | null;
}) {
  const router = useRouter();
  const [app, setApp] = useState<ApplicationView | null>(initial);
  const [applied, setApplied] = useState<AppliedView | null>(appliedInitially);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [note, setNote] = useState(initial?.coverNote ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(path: string, init: RequestInit) {
    const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function run(kind: Exclude<Busy, null>, fallback: string, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(null);
    }
  }

  const adopt = (application: ApplicationView | null) => {
    setApp(application);
    setSubject(application?.subject ?? "");
    setNote(application?.coverNote ?? "");
  };
  const markApplied = (application: ApplicationView) => {
    adopt(application);
    setApplied({ method: application.method, at: application.sentAt ?? new Date().toISOString() });
    router.refresh();
  };

  const prepare = () =>
    run("prepare", "Could not prepare the application.", async () => {
      const data = await call(`/api/jobs/${jobId}/application`, { method: "POST" });
      adopt(data.application);
    });

  const submit = (method: "EMAIL" | "MANUAL") =>
    run(method === "EMAIL" ? "email" : "manual", "Could not submit the application.", async () => {
      await call(`/api/jobs/${jobId}/application`, { method: "PATCH", body: JSON.stringify({ subject, coverNote: note }) });
      if (method === "MANUAL") window.open(jobUrl, "_blank", "noopener,noreferrer");
      const data = await call(`/api/jobs/${jobId}/application/send`, { method: "POST", body: JSON.stringify({ method }) });
      markApplied(data.application);
    });

  const alreadyApplied = () =>
    run("already", "Could not mark this posting as applied.", async () => {
      const data = await call(`/api/jobs/${jobId}/application/applied`, { method: "POST" });
      markApplied(data.application);
    });

  const undo = () =>
    run("undo", "Could not undo.", async () => {
      const data = await call(`/api/jobs/${jobId}/application/applied`, { method: "DELETE" });
      adopt(data.application);
      setApplied(null);
      router.refresh();
    });

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
  const errorLine = error && (
    <p className="text-sm" role="alert" style={{ color: "var(--color-danger)" }}>
      {error}
    </p>
  );
  const alreadyButton = (
    <button type="button" className="btn-secondary" disabled={busy !== null} onClick={alreadyApplied}>
      {busy === "already" ? "Recording..." : "I already applied"}
    </button>
  );

  if (applied) {
    const when = new Date(applied.at).toLocaleDateString();
    const emailed = applied.method === "EMAIL";
    const hasNote = Boolean(app?.coverNote);
    return (
      <div className="card space-y-3" aria-label="Application status">
        <p className="text-sm font-medium">
          {emailed
            ? `Application sent to ${app?.sentTo ?? "the employer"} on ${when}`
            : hasNote
              ? `Marked as applied on ${when} — via the company site`
              : `Marked as applied on ${when}`}
        </p>
        {app?.attachedFileName && (
          <p className="text-xs" style={muted}>
            Attached: {app.attachedFileName}.
          </p>
        )}
        {hasNote && (
          <details>
            <summary className="cursor-pointer text-sm underline">Cover note</summary>
            <p className="text-sm whitespace-pre-wrap mt-2">{app?.coverNote}</p>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {hasNote && (
            <button type="button" className="btn-secondary" onClick={copyNote}>
              {copied ? "Copied" : "Copy cover note"}
            </button>
          )}
          {emailed ? (
            <span className="text-xs" style={muted}>
              Sent by email, so it can&apos;t be undone.
            </span>
          ) : (
            <button type="button" className="text-sm underline" disabled={busy !== null} onClick={undo} style={muted}>
              {busy === "undo" ? "Undoing..." : "Undo: I haven't applied"}
            </button>
          )}
        </div>
        {errorLine}
      </div>
    );
  }

  if (!hasActiveCv) {
    return (
      <div className="space-y-3">
        <p className="text-sm" style={muted}>
          Upload a CV and set it active on your search profile to draft and send an application from here.
        </p>
        {alreadyButton}
        {errorLine}
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy !== null} onClick={prepare}>
            {busy === "prepare" ? "Drafting your application (calls the LLM, ~10s)..." : "Prepare my application"}
          </button>
          {alreadyButton}
        </div>
        <p className="text-xs" style={muted}>
          Preparing attaches {attachmentLabel} and drafts a short cover note — nothing invented. You review everything
          before anything is sent. &quot;I already applied&quot; just records it.
        </p>
        {errorLine}
      </div>
    );
  }

  const canEmail = Boolean(applyEmail) && emailEnabled;
  return (
    <div className="card space-y-3">
      <p className="text-xs" style={muted}>
        Attaching: {attachmentLabel}
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
        <button type="button" className="text-xs underline" disabled={busy !== null} onClick={alreadyApplied} style={muted}>
          {busy === "already" ? "Recording..." : "I already applied"}
        </button>
      </div>
      <p className="text-xs" style={muted}>
        &quot;Apply on the company site&quot; opens their page in a new tab with your CV downloadable above and this note ready to paste,
        and records the application here.
      </p>
      {errorLine}
    </div>
  );
}
