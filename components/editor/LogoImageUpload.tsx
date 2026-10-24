"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Panel";

/**
 * Logo image upload.
 *
 * Uploads to `/api/uploads`, which stores the file and returns a URL. The
 * editor then references that URL as the logo source. Free accounts cannot
 * upload: the API rejects the request and we surface the reason.
 */

export function LogoImageUpload({
  onUploaded,
  disabled,
}: {
  onUploaded: (url: string, name: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setStatus("Uploading…");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `Upload failed (${response.status})`);
      }
      onUploaded(body.url, body.name ?? file.name);
      setStatus("Uploaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
        className="hidden"
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="w-full"
      >
        {busy ? "Uploading…" : "Upload image"}
      </Button>
      {status ? (
        <p className="text-[11px] text-[var(--color-ink-faint)]">{status}</p>
      ) : null}
    </div>
  );
}
