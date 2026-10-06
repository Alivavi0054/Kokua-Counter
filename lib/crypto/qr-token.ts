import { createHash, randomBytes } from "crypto";

export function generateQrToken(): string {
  return randomBytes(16).toString("base64url");
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
