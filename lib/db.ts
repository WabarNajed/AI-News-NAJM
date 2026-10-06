import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { and, eq, or, isNull, lt } from "drizzle-orm";
import type { FinancialResult } from "./types";

// These records contain only public publisher data, never user or internal Najm data.
export const cache = pgTable("market_cache", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  error: text("error"),
});
const globalDb = globalThis as unknown as { marketPool?: Pool };
const pool =
  globalDb.marketPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 8000,
  });
if (process.env.NODE_ENV !== "production") globalDb.marketPool = pool;
export const db = drizzle(pool);
export async function readCache(key: string) {
  return (await db.select().from(cache).where(eq(cache.key, key)))[0];
}
export async function claim(key: string, intervalMs: number) {
  await db.insert(cache).values({ key, payload: {} }).onConflictDoNothing();
  const now = new Date();
  const rows = await db
    .update(cache)
    .set({ attemptedAt: now, lockedUntil: new Date(Date.now() + 90000) })
    .where(
      and(
        eq(cache.key, key),
        or(isNull(cache.lockedUntil), lt(cache.lockedUntil, now)),
        or(
          isNull(cache.attemptedAt),
          lt(cache.attemptedAt, new Date(Date.now() - intervalMs)),
        ),
      ),
    )
    .returning({ key: cache.key });
  return rows.length > 0;
}
export async function markAttempt(key: string) {
  const attemptedAt = new Date();
  await db.insert(cache).values({ key, payload: [], attemptedAt }).onConflictDoUpdate({ target: cache.key, set: { attemptedAt } });
}
export async function writeCache(key: string, payload: unknown) {
  const now = new Date();
  await db
    .insert(cache)
    .values({ key, payload, updatedAt: now, attemptedAt: now, error: null })
    .onConflictDoUpdate({
      target: cache.key,
      set: {
        payload,
        updatedAt: now,
        attemptedAt: now,
        error: null,
        lockedUntil: null,
      },
    });
}
export async function failCache(key: string, error: string) {
  await db
    .insert(cache)
    .values({ key, payload: {}, error, attemptedAt: new Date() })
    .onConflictDoUpdate({
      target: cache.key,
      set: { error, attemptedAt: new Date(), lockedUntil: null },
    });
}
export async function financialResults(): Promise<FinancialResult[]> {
  const record = await readCache("verified-financial-results");
  return Array.isArray(record?.payload)
    ? (record.payload as FinancialResult[])
    : [];
}
