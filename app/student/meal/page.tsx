import type { Metadata } from "next";
import { StudentMealPass } from "@/components/student-meal-pass";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Meal pass",
  description: "Create and show your active Kōkua Counter meal pass.",
};

export default async function StudentMealPage() {
  await requireRole("student");
  return <div className="mx-auto max-w-xl"><StudentMealPass /></div>;
}