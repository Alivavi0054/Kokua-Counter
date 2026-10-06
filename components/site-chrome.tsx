import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = data?.role ?? null;
  }

  const home =
    role === "student"
      ? "/student"
      : role === "eatery"
        ? "/eatery"
        : role === "admin"
          ? "/admin"
          : "/";

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href={home} className="font-serif text-xl tracking-tight">
          Kōkua Counter
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main navigation">
          <Button variant="ghost" asChild>
            <Link href="/about">About</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/donate">Donate</Link>
          </Button>
          {user ? (
            <form action="/auth/signout" method="post">
              <Button variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          ) : (
            <Button asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
        <p>Meal credits are shared across participating eateries in Hawaiʻi.</p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
          <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
