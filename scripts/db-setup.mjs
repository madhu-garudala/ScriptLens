#!/usr/bin/env node
/**
 * Creates the `scriptlens` schema and its tables in Supabase Postgres. Safe to
 * re-run. Row level security is enabled with no policies, so the tables are
 * reachable only through the app's server connection — not Supabase's public API.
 *
 * Usage: node scripts/db-setup.mjs   (reads .env.local)
 */
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      // Strip surrounding quotes, as Next's env loader does (needed for values containing "#").
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const host = process.env.SUPABASE_DB_HOST;
const password = process.env.SUPABASE_PASSWORD;
if (!host || !password) {
  console.error("✗ Set SUPABASE_DB_HOST and SUPABASE_PASSWORD in .env.local first.");
  process.exit(1);
}

const client = new pg.Client({
  host,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER || "postgres",
  database: process.env.SUPABASE_DB_NAME || "postgres",
  password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

try {
  await client.connect();
  console.log(`✓ Connected to ${host}`);
  await client.query("create schema if not exists scriptlens");

  // One-time move of the original public.scriptlens_* tables (keeps their rows).
  for (const [oldName, newName] of [
    ["scriptlens_reviews", "reviews"],
    ["scriptlens_extractions", "extractions"],
  ]) {
    const { rows: found } = await client.query(
      `select to_regclass($1) is not null as old_exists, to_regclass($2) is not null as new_exists`,
      [`public.${oldName}`, `scriptlens.${newName}`],
    );
    if (found[0].old_exists && !found[0].new_exists) {
      await client.query(`alter table public.${oldName} set schema scriptlens`);
      await client.query(`alter table scriptlens.${oldName} rename to ${newName}`);
      await client.query(
        `alter table scriptlens.${newName} rename constraint ${oldName}_pkey to ${newName}_pkey`,
      );
      console.log(`✓ Moved public.${oldName} → scriptlens.${newName}`);
    }
  }

  // Saved reviews: one row per browser id + bundled fax.
  await client.query(`
    create table if not exists scriptlens.reviews (
      client_id   uuid        not null,
      document_id text        not null,
      result      jsonb       not null,
      review      jsonb       not null,
      audit       jsonb       not null,
      exported    boolean     not null default false,
      updated_at  timestamptz not null default now(),
      primary key (client_id, document_id)
    )`);
  // Stored model extractions for the bundled fixtures (never for uploads).
  await client.query(`
    create table if not exists scriptlens.extractions (
      document_id text        primary key,
      result      jsonb       not null,
      created_at  timestamptz not null default now()
    )`);
  for (const t of ["reviews", "extractions"]) {
    await client.query(`alter table scriptlens.${t} enable row level security`);
    const { rows } = await client.query(`select count(*)::int as n from scriptlens.${t}`);
    console.log(`✓ scriptlens.${t} ready (row level security on) — ${rows[0].n} rows`);
  }
} catch (e) {
  console.error(`✗ Database setup failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
