import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { listSchoolRegistrations } from "@/lib/organization-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "School registrations",
  description: "School partnership requests submitted through Kōkua Counter.",
};

export default async function AdminRegistrationsPage() {
  await requireRole("admin");
  const registrations = await listSchoolRegistrations();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="School registrations"
        description="Partnership requests submitted through the school registration form."
        actions={<Button asChild variant="outline"><a href="/api/admin/registrations/export">Export CSV</a></Button>}
      />

      {registrations.length === 0 ? (
        <EmptyState title="No school registration requests yet">New submissions from the public form will appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {registrations.map((registration) => (
            <article key={registration.id} className="rounded-xl border bg-card p-5 shadow-soft">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h3 className="font-serif text-xl">{registration.schoolName}</h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(registration.createdAt).toLocaleDateString()}
                </span>
              </div>
              <dl className="space-y-1 text-sm text-muted-foreground">
                <div><dt className="inline font-medium text-foreground">Contact:</dt> <dd className="inline"> {registration.contactName}</dd></div>
                <div><dt className="inline font-medium text-foreground">Email:</dt> <dd className="inline"> {registration.email}</dd></div>
                {registration.phone ? <div><dt className="inline font-medium text-foreground">Phone:</dt> <dd className="inline"> {registration.phone}</dd></div> : null}
                {registration.schoolType ? <div><dt className="inline font-medium text-foreground">Type:</dt> <dd className="inline"> {registration.schoolType}</dd></div> : null}
                {registration.students ? <div><dt className="inline font-medium text-foreground">Students:</dt> <dd className="inline"> {registration.students}</dd></div> : null}
                {registration.city || registration.state ? (
                  <div><dt className="inline font-medium text-foreground">Location:</dt> <dd className="inline"> {registration.city || ""}{registration.city && registration.state ? ", " : ""}{registration.state || ""}</dd></div>
                ) : null}
                {registration.message ? (
                  <p className="mt-2 rounded-md bg-muted p-3 text-sm text-foreground">{registration.message}</p>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
