import { prisma } from "@gmail-agent/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "down", hint: "Set DATABASE_URL on Vercel" },
      { status: 503 },
    );
  }
}
