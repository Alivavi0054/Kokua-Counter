import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ createSchoolRegistration: vi.fn() }));
vi.mock("@/lib/organization-store", () => ({ createSchoolRegistration: store.createSchoolRegistration }));

import { POST } from "@/app/api/schools/register/route";

let ipCounter = 0;
function registerRequest(overrides: Record<string, string> = {}) {
  ipCounter += 1;
  return new Request("https://app.example.com/api/schools/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `203.0.113.${ipCounter}` },
    body: JSON.stringify({
      schoolName: "Mauka High\r\nBcc: attacker@example.com",
      contactName: "Lei Kahale",
      email: "lei@example.edu",
      ...overrides,
    }),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  store.createSchoolRegistration.mockResolvedValue({ id: "s1", createdAt: "2026-10-08T00:00:00Z" });
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("SCHOOL_REGISTRATION_TO_EMAIL", "team@example.org");
  vi.stubEnv("EMAIL_FROM", "Kokua <noreply@example.org>\r\nBcc: evil@example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/schools/register", () => {
  it("sends the email to SCHOOL_REGISTRATION_TO_EMAIL with header-injection characters stripped", async () => {
    const response = await POST(registerRequest());
    expect(response.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.to).toEqual(["team@example.org"]);
    expect(payload.from).toBe("Kokua <noreply@example.org>Bcc: evil@example.com");
    expect(payload.from).not.toMatch(/[\r\n]/);
    expect(payload.subject).not.toMatch(/[\r\n]/);
  });

  it("skips the email when SCHOOL_REGISTRATION_TO_EMAIL is unset but still saves and succeeds", async () => {
    vi.stubEnv("SCHOOL_REGISTRATION_TO_EMAIL", "");
    const response = await POST(registerRequest());
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.createSchoolRegistration).toHaveBeenCalledTimes(1);
  });

  it("still succeeds and sends the email when the database write fails", async () => {
    store.createSchoolRegistration.mockRejectedValue(new Error("db down"));
    const response = await POST(registerRequest());
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid submissions", async () => {
    const response = await POST(registerRequest({ email: "not-an-email" }));
    expect(response.status).toBe(400);
    expect(store.createSchoolRegistration).not.toHaveBeenCalled();
  });
});
