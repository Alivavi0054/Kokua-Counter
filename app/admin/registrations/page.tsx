import type { Metadata } from "next";
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
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Admin tools</p>
        <h1 className="font-serif text-4xl">School registrations</h1>
      </div>

      <a
        href="/api/admin/registrations/export"
        className="inline-flex min-h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
      >
        Export CSV
      </a>

      {registrations.length === 0 ? (
        <p className="text-muted-foreground">No school registration requests yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {registrations.map((registration) => (
            <article key={registration.id} className="rounded-lg border bg-card p-4 shadow-sm">
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
