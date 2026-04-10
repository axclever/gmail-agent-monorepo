"use server";

import { prisma } from "@gmail-agent/db";
import { Prisma } from "@prisma/client";
import type { IntegrationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { decryptJsonSecret } from "@/lib/crypto";
import { requireAdmin } from "../(protected)/require-admin";
import {
  encryptedFieldToCipherString,
  parseBoolean,
  parseHttpIntegrationForm,
  parseSmtpIntegrationForm,
  type SecretPersistOp,
} from "./integration-form-parse";

const TYPES: IntegrationType[] = ["HTTP", "SMTP"];

function applySecretToUpdateData(
  data: Prisma.IntegrationUpdateInput,
  secret: SecretPersistOp,
) {
  if (secret.op === "preserve" || secret.op === "omit") return;
  if (secret.op === "clear") {
    data.encryptedSecretJson = Prisma.JsonNull;
    return;
  }
  data.encryptedSecretJson = secret.encrypted as Prisma.InputJsonValue;
}

export async function createIntegration(formData: FormData) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const name = String(formData.get("name") || "").trim();
  const typeRaw = String(formData.get("type") || "").trim().toUpperCase();
  const isActive = parseBoolean(formData.get("isActive"));

  if (!name) throw new Error("Name is required.");
  if (!TYPES.includes(typeRaw as IntegrationType)) {
    throw new Error("Invalid integration type.");
  }
  const type = typeRaw as IntegrationType;

  let configJson: Prisma.InputJsonValue;
  let secret: SecretPersistOp;

  if (type === "HTTP") {
    const parsed = parseHttpIntegrationForm(formData, "create");
    configJson = parsed.configJson;
    secret = parsed.secret;
  } else {
    const parsed = parseSmtpIntegrationForm(formData, "create", null);
    configJson = parsed.configJson;
    secret = parsed.secret;
  }

  const createData: Prisma.IntegrationCreateInput = {
    user: { connect: { id: userId } },
    type,
    name,
    isActive,
    configJson,
  };
  if (secret.op === "set") {
    createData.encryptedSecretJson = secret.encrypted as Prisma.InputJsonValue;
  }

  await prisma.integration.create({ data: createData });

  revalidatePath("/integrations");
}

export type IntegrationEditPayload =
  | {
      id: string;
      name: string;
      isActive: boolean;
      type: "HTTP";
      baseUrl: string;
      method: string;
      headersText: string;
      authHeadersText: string;
    }
  | {
      id: string;
      name: string;
      isActive: boolean;
      type: "SMTP";
      host: string;
      port: string;
      secure: boolean;
      fromEmail: string;
      username: string;
    };

export async function getIntegrationForEdit(id: string): Promise<IntegrationEditPayload | null> {
  const session = await requireAdmin();
  const row = await prisma.integration.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) return null;

  if (row.type === "HTTP") {
    const c = (row.configJson as Record<string, unknown>) || {};
    const headers =
      c.headers && typeof c.headers === "object" && !Array.isArray(c.headers)
        ? (c.headers as Record<string, unknown>)
        : {};
    const headersText = Object.keys(headers).length > 0 ? JSON.stringify(headers, null, 2) : "";

    let authHeadersText = "";
    const cipher = encryptedFieldToCipherString(row.encryptedSecretJson);
    if (cipher) {
      try {
        const d = decryptJsonSecret<Record<string, string>>(cipher);
        authHeadersText = JSON.stringify(d, null, 2);
      } catch {
        authHeadersText = "";
      }
    }

    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      type: "HTTP",
      baseUrl: String(c.baseUrl ?? ""),
      method: String(c.method ?? "POST"),
      headersText,
      authHeadersText,
    };
  }

  const c = (row.configJson as Record<string, unknown>) || {};
  const cipher = encryptedFieldToCipherString(row.encryptedSecretJson);
  let username = "";
  if (cipher) {
    try {
      const d = decryptJsonSecret<Record<string, string>>(cipher);
      username = String(d.username ?? "");
    } catch {
      username = "";
    }
  }

  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    type: "SMTP",
    host: String(c.host ?? ""),
    port: c.port != null && c.port !== "" ? String(c.port) : "",
    secure: Boolean(c.secure),
    fromEmail: String(c.fromEmail ?? ""),
    username,
  };
}

export async function updateIntegration(formData: FormData) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const id = String(formData.get("integrationId") || "").trim();
  if (!id) throw new Error("Missing integration id.");

  const existing = await prisma.integration.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new Error("Integration not found.");

  const name = String(formData.get("name") || "").trim();
  const isActive = parseBoolean(formData.get("isActive"));
  if (!name) throw new Error("Name is required.");

  let configJson: Prisma.InputJsonValue;
  let secret: SecretPersistOp;

  if (existing.type === "HTTP") {
    const parsed = parseHttpIntegrationForm(formData, "update");
    configJson = parsed.configJson;
    secret = parsed.secret;
  } else {
    const parsed = parseSmtpIntegrationForm(formData, "update", existing.encryptedSecretJson);
    configJson = parsed.configJson;
    secret = parsed.secret;
  }

  const data: Prisma.IntegrationUpdateInput = {
    name,
    isActive,
    configJson,
  };
  applySecretToUpdateData(data, secret);

  await prisma.integration.update({
    where: { id },
    data,
  });

  revalidatePath("/integrations");
}

export async function deleteIntegration(id: string) {
  const session = await requireAdmin();
  const userId = session.user.id;

  const res = await prisma.integration.deleteMany({
    where: { id, userId },
  });
  if (res.count === 0) throw new Error("Integration not found.");

  revalidatePath("/integrations");
}
