import { StudentMealPass } from "@/components/student-meal-pass";
import { requireRole } from "@/lib/auth/guards";

export default async function StudentMealPage() {
  await requireRole("student");
  return <div className="mx-auto max-w-xl"><StudentMealPass /></div>;
}