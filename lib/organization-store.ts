import { promises as fs } from "node:fs";
import path from "node:path";

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

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.join(process.cwd(), "data", fileName);
  try {
    const text = await fs.readFile(filePath, "utf8");
    if (!text.trim()) return fallback;
    return JSON.parse(text) as T;
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

async function writeJson<T>(fileName: string, value: T) {
  const filePath = path.join(process.cwd(), "data", fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function listOrganizations(): Promise<OrganizationRecord[]> {
  return readJson<OrganizationRecord[]>("organizations.json", []);
}

export async function createOrganization(input: Omit<OrganizationRecord, "id" | "createdAt">): Promise<OrganizationRecord> {
  const organizations = await listOrganizations();
  const record: OrganizationRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  organizations.unshift(record);
  await writeJson("organizations.json", organizations);
  return record;
}

export async function listSchoolRegistrations(): Promise<SchoolRegistrationRecord[]> {
  return readJson<SchoolRegistrationRecord[]>("school-registrations.json", []);
}

export async function createSchoolRegistration(input: Omit<SchoolRegistrationRecord, "id" | "createdAt">): Promise<SchoolRegistrationRecord> {
  const records = await listSchoolRegistrations();
  const record: SchoolRegistrationRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  records.unshift(record);
  await writeJson("school-registrations.json", records);
  return record;
}
