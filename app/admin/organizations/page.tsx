import type { Metadata } from "next";
import { AdminOrganizationForm } from "@/components/admin-organization-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/organization-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Organizations",
  description: "Create and manage Kōkua Counter organizations.",
};

export default async function AdminOrganizationsPage() {
  await requireRole("admin");
  const organizations = await listOrganizations();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Admin tools</p>
        <h1 className="font-serif text-4xl">Organizations</h1>
      </div>

      <AdminOrganizationForm />

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Recent organizations</h2>
        {organizations.length === 0 ? (
          <p className="text-muted-foreground">No organizations have been created yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {organizations.map((organization) => (
              <article key={organization.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <h3 className="font-serif text-xl">{organization.name}</h3>
                  {organization.createdAt ? (
                    <span className="text-xs text-muted-foreground">{new Date(organization.createdAt).toLocaleDateString()}</span>
                  ) : null}
                </div>
                {organization.mission ? <p className="text-sm text-muted-foreground">{organization.mission}</p> : null}
                <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {organization.contactName ? <div><dt className="inline font-medium text-foreground">Contact:</dt> <dd className="inline"> {organization.contactName}</dd></div> : null}
                  {organization.email ? <div><dt className="inline font-medium text-foreground">Email:</dt> <dd className="inline"> {organization.email}</dd></div> : null}
                  {organization.city || organization.state ? <div><dt className="inline font-medium text-foreground">Location:</dt> <dd className="inline"> {organization.city || ""}{organization.city && organization.state ? ", " : ""}{organization.state || ""}</dd></div> : null}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
