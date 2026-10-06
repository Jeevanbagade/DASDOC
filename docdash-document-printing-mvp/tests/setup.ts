/**
 * Runs before every test file. Points the app at the local dev database and
 * local-disk storage so integration tests exercise the real stack.
 */
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
process.env.SESSION_SECRET ??= "vitest-session-secret";
process.env.STORAGE_DRIVER ??= "local";
process.env.STORAGE_DIR ??= ".storage-test";
process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ??= "25";
process.env.NEXT_PUBLIC_UPI_AVAILABLE ??= "true";
