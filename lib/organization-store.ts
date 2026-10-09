import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type OrganizationRecord = {
  id: string;
  name: string;
  mission?: string;
  contactName: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  website?: string;
  notes?: string;
  createdAt: string;
};

export type SchoolRegistrationRecord = {
  id: string;
  schoolName: string;
  contactName: string;
  email: string;
  phone?: string;
  schoolType?: string;
  students?: string;
  city?: string;
  state?: string;
  message?: string;
  createdAt: string;
};

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type SchoolRegistrationRow = Database["public"]["Tables"]["school_registrations"]["Row"];

// Admin lists are not paginated yet; PostgREST caps responses at 1000 rows anyway.
const LIST_LIMIT = 1000;

function toOptional(value: string | null): string | undefined {
  return value === null ? undefined : value;
}

function toOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    mission: toOptional(row.mission),
    contactName: row.contact_name,
    email: row.email,
    phone: toOptional(row.phone),
    city: toOptional(row.city),
    state: toOptional(row.state),
    website: toOptional(row.website),
    notes: toOptional(row.notes),
    createdAt: row.created_at,
  };
}

function toSchoolRegistration(row: SchoolRegistrationRow): SchoolRegistrationRecord {
  return {
    id: row.id,
    schoolName: row.school_name,
    contactName: row.contact_name,
    email: row.email,
    phone: toOptional(row.phone),
    schoolType: toOptional(row.school_type),
    students: toOptional(row.students),
    city: toOptional(row.city),
    state: toOptional(row.state),
    message: toOptional(row.message),
    createdAt: row.created_at,
  };
}

// Storage errors are thrown, never swallowed: a failed read must not look like "no data".
export async function listOrganizations(): Promise<OrganizationRecord[]> {
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return (data ?? []).map(toOrganization);
}

export async function createOrganization(input: Omit<OrganizationRecord, "id" | "createdAt">): Promise<OrganizationRecord> {
  const { data, error } = await createAdminClient()
    .from("organizations")
    .insert({
      name: input.name,
      mission: input.mission ?? null,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toOrganization(data);
}

export async function listSchoolRegistrations(): Promise<SchoolRegistrationRecord[]> {
  const { data, error } = await createAdminClient()
    .from("school_registrations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return (data ?? []).map(toSchoolRegistration);
}

export async function createSchoolRegistration(input: Omit<SchoolRegistrationRecord, "id" | "createdAt">): Promise<SchoolRegistrationRecord> {
  const { data, error } = await createAdminClient()
    .from("school_registrations")
    .insert({
      school_name: input.schoolName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone ?? null,
      school_type: input.schoolType ?? null,
      students: input.students ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      message: input.message ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toSchoolRegistration(data);
}
