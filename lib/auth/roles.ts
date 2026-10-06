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
