import Link from "next/link";
import { StudentMealPass } from "@/components/student-meal-pass";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";

export default async function StudentPage() {
  const user = await requireRole("student");

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">A meal is ready when you are</p>
        <h1 className="font-serif text-4xl">Ready for a meal?</h1>
        <p className="text-muted-foreground">Use your single-use meal pass at any participating eatery.</p>
      </div>
      <p>Kia ora, {user.displayName}.</p>
      <StudentMealPass />
      <Button variant="outline" asChild><Link href="/student/history">View history</Link></Button>
    </div>
  );
}