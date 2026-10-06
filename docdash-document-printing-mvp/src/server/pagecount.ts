/**
 * Page-count extraction.
 *  - PDF:  exact, via pdf-lib.
 *  - DOCX: exact when the producer embedded <Pages> in docProps/app.xml;
 *          otherwise estimated from word count (~450 words/page).
 *  - DOC:  legacy binary format — heuristic word count, always estimated.
 *  - Images (jpg/png/heic): exactly 1 page.
 */
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import type { FileKind } from "@/lib/files";
import { AppError } from "@/lib/errors";

export interface PageCountResult {
  pageCount: number;
  estimated: boolean;
}

const WORDS_PER_PAGE = 450;

async function countPdfPages(buf: Buffer): Promise<PageCountResult> {
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = doc.getPageCount();
    if (pages < 1) throw new Error("pdf has 0 pages");
    return { pageCount: pages, estimated: false };
  } catch {
    throw new AppError("FILE_UNREADABLE", "We couldn't read that PDF — it may be corrupt or password-protected");
  }
}

function countWordsIn(text: string): number {
  const matches = text.replace(/<[^>]+>/g, " ").match(/[A-Za-z0-9'’-]+/g);
  return matches ? matches.length : 0;
}

function estimateFromWords(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_PAGE));
}

async function countDocxPages(buf: Buffer): Promise<PageCountResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new AppError("FILE_UNREADABLE", "We couldn't read that Word file — it may be corrupt");
  }
  // 1) Trust the app's own page counter when present.
  const appXml = zip.file("docProps/app.xml");
  if (appXml) {
    const xml = await appXml.async("text");
    const match = xml.match(/<Pages>(\d+)<\/Pages>/i);
    if (match) {
      const pages = parseInt(match[1], 10);
      if (Number.isFinite(pages) && pages >= 1) return { pageCount: pages, estimated: false };
    }
  }
  // 2) Fall back to a word-count estimate, clearly flagged.
  const documentXml = zip.file("word/document.xml");
  if (documentXml) {
    const xml = await documentXml.async("text");
    return { pageCount: estimateFromWords(countWordsIn(xml)), estimated: true };
  }
  return { pageCount: 1, estimated: true };
}

function countDocPagesHeuristic(buf: Buffer): PageCountResult {
  // Legacy .doc is a binary container; extracting exact pagination requires a
  // rendering engine (LibreOffice). Estimate from visible word-ish tokens.
  const text = buf.toString("latin1");
  const words = countWordsIn(text);
  return { pageCount: estimateFromWords(words), estimated: true };
}

export async function extractPageCount(kind: FileKind, ext: string, buf: Buffer): Promise<PageCountResult> {
  switch (kind) {
    case "pdf":
      return countPdfPages(buf);
    case "image":
      return { pageCount: 1, estimated: false };
    case "word":
      return ext === "docx" ? countDocxPages(buf) : countDocPagesHeuristic(buf);
  }
}
