/**
 * Centralized API response helpers. Every route handler wraps its work in
 * try/catch and funnels errors through `fail()`, so the error envelope is
 * uniform: { error: { code, message, details? } } with the mapped status.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, type ApiErrorBody } from "@/lib/errors";
import { log } from "./log";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      log.error("api.error", { code: err.code, message: err.message });
    }
    return NextResponse.json(err.toBody(), { status: err.httpStatus });
  }
  if (err instanceof ZodError) {
    const appErr = new AppError("VALIDATION", err.issues[0]?.message ?? "Invalid input", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return NextResponse.json(appErr.toBody(), { status: appErr.httpStatus });
  }
  log.error("api.unhandled", {
    message: err instanceof Error ? err.message : "unknown error",
  });
  const internal = new AppError("INTERNAL", "Something went wrong on our side — please retry");
  return NextResponse.json(internal.toBody(), { status: internal.httpStatus });
}

/** Parses a JSON body, tolerating empty/invalid payloads as VALIDATION. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON");
  }
}
