"use client";

import { useRef, useState } from "react";
import {
  Camera,
  FileText,
  FileType2,
  ImageIcon,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import type { DocumentDTO } from "@/server/documents";
import { apiFetch } from "@/lib/api-client";
import { ACCEPT_ATTR, classifyUpload, formatBytes } from "@/lib/files";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/config";
import { ApiClientError } from "@/lib/errors";
import type { InFlightUpload, RejectedFile, WizardDoc } from "./types";
import { StepShell } from "@/components/ui";

const KIND_ICON = {
  pdf: { Icon: FileText, classes: "bg-[#ffe9e4] text-brand-deep" },
  word: { Icon: FileType2, classes: "bg-[#e4eaff] text-cobalt" },
  image: { Icon: ImageIcon, classes: "bg-[#e5f3e9] text-mint" },
} as const;

interface Props {
  docs: WizardDoc[];
  inFlight: InFlightUpload[];
  rejected: RejectedFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveDoc: (doc: WizardDoc) => void;
  onDismissRejected: (id: string) => void;
}

export function StepUpload({ docs, inFlight, rejected, onAddFiles, onRemoveDoc, onDismissRejected }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pickFromList(list: FileList | null) {
    if (!list || list.length === 0) return;
    onAddFiles(Array.from(list));
  }

  return (
    <StepShell
      eyebrow="Step 1 of 5"
      title="Add your documents"
      blurb={`PDF, Word, JPG, PNG or HEIC — up to ${MAX_UPLOAD_MB} MB each. Add as many as you like before checkout.`}
    >
      {/* Persistent add controls — the brief requires "Add Document" to stay available */}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-primary px-5 py-2.5 text-sm">
          <Plus size={17} /> Add document
        </button>
        <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn btn-ghost px-5 py-2.5 text-sm">
          <Camera size={17} /> Scan with camera
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            pickFromList(e.target.files);
            e.target.value = "";
          }}
          data-testid="file-input"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            pickFromList(e.target.files);
            e.target.value = "";
          }}
          data-testid="camera-input"
        />
      </div>

      {/* Drag & drop target */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFromList(e.dataTransfer.files);
        }}
        className={`mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          dragging ? "border-brand bg-brand-soft/50" : "border-line bg-cream/60 hover:border-ink/40"
        }`}
      >
        <UploadCloud size={30} className={dragging ? "text-brand" : "text-muted"} aria-hidden="true" />
        <p className="text-sm font-semibold">
          {dragging ? "Drop to add" : "Drag files here, or tap “Add document”"}
        </p>
        <p className="text-xs text-muted">We count pages automatically — photos of pages work great too.</p>
      </button>

      {/* Rejected files */}
      {rejected.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2" aria-live="polite">
          {rejected.map((r) => (
            <li
              key={r.id}
              className="animate-pop-in flex items-start gap-3 rounded-xl border-[1.5px] border-rose bg-[#fff1ef] px-4 py-3"
            >
              <X size={16} className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-rose">{r.name}</p>
                <p className="text-xs font-medium text-rose/90">{r.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismissRejected(r.id)}
                className="text-xs font-bold text-rose underline underline-offset-2"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Uploaded + uploading lists */}
      {(docs.length > 0 || inFlight.length > 0) && (
        <ul className="mt-6 flex flex-col gap-3" data-testid="doc-list">
          {docs.map((doc) => {
            const { Icon, classes } = KIND_ICON[doc.kind];
            return (
              <li key={doc.id} className="hard-card-flat animate-fade-slide flex items-center gap-4 px-4 py-3.5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink/10 ${classes}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted tabular-nums">
                    <span>{formatBytes(doc.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                      {doc.pageCountEstimated && " (est.)"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveDoc(doc)}
                  className="rounded-lg border-[1.5px] border-transparent p-2 text-muted transition-colors hover:border-rose hover:bg-[#fff1ef] hover:text-rose"
                  aria-label={`Remove ${doc.name}`}
                >
                  <X size={17} />
                </button>
              </li>
            );
          })}
          {inFlight.map((u) => (
            <li key={u.tempId} className="hard-card-flat flex items-center gap-4 px-4 py-3.5 opacity-70">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted bg-cream">
                <Loader2 size={18} className="animate-spin text-muted" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{u.name}</p>
                <p className="mt-0.5 text-xs text-muted">Uploading & counting pages…</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </StepShell>
  );
}

/** Shared client-side gate so both drag-drop and pickers behave the same. */
export function clientSideCheck(
  file: File,
): { ok: true } | { ok: false; reason: "UNSUPPORTED_FILE" | "FILE_TOO_LARGE"; message: string } {
  const meta = classifyUpload(file.name, file.type);
  if (!meta) {
    return {
      ok: false,
      reason: "UNSUPPORTED_FILE",
      message: "Unsupported type — use PDF, Word (.doc/.docx), JPG, PNG or HEIC.",
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: "FILE_TOO_LARGE",
      message: `${formatBytes(file.size)} is over the ${MAX_UPLOAD_MB} MB limit.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: "UNSUPPORTED_FILE", message: "That file is empty." };
  }
  return { ok: true };
}

export async function uploadOne(file: File): Promise<DocumentDTO> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch<{ document: DocumentDTO }>("/api/uploads", { formData: fd });
  return res.document;
}

export function uploadErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  return "Upload failed — check your connection and retry.";
}
