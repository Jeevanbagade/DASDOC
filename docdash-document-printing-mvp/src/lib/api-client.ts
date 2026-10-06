/**
 * Browser-side fetch helper: parses the standard error envelope
 * ({ error: { code, message, details } }) and throws ApiClientError so UI
 * code can switch on typed codes instead of string matching.
 */
import { ApiClientError, type ApiErrorBody, type ErrorCode } from "./errors";

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  json?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? (options.json !== undefined || options.formData ? "POST" : "GET"),
    credentials: "same-origin",
    signal: options.signal,
    headers: {},
  };
  if (options.json !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.json);
  } else if (options.formData) {
    init.body = options.formData; // browser sets multipart boundary
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiClientError("INTERNAL", "Network error — check your connection and retry.", 0);
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const errBody = body as ApiErrorBody | null;
    const code: ErrorCode = errBody?.error?.code ?? (res.status === 401 ? "AUTH_EXPIRED" : "INTERNAL");
    const message = errBody?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiClientError(code, message, res.status, errBody?.error?.details);
  }
  return body as T;
}
