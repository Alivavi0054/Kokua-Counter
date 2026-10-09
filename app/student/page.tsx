import Link from "next/link";
import type { Metadata } from "next";
import { StudentMealPass } from "@/components/student-meal-pass";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Student meals",
  description: "View or create a single-use Kōkua Counter meal pass.",
};

export default async function StudentPage() {
  const user = await requireRole("student");

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        eyebrow={`Welcome, ${user.displayName}`}
        title="Ready for a meal?"
        description="Use your single-use meal pass at any participating eatery."
      />
      <StudentMealPass />
      <Button variant="outline" asChild><Link href="/student/history">View history</Link></Button>
    </div>
  );
}
