import { redirect } from "next/navigation";

// Sign-in is shared by every role. Kept so old bookmarks to /admin/login still work.
export default function AdminLoginPage() {
  redirect("/auth/login");
}
