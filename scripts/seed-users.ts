import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv, requireEnv } from "@/lib/env";

const { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } =
  getSupabaseAdminEnv("db:seed Supabase admin client");

const seedUsers = [
  {
    email: "admin@example.com",
    password: requireEnv("SEED_ADMIN_PASSWORD", "db:seed admin account"),
    role: "admin" as const,
    displayName: "Site Admin",
  },
  {
    email: "student@hawaii.edu",
    password: requireEnv("SEED_STUDENT_PASSWORD", "db:seed student account"),
    role: "student" as const,
    displayName: "Student Test",
  },
  {
    email: "eatery@example.com",
    password: requireEnv("SEED_EATERY_PASSWORD", "db:seed eatery account"),
    role: "eatery" as const,
    displayName: "Eatery Owner",
  },
];

async function ensureUserSeed(entry: (typeof seedUsers)[number]) {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: users, error: listError } = await client.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  const authUser = users.users.find((user) => user.email === entry.email);

  let userId = authUser?.id;

  if (!userId) {
    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: entry.email,
      password: entry.password,
      email_confirm: true,
      user_metadata: { role: entry.role },
    });

    if (createError || !created.user) {
      throw createError ?? new Error(`Could not create ${entry.email}`);
    }

    userId = created.user.id;
  } else {
    const { error: updateError } = await client.auth.admin.updateUserById(userId, {
      password: entry.password,
      email_confirm: true,
    });
    if (updateError) throw updateError;
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .upsert(
      {
        id: userId,
        role: entry.role,
        display_name: entry.displayName,
        public_alias: entry.displayName,
        verified_school_domain: entry.role === "student" ? "hawaii.edu" : null,
        is_active: true,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (profileError) {
    throw profileError;
  }

  if (entry.role === "eatery") {
    const { error: eateryError } = await client.from("eateries").upsert(
      {
        owner_user_id: userId,
        name: "Test Eatery",
        slug: "test-eatery",
        address: "123 Main St",
        island: "Oahu",
        contact_email: entry.email,
        is_active: true,
      },
      { onConflict: "slug" },
    );

    if (eateryError) {
      throw eateryError;
    }
  }

  console.log(`Seeded ${entry.role} account.`);
  return profile;
}

async function main() {
  for (const seedUser of seedUsers) {
    await ensureUserSeed(seedUser);
  }

  console.log("Seed users complete.");
}

main().catch(() => {
  console.error("Seed failed. Check the Supabase connection and the configured seed variables.");
  process.exit(1);
});
