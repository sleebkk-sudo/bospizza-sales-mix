import "server-only";

export const SESSION_COOKIE = "bospizza_sales_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set in the environment");
  return secret;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const signature = await hmac(String(expiresAt), getSecret());
  return `${expiresAt}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const [expiresAtStr, signature] = token.split(".");
  if (!expiresAtStr || !signature) return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await hmac(expiresAtStr, getSecret());
  return expected === signature;
}

export function checkPassword(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
