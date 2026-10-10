import { Pool } from "pg";

/**
 * Review storage (Supabase Postgres). Connection settings are env-driven:
 * SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_NAME,
 * SUPABASE_PASSWORD. Only review state is stored — never image bytes, and
 * never anything from an uploaded fax.
 */
declare global {
  // eslint-disable-next-line no-var
  var __scriptlensPool: Pool | undefined;
}

export function dbPool(): Pool | null {
  const host = process.env.SUPABASE_DB_HOST;
  const password = process.env.SUPABASE_PASSWORD;
  if (!host || !password) return null;
  if (!globalThis.__scriptlensPool) {
    globalThis.__scriptlensPool = new Pool({
      host,
      port: Number(process.env.SUPABASE_DB_PORT || 5432),
      user: process.env.SUPABASE_DB_USER || "postgres",
      database: process.env.SUPABASE_DB_NAME || "postgres",
      password,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 6000,
      idleTimeoutMillis: 10000,
    });
  }
  return globalThis.__scriptlensPool;
}

export const REVIEWS_TABLE = "scriptlens.reviews";
export const EXTRACTIONS_TABLE = "scriptlens.extractions";
