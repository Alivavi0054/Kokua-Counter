import { NextResponse } from "next/server";
import { z } from "zod";
import { createSchoolRegistration } from "@/lib/organization-store";

const schoolRegistrationSchema = z.object({
  schoolName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  schoolType: z.string().trim().max(100).optional().or(z.literal("")),
  students: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schoolRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  const submission = parsed.data;
  const saved = await createSchoolRegistration({
    schoolName: submission.schoolName,
    contactName: submission.contactName,
    email: submission.email,
    phone: submission.phone || undefined,
    schoolType: submission.schoolType || undefined,
    students: submission.students || undefined,
    city: submission.city || undefined,
    state: submission.state || undefined,
    message: submission.message || undefined,
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const emailFrom = process.env.EMAIL_FROM ?? "Kōkua Counter <noreply@kokuacounter.app>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: ["alifnabulla@gmail.com"],
        reply_to: submission.email,
        subject: `School registration: ${submission.schoolName}`,
        text: [
          "New school registration request for Kōkua Counter",
          "",
          `School: ${submission.schoolName}`,
          `Contact: ${submission.contactName}`,
          `Email: ${submission.email}`,
          `Phone: ${submission.phone || "Not provided"}`,
          `School type: ${submission.schoolType || "Not provided"}`,
          `Estimated students: ${submission.students || "Not provided"}`,
          `Location: ${submission.city || "Not provided"}, ${submission.state || "Not provided"}`,
          "",
          `Message:\n${submission.message || "No additional message provided."}`,
          "",
          `Submitted at: ${saved.createdAt}`,
        ].join("\n"),
      }),
    });

    if (!response.ok) {
      console.error("Resend email failed", await response.text());
    }
  }

  return NextResponse.json({
    message: "Thanks. Your school registration has been received and the team will be in touch.",
  });
}
