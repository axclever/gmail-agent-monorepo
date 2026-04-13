import { prisma } from "@gmail-agent/db";
import { createHash, randomBytes } from "node:crypto";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function generateRawApiToken() {
  return `lr_live_${randomBytes(24).toString("hex")}`;
}

export function hashApiToken(rawToken: string) {
  return sha256(rawToken);
}

export function buildTokenHint(rawToken: string) {
  if (rawToken.length <= 10) return rawToken;
  return `${rawToken.slice(0, 8)}...${rawToken.slice(-4)}`;
}

export async function resolveUserIdByApiToken(rawToken: string) {
  const token = rawToken.trim();
  if (!token) return null;

  const tokenHash = hashApiToken(token);
  const row = await prisma.userApiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true },
  });
  if (!row) return null;

  await prisma.userApiToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return row.userId;
}

export function readApiTokenFromRequest(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const xApiToken = request.headers.get("x-api-token") || "";
  return xApiToken.trim();
}
