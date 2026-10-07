import type { Metadata } from "next";
import { SchoolRegistrationForm } from "@/components/school-registration-form";

export const metadata: Metadata = {
  title: "School registration",
  description: "Register your school or organization for Kōkua Counter.",
};

export default function SchoolRegisterPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-primary">School partnership</p>
        <h1 className="font-serif text-4xl">Register your school</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Bring Kōkua Counter to students at your institution. Share a few details and the team will follow up about onboarding, coordination, and meal support.
        </p>
      </div>
      <SchoolRegistrationForm />
    </div>
  );
}
