import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUserRole, type UserRole } from "@/lib/auth/roles";

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
};

export async function loadUser(): Promise<AppUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, display_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isUserRole(profile.role) || !profile.is_active) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: profile.role,
    displayName: profile.display_name,
    isActive: profile.is_active,
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await loadUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

export async function requireRole(role: UserRole): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== role) {
    redirect("/auth/login?error=unauthorized");
  }
  return user;
}
