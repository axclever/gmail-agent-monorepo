const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

function ensureLocalEnvLoaded() {
  if (process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV === "production") return;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    // Lazy require to avoid dotenv dependency in prod path unless needed.
    // eslint-disable-next-line global-require
    require("dotenv").config({ path: envPath });
    if (process.env.DATABASE_URL) return;
  }
}

ensureLocalEnvLoaded();

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = { prisma };
