"use client";

import { useRef, useState } from "react";
import { Paperclip, X, Loader2, FileText } from "lucide-react";

export interface UploadedAttachment {
  name: string;
  url: string;
  storageProvider?: string;
  storageKey?: string;
  mimeType?: string;
  size?: number;
}

interface Props {
  folder: string;
  value: UploadedAttachment[];
  onChange: (files: UploadedAttachment[]) => void;
  maxFiles?: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MultiFileUpload({ folder, value, onChange, maxFiles = 10 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError("");

    const files = Array.from(fileList);
    if (value.length + files.length > maxFiles) {
      setError(`You can attach up to ${maxFiles} files.`);
      return;
    }

    setUploading(true);
    const uploaded: UploadedAttachment[] = [];
    for (const file of files) {
      try {
        const dataUrl = await readAsDataUrl(file);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: dataUrl, folder }),
        });
        const json = await res.json();
        if (!res.ok || !json.data?.url) {
          setError(`"${file.name}" failed to upload: ${json.error ?? "unknown error"}`);
          continue;
        }
        uploaded.push({
          name: file.name,
          url: json.data.url,
          storageProvider: json.data.storageProvider,
          storageKey: json.data.storageKey,
          mimeType: json.data.mimeType || file.type,
          size: json.data.size ?? file.size,
        });
      } catch {
        setError(`"${file.name}" failed to upload — check your connection.`);
      }
    }
    onChange([...value, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || value.length >= maxFiles}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {uploading ? "Uploading…" : "Attach Files"}
        </button>
        <span className="text-xs text-muted-foreground">PDF, Word, images, HTML, Outlook — up to {maxFiles} files</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        accept=".pdf,.doc,.docx,.htm,.html,.msg,.eml,image/*"
      />

      {error && <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-2">{error}</p>}

      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(f.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
