/**
 * Document (uploaded file) service: validate → persist bytes → count pages →
 * insert metadata row. Used by the uploads API and by integration tests.
 */
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, type DocumentRow } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertFileAllowed, extensionOf, type FileKind } from "@/lib/files";
import { serverEnv } from "./env";
import { getStorage, storageKeyFor } from "./storage";
import { extractPageCount } from "./pagecount";
import { log } from "./log";

export interface DocumentDTO {
  id: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  pageCountEstimated: boolean;
  attached: boolean;
  uploadedAt: string;
}

export function toDocumentDTO(row: DocumentRow): DocumentDTO {
  return {
    id: row.id,
    name: row.originalName,
    kind: row.kind as FileKind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    pageCountEstimated: row.pageCountEstimated,
    attached: row.orderId !== null,
    uploadedAt: row.createdAt.toISOString(),
  };
}

export async function createDocument(opts: {
  userId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}): Promise<DocumentDTO> {
  const maxBytes = serverEnv.maxUploadMb * 1024 * 1024;
  const meta = assertFileAllowed({
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    sizeBytes: opts.data.byteLength,
    maxBytes,
  });

  const pages = await extractPageCount(meta.kind, extensionOf(opts.fileName), opts.data);
  if (pages.pageCount < 1) {
    throw new AppError("FILE_UNREADABLE", "That file appears to have no pages to print");
  }

  const documentId = randomUUID();
  const storageKey = storageKeyFor(opts.userId, documentId, extensionOf(opts.fileName));
  const storage = getStorage();

  await storage.put(storageKey, opts.data, opts.mimeType || "application/octet-stream");
  try {
    const [row] = await db
      .insert(documents)
      .values({
        id: documentId,
        userId: opts.userId,
        originalName: opts.fileName.slice(0, 255),
        mimeType: opts.mimeType || "application/octet-stream",
        kind: meta.kind,
        sizeBytes: opts.data.byteLength,
        pageCount: pages.pageCount,
        pageCountEstimated: pages.estimated,
        storageKey,
      })
      .returning();
    log.info("document.uploaded", {
      userId: opts.userId,
      documentId,
      kind: meta.kind,
      sizeBytes: opts.data.byteLength,
      pages: pages.pageCount,
      estimated: pages.estimated,
    });
    return toDocumentDTO(row);
  } catch (err) {
    await storage.delete(storageKey); // don't leave orphan bytes
    throw err;
  }
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new AppError("DOC_NOT_FOUND", "Document not found");
  const row = rows[0];
  if (row.orderId !== null) {
    throw new AppError("DOC_ALREADY_ORDERED", "This document is part of a placed order and can't be removed");
  }
  await db.delete(documents).where(eq(documents.id, row.id));
  await getStorage().delete(row.storageKey);
  log.info("document.deleted", { userId, documentId });
}

/** Unattached uploads for a user (could power an "recent uploads" tray). */
export async function listUnattachedDocuments(userId: string): Promise<DocumentDTO[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), isNull(documents.orderId)));
  return rows.map(toDocumentDTO);
}
