export const USER_ROLES = ["student", "eatery", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isHawaiiEduEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  return normalized.slice(at + 1) === "hawaii.edu";
}

export function normalizeHawaiiEduEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!isHawaiiEduEmail(normalized)) return normalized;
  const at = normalized.lastIndexOf("@");
  const mailbox = normalized.slice(0, at).split("+", 1)[0] ?? "";
  return `${mailbox}@hawaii.edu`;
}
