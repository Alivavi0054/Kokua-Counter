import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, isUserRole, roleHome } from "@/lib/auth/roles";

const navLinkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-primary";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let displayName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("role, display_name, is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.is_active) {
      role = data.role;
      displayName = data.display_name;
    }
  }

  const home = roleHome(role);
  const roleLabel = role && isUserRole(role) ? ROLE_LABELS[role] : null;
  const dashboardLabel = role === "admin" ? "Admin" : role === "eatery" ? "Eatery counter" : "My meals";

  const links = (
    <>
      <Link href="/about" className={navLinkClass}>About</Link>
      <Link href="/donate" className={navLinkClass}>Donate</Link>
      <Link href="/school/register" className={navLinkClass}>For schools</Link>
      {role ? <Link href={home} className={navLinkClass}>{dashboardLabel}</Link> : null}
    </>
  );

  const account = role ? (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight lg:block">
        <p className="max-w-40 truncate text-sm font-medium text-foreground">{displayName}</p>
        {roleLabel ? <Badge variant="secondary" className="mt-0.5">{roleLabel}</Badge> : null}
      </div>
      <form action="/auth/signout" method="post">
        <Button variant="outline" size="sm" type="submit">Sign out</Button>
      </form>
    </div>
  ) : user ? (
    <form action="/auth/signout" method="post">
      <Button variant="outline" size="sm" type="submit">Sign out</Button>
    </form>
  ) : (
    <Button asChild size="sm">
      <Link href="/auth/login">Sign in</Link>
    </Button>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={home} className="flex items-center gap-2.5 font-serif text-xl font-semibold tracking-tight text-primary">
          <BrandMark />
          <span>Kōkua Counter</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">{account}</div>
          <details className="group relative md:hidden">
            <summary
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border bg-card text-primary [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <svg viewBox="0 0 20 20" className="size-5 group-open:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
              <svg viewBox="0 0 20 20" className="hidden size-5 group-open:block" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </summary>
            <div className="absolute right-0 top-12 w-64 rounded-xl border bg-card p-3 shadow-lift">
              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                {links}
              </nav>
              <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                {role ? (
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    {roleLabel ? <p className="text-xs text-muted-foreground">{roleLabel}</p> : null}
                  </div>
                ) : <span />}
                {account}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2.5 font-serif text-lg font-semibold text-primary">
            <BrandMark className="size-7" />
            Kōkua Counter
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            A shared pool of meal credits that helps University of Hawaiʻi students eat at participating local eateries.
          </p>
        </div>
        <nav aria-label="Explore" className="space-y-2 text-sm">
          <p className="font-semibold text-foreground">Explore</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link href="/about" className="underline-offset-4 hover:text-primary hover:underline">About the program</Link></li>
            <li><Link href="/donate" className="underline-offset-4 hover:text-primary hover:underline">Donate a meal</Link></li>
            <li><Link href="/school/register" className="underline-offset-4 hover:text-primary hover:underline">Register a school</Link></li>
            <li><Link href="/auth/login" className="underline-offset-4 hover:text-primary hover:underline">Sign in</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal" className="space-y-2 text-sm">
          <p className="font-semibold text-foreground">Legal</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link href="/privacy" className="underline-offset-4 hover:text-primary hover:underline">Privacy</Link></li>
            <li><Link href="/terms" className="underline-offset-4 hover:text-primary hover:underline">Terms</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <p>© {new Date().getFullYear()} Kōkua Counter. Meal credits are shared across participating eateries in Hawaiʻi.</p>
          <p>Made with love and care by Ali Abdulla</p>
        </div>
      </div>
    </footer>
  );
}
