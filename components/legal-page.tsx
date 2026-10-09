import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";

export function LegalPage({
  title,
  eyebrow,
  intro,
  children,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} />
      <Alert variant="info">{intro}</Alert>
      <div className="space-y-8 text-base leading-relaxed text-foreground/90 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary [&_section]:space-y-3">
        {children}
      </div>
    </article>
  );
}

export function ContactLine({ email, fallback }: { email: string | null; fallback: string }) {
  return email ? (
    <a href={`mailto:${email}`} className="font-medium text-primary underline underline-offset-4">
      {email}
    </a>
  ) : (
    <span>{fallback}</span>
  );
}
