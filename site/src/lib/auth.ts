import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "fdomain_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getAdminPassword(): string | null {
  const pwd = process.env.ADMIN_PASSWORD?.trim();
  return pwd && pwd.length > 0 ? pwd : null;
}

function getSigningSecret(): string | null {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit.length > 0) return explicit;
  const pwd = getAdminPassword();
  if (!pwd) return null;
  return createHash("sha256").update(`fdomain-session:${pwd}`).digest("hex");
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getAdminPassword());
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  const expectedDigest = createHash("sha256").update(expected).digest();
  const actualDigest = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expectedDigest, actualDigest);
}

interface SessionPayload {
  sub: "admin";
  exp: number;
}

export function createSessionToken(nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const payload: SessionPayload = {
    sub: "admin",
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!token) return false;
  const secret = getSigningSecret();
  if (!secret) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const encoded = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  if (!providedSig) return false;

  const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    return parsed.sub === "admin" && typeof parsed.exp === "number" && parsed.exp > nowSeconds;
  } catch {
    return false;
  }
}

/** Reject cross-site mutating requests where an Origin header conflicts with Host. */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    return originHost === host.toLowerCase();
  } catch {
    return false;
  }
}
