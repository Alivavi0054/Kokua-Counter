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

/** Landing page for each role; unknown or missing roles go to the public home page. */
export function roleHome(role: string | null | undefined): string {
  switch (role) {
    case "student":
      return "/student";
    case "eatery":
      return "/eatery";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  eatery: "Eatery",
  admin: "Administrator",
};
