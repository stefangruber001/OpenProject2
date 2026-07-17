import { z } from "zod";

/**
 * Typed, validated environment. Importing this module parses `process.env`
 * once and gives the rest of the app a safe, typed `env` object.
 *
 * Keep all env access going through here — never read `process.env` directly
 * elsewhere, so missing/invalid config fails loudly and in one place.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Optional so the app can boot (and build) without a database configured.
  DATABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export const env = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  // Empty string means "no database configured" (e.g. e2e in-memory runs).
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

export type Env = z.infer<typeof schema>;
