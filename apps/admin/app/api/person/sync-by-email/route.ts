import { prisma } from "@gmail-agent/db";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { readApiTokenFromRequest, resolveUserIdByApiToken } from "@/lib/public-api-auth";

type FieldInput = { key?: unknown; value?: unknown };
type BodyInput = {
  email?: unknown;
  fields?: unknown;
};

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function parseFields(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(input)) return out;
  for (const row of input as FieldInput[]) {
    const key = String(row?.key ?? "").trim();
    if (!key) continue;
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
    const value = String(row?.value ?? "").trim();
    out[key] = value;
  }
  return out;
}

async function resolveUserId(request: Request): Promise<string | null> {
  const token = readApiTokenFromRequest(request);
  if (token) {
    const byToken = await resolveUserIdByApiToken(token);
    if (byToken) return byToken;
    return null;
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (session?.user?.id && role === "ADMIN") return session.user.id;
  return null;
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: BodyInput;
  try {
    body = (await request.json()) as BodyInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ ok: false, error: "email is required." }, { status: 400 });
  }

  const fields = parseFields(body.fields);

  const existing = await prisma.person.findUnique({
    where: { email },
    select: { customFieldsJson: true },
  });
  const mergedFields = {
    ...((existing?.customFieldsJson && typeof existing.customFieldsJson === "object"
      ? (existing.customFieldsJson as Record<string, unknown>)
      : {}) as Record<string, unknown>),
    ...fields,
  };

  const person = await prisma.person.upsert({
    where: { email },
    create: {
      email,
      customFieldsJson: mergedFields as Prisma.InputJsonValue,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
    update: {
      customFieldsJson: mergedFields as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
    },
    select: { id: true, email: true, customFieldsJson: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, person });
}
