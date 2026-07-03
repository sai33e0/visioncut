#!/usr/bin/env node
/* eslint-disable */
/**
 * Apply all SQL migrations in /supabase/migrations/ in order.
 * Safe to re-run — every file is idempotent.
 *
 * Usage:
 *   node scripts/migrate.js            # uses DATABASE_URL
 *   node scripts/migrate.js --reset    # drops the public schema first
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "supabase", "migrations");

async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: shouldUseSSL(url) });
  await client.connect();

  if (reset) {
    console.log("--reset: dropping public schema…");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const f of files) {
    const full = path.join(MIGRATIONS_DIR, f);
    const sql = fs.readFileSync(full, "utf8");
    console.log(`→ applying ${f}…`);
    try {
      await client.query(sql);
    } catch (e) {
      console.error(`✗ ${f} failed:`, e.message);
      process.exitCode = 1;
      break;
    }
  }

  await client.end();
  console.log("done.");
}

function shouldUseSSL(url) {
  return /sslmode=require/i.test(url) ? { rejectUnauthorized: false } : false;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
