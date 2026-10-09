import { describeError } from "@/lib/errors";

type AuthAdminLike = {
  auth: { admin: { deleteUser: (id: string) => Promise<{ error: unknown }> } };
};

/**
 * Best-effort cleanup of an auth user whose follow-up inserts failed, so admin
 * "create user/eatery" never leaves an orphaned login behind. Never throws.
 * Deleting the auth user cascades to public.users.
 */
export async function rollbackAuthUser(admin: AuthAdminLike, userId: string, context: string): Promise<boolean> {
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`${context}: rollback of auth user failed (orphan remains)`, userId, describeError(error));
      return false;
    }
    return true;
  } catch (error) {
    console.error(`${context}: rollback of auth user threw (orphan remains)`, userId, describeError(error));
    return false;
  }
}
