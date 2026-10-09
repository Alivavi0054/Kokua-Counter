import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// Minimal stand-in for the parts of Supabase the migrations depend on.
const SUPABASE_SHIM = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    instance_id UUID, id UUID PRIMARY KEY DEFAULT gen_random_uuid(), aud TEXT, role TEXT, email TEXT,
    encrypted_password TEXT, email_confirmed_at TIMESTAMPTZ DEFAULT now(),
    raw_app_meta_data JSONB, raw_user_meta_data JSONB, created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(), confirmation_token TEXT, email_change TEXT,
    email_change_token_new TEXT, recovery_token TEXT
  );
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::UUID $$;
  CREATE SCHEMA IF NOT EXISTS extensions;
  GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;
`;

/** Fresh in-memory Postgres with every repo migration applied, for testing real SQL. */
export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec("CREATE SCHEMA IF NOT EXISTS extensions;");
  await db.exec(SUPABASE_SHIM);
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await seedUsers(db);
  return db;
}

/** Mirrors scripts/seed-users.ts: an admin, a student and an eatery owner with one eatery. */
async function seedUsers(db: PGlite) {
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('10000000-0000-4000-8000-000000000001', 'admin@example.com'),
      ('10000000-0000-4000-8000-000000000002', 'student@hawaii.edu'),
      ('10000000-0000-4000-8000-000000000003', 'eatery@example.com');
    INSERT INTO public.users (id, role, display_name, is_active) VALUES
      ('10000000-0000-4000-8000-000000000001', 'admin', 'Site Admin', TRUE),
      ('10000000-0000-4000-8000-000000000002', 'student', 'Student Test', TRUE),
      ('10000000-0000-4000-8000-000000000003', 'eatery', 'Eatery Owner', TRUE);
    INSERT INTO public.eateries (owner_user_id, name, slug, address, island, contact_email, is_active)
    VALUES ('10000000-0000-4000-8000-000000000003', 'Test Eatery', 'test-eatery', '123 Main St', 'Oahu', 'eatery@example.com', TRUE);
  `);
}
