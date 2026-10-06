import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import { sessionCookieAttributes } from "@/server/auth";
import { pool } from "@/db";

afterAll(async () => {
  await pool.end();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session cookie attributes", () => {
  it("local/dev (http): Lax + not secure so localhost can set it", () => {
    vi.stubEnv("NODE_ENV", "development");
    const attrs = sessionCookieAttributes();
    expect(attrs.httpOnly).toBe(true);
    expect(attrs.sameSite).toBe("lax");
    expect(attrs.secure).toBe(false);
    expect(attrs.partitioned).toBe(false);
    expect(attrs.path).toBe("/");
    expect(attrs.maxAge).toBeGreaterThan(0);
  });

  it("production (https): CHIPS attributes so embedded iframe previews keep the session", () => {
    vi.stubEnv("NODE_ENV", "production");
    const attrs = sessionCookieAttributes();
    expect(attrs.sameSite).toBe("none");
    expect(attrs.secure).toBe(true); // SameSite=None is invalid without Secure
    expect(attrs.partitioned).toBe(true);
    expect(attrs.httpOnly).toBe(true);
  });
});
