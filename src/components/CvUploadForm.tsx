"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CvUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/cv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-md">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="text-sm"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={uploading} className="btn-primary self-start">
        {uploading ? "Uploading & reviewing (this calls the LLM, can take ~10-20s)..." : "Upload CV"}
      </button>
    </form>
  );
}
