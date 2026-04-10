import { prisma } from "@gmail-agent/db";
import { authOptions } from "@/lib/auth";
import { fetchGmailSendAsEmails } from "@/lib/gmail-send-as";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type GoogleTokenResponse = {
  access_token: string;
  /** Lifetime in seconds (RFC 6749). May be a string in edge cases. */
  expires_in?: number | string;
  /** Seconds until refresh token expires (Google includes when applicable). Prefer for “re-auth by” UI. */
  refresh_token_expires_in?: number | string;
  /** Absolute expiry if the provider sends it (unix seconds or ms, or ISO string). */
  expires_at?: number | string;
  expiresAt?: number | string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
};

function parsePositiveSeconds(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const secs = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}

function resolveTokenExpiresAt(tokens: GoogleTokenResponse): Date {
  const refreshSecs = parsePositiveSeconds(tokens.refresh_token_expires_in);
  if (refreshSecs !== null) {
    return new Date(Date.now() + refreshSecs * 1000);
  }

  const absolute = tokens.expiresAt ?? tokens.expires_at;
  if (absolute !== undefined && absolute !== null && absolute !== "") {
    if (typeof absolute === "string") {
      const trimmed = absolute.trim();
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        if (Number.isFinite(n)) {
          return new Date(n < 1e12 ? n * 1000 : n);
        }
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) return new Date(parsed);
    }
    if (typeof absolute === "number" && Number.isFinite(absolute)) {
      return new Date(absolute < 1e12 ? absolute * 1000 : absolute);
    }
  }

  const accessSecs = parsePositiveSeconds(tokens.expires_in);
  const delta = accessSecs ?? 3600;
  return new Date(Date.now() + delta * 1000);
}

type GoogleUserInfo = {
  sub: string;
  email: string;
  name?: string;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/inbox?gmail=missing_code", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/inbox?gmail=missing_env", request.url));
  }

  const appBaseUrl = process.env.NEXTAUTH_URL || url.origin;
  const redirectUri = `${appBaseUrl}/api/gmail/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/inbox?gmail=token_error", request.url));
  }

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/inbox?gmail=token_error", request.url));
  }

  const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!meRes.ok) {
    return NextResponse.redirect(new URL("/inbox?gmail=userinfo_error", request.url));
  }

  const me = (await meRes.json()) as GoogleUserInfo;
  const tokenExpiresAt = resolveTokenExpiresAt(tokens);

  const raw = tokens as Record<string, unknown>;
  console.log("[gmail/callback] OAuth token response (secrets omitted):", {
    keys: Object.keys(raw),
    expires_in: raw.expires_in,
    refresh_token_expires_in: raw.refresh_token_expires_in,
    expires_at: raw.expires_at,
    expiresAt: raw.expiresAt,
    token_type: raw.token_type,
    scope: raw.scope,
    resolvedTokenExpiresAtISO: tokenExpiresAt.toISOString(),
  });

  let sendAsEmails: string[] = [];
  try {
    sendAsEmails = await fetchGmailSendAsEmails(tokens.access_token);
  } catch (e) {
    console.warn("[gmail/callback] sendAs fetch failed (reconnect with updated scopes if needed):", e);
  }

  const existing = await prisma.gmailMailbox.findFirst({
    where: { userId: session.user.id, email: me.email },
    select: { id: true, refreshToken: true },
  });

  if (existing) {
    await prisma.gmailMailbox.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        provider: "GMAIL",
        email: me.email,
        googleAccountId: me.sub,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existing.refreshToken ?? null,
        tokenExpiresAt,
        sendAsEmails,
      },
    });
  } else {
    await prisma.gmailMailbox.create({
      data: {
        userId: session.user.id,
        provider: "GMAIL",
        status: "ACTIVE",
        email: me.email,
        googleAccountId: me.sub,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt,
        sendAsEmails,
      },
    });
  }

  return NextResponse.redirect(new URL("/inbox?gmail=connected", request.url));
}

