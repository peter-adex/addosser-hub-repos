export function buildDownloadUrl(fileUrl: string, fileName: string): string {
  const encodedUrl  = encodeURIComponent(fileUrl.trim());
  const encodedName = encodeURIComponent(fileName.trim());
  return `/api/download?url=${encodedUrl}&name=${encodedName}`;
}

export function downloadFile(fileUrl: string, fileName: string): void {
  if (typeof window === "undefined") return;

  const href = buildDownloadUrl(fileUrl, fileName);

  const a = document.createElement("a");
  a.href         = href;
  a.download     = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
  }, 200);
}

export function parseAttachments(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === "string");
    return [];
  } catch {
    return [];
  }
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    pdf:  "📄",
    doc:  "📝", docx: "📝",
    xls:  "📊", xlsx: "📊",
    ppt:  "📋", pptx: "📋",
    jpg:  "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    txt:  "📃",
    html: "🌐",
    csv:  "📊",
    zip:  "🗜️",
  };
  return icons[ext] ?? "📎";
}
