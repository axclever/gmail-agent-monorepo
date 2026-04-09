import { prisma } from "@gmail-agent/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
};

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
    return NextResponse.redirect(new URL("/main?gmail=missing_code", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/main?gmail=missing_env", request.url));
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
    return NextResponse.redirect(new URL("/main?gmail=token_error", request.url));
  }

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/main?gmail=token_error", request.url));
  }

  const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!meRes.ok) {
    return NextResponse.redirect(new URL("/main?gmail=userinfo_error", request.url));
  }

  const me = (await meRes.json()) as GoogleUserInfo;
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

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
      },
    });
  }

  return NextResponse.redirect(new URL("/main?gmail=connected", request.url));
}

