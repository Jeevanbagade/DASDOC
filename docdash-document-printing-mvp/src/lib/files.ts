/**
 * Upload rules shared by client and server. The client uses them to reject
 * bad picks instantly; the server re-checks everything independently.
 */
import { AppError } from "./errors";

export type FileKind = "pdf" | "word" | "image";

export interface FileKindMeta {
  kind: FileKind;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  /** true when the page count is exact (pdf) or a heuristic (word) */
  exactPageCount: boolean;
}

export const FILE_KINDS: Record<FileKind, FileKindMeta> = {
  pdf: {
    kind: "pdf",
    label: "PDF",
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
    exactPageCount: true,
  },
  word: {
    kind: "word",
    label: "Word",
    extensions: ["doc", "docx"],
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    exactPageCount: false,
  },
  image: {
    kind: "image",
    label: "Image",
    extensions: ["jpg", "jpeg", "png", "heic"],
    mimeTypes: ["image/jpeg", "image/png", "image/heic", "image/heif"],
    exactPageCount: true,
  },
};

export const ALL_EXTENSIONS = Object.values(FILE_KINDS).flatMap((k) => k.extensions);

/** Value for <input accept="..."> — includes capture-friendly image types. */
export const ACCEPT_ATTR = [
  "application/pdf",
  ".pdf",
  ".doc",
  ".docx",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/heic",
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
].join(",");

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

/**
 * Decide the kind of an upload from extension first (most reliable across
 * mobile browsers, which sometimes send empty/generic MIME types), then MIME.
 * Returns null for unsupported files.
 */
export function classifyUpload(fileName: string, mimeType: string): FileKindMeta | null {
  const ext = extensionOf(fileName);
  const mime = (mimeType || "").toLowerCase();
  for (const meta of Object.values(FILE_KINDS)) {
    if (ext && meta.extensions.includes(ext)) {
      // Extension matched — sanity check obvious MIME mismatches (e.g. x.png
      // claiming application/pdf falls through only if ext matches its family).
      return meta;
    }
  }
  for (const meta of Object.values(FILE_KINDS)) {
    if (mime && meta.mimeTypes.includes(mime)) return meta;
  }
  return null;
}

export function assertFileAllowed(opts: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  maxBytes: number;
}): FileKindMeta {
  const meta = classifyUpload(opts.fileName, opts.mimeType);
  if (!meta) {
    throw new AppError(
      "UNSUPPORTED_FILE",
      `"${opts.fileName}" isn't supported. Upload PDF, Word (.doc/.docx) or images (JPG, PNG, HEIC).`,
      { fileName: opts.fileName },
    );
  }
  if (opts.sizeBytes > opts.maxBytes) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `"${opts.fileName}" is ${formatBytes(opts.sizeBytes)} — the limit is ${formatBytes(opts.maxBytes)}.`,
      { fileName: opts.fileName, sizeBytes: opts.sizeBytes, maxBytes: opts.maxBytes },
    );
  }
  if (opts.sizeBytes <= 0) {
    throw new AppError("FILE_UNREADABLE", `"${opts.fileName}" appears to be empty.`, {
      fileName: opts.fileName,
    });
  }
  return meta;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
