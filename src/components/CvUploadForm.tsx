"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CvUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/cv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 max-w-md">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <button
        type="button"
        disabled={uploading}
        className="btn-primary self-start"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading & reviewing (this calls the LLM, can take ~10-20s)..." : "Upload CV"}
      </button>
    </div>
  );
}
