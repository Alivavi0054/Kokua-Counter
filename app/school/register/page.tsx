import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SchoolRegistrationForm } from "@/components/school-registration-form";

export const metadata: Metadata = {
  title: "School registration",
  description: "Register your school or organization for Kōkua Counter.",
};

export default function SchoolRegisterPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="School partnership"
        title="Register your school"
        description="Bring Kōkua Counter to students at your institution. Share a few details and the team will follow up about onboarding, coordination, and meal support."
      />
      <SchoolRegistrationForm />
    </div>
  );
}
