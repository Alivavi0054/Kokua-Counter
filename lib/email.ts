import { describeError } from "@/lib/errors";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

/** Printable ASCII only: no CR/LF or other control or non-ASCII characters, so header injection is impossible. */
export function sanitizeAddressHeader(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "");
}

/** Subjects may contain any text except control characters (CR/LF would split a header). */
export function sanitizeSubject(value: string): string {
  return value.replace(/\p{Cc}/gu, " ").slice(0, 200);
}

const ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "invalid_recipient" | "rejected" | "failed" };

/**
 * Sends one plain-text email through Resend. Never throws: callers treat email as best effort and
 * decide what to do with the result. Does nothing (reason "not_configured") when RESEND_API_KEY is unset.
 */
export async function sendEmail(message: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, reason: "not_configured" };
  if (!ADDRESS.test(message.to)) return { sent: false, reason: "invalid_recipient" };

  const from = sanitizeAddressHeader(process.env.EMAIL_FROM ?? "Kokua Counter <noreply@kokuacounter.app>");
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        ...(message.replyTo && ADDRESS.test(message.replyTo) ? { reply_to: message.replyTo } : {}),
        subject: sanitizeSubject(message.subject),
        text: message.text,
      }),
    });
    if (!response.ok) {
      console.error("email: provider rejected the message", response.status);
      return { sent: false, reason: "rejected" };
    }
    return { sent: true };
  } catch (error) {
    console.error("email: send failed", describeError(error));
    return { sent: false, reason: "failed" };
  }
}

/** Sends an operational alert to ALERT_EMAIL (if configured). */
export async function sendOpsAlert(subject: string, lines: string[]): Promise<SendResult> {
  const to = process.env.ALERT_EMAIL?.trim();
  if (!to) return { sent: false, reason: "not_configured" };
  return sendEmail({ to, subject: `[Kōkua Counter] ${subject}`, text: lines.join("\n") });
}
