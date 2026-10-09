import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeAddressHeader, sanitizeSubject, sendEmail, sendOpsAlert } from "@/lib/email";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Kokua <noreply@example.org>");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("sendEmail", () => {
  it("sends through Resend with sanitized headers", async () => {
    vi.stubEnv("EMAIL_FROM", "Kokua <noreply@example.org>\r\nBcc: evil@example.com");
    const result = await sendEmail({ to: "donor@example.com", subject: "Receipt\r\nBcc: x@y.z", text: "hi" }, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(init.body);
    expect(payload.from).not.toMatch(/[\r\n]/);
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.to).toEqual(["donor@example.com"]);
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
  });

  it("does nothing when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendEmail({ to: "a@b.co", subject: "s", text: "t" }, fetchMock as unknown as typeof fetch)).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses obviously invalid or header-injecting recipients", async () => {
    for (const to of ["nope", "a@b", "a@b.co\r\nBcc: x@y.z", "a b@c.de", ""]) {
      expect(await sendEmail({ to, subject: "s", text: "t" }, fetchMock as unknown as typeof fetch), to).toEqual({ sent: false, reason: "invalid_recipient" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports provider rejection and network failure instead of throwing", async () => {
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 422 }));
    expect(await sendEmail({ to: "a@b.co", subject: "s", text: "t" }, fetchMock as unknown as typeof fetch)).toEqual({ sent: false, reason: "rejected" });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await sendEmail({ to: "a@b.co", subject: "s", text: "t" }, fetchMock as unknown as typeof fetch)).toEqual({ sent: false, reason: "failed" });
  });

  it("only includes a valid reply-to", async () => {
    await sendEmail({ to: "a@b.co", subject: "s", text: "t", replyTo: "bad" }, fetchMock as unknown as typeof fetch);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBeUndefined();
  });
});

describe("helpers", () => {
  it("sanitizes headers", () => {
    expect(sanitizeAddressHeader("A\r\nB ō")).toBe("AB ");
    expect(sanitizeSubject("Hello\nWorld ō")).toBe("Hello World ō");
    expect(sanitizeSubject("x".repeat(500))).toHaveLength(200);
  });

  it("alerts go to ALERT_EMAIL only when it is set", async () => {
    expect(await sendOpsAlert("s", ["l"])).toEqual({ sent: false, reason: "not_configured" });
  });
});
