import { NextResponse } from "next/server";
import { z } from "zod";
import { createSchoolRegistration } from "@/lib/organization-store";
import { sendEmail } from "@/lib/email";
import { describeError } from "@/lib/errors";
import { rateLimitShared } from "@/lib/rate-limit-shared";
import { getClientIp } from "@/lib/security";

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
  const clientIp = getClientIp(request);
  const limited = await rateLimitShared(`school-register:${clientIp}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

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

  let saved;
  try {
    saved = await createSchoolRegistration({
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
  } catch (error) {
    console.error("School registration storage failed:", describeError(error));
  }

  const notifyTo = process.env.SCHOOL_REGISTRATION_TO_EMAIL?.trim();
  if (!notifyTo) {
    if (process.env.RESEND_API_KEY) {
      console.warn("School registration email skipped: SCHOOL_REGISTRATION_TO_EMAIL is not set");
    }
  } else {
    await sendEmail({
      to: notifyTo,
      replyTo: submission.email,
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
        `Submitted at: ${saved?.createdAt ?? new Date().toISOString()}`,
      ].join("\n"),
    });
  }

  return NextResponse.json({
    message: "Thanks. Your school registration has been received and the team will be in touch.",
  });
}
