import type { IntegrationType, Prisma } from "@prisma/client";
import { encryptJsonSecret } from "@/lib/crypto";
import { decryptJsonSecret } from "@/lib/crypto";

function trimOrUndef(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

export function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

/** How to persist encryptedSecretJson after parse. */
export type SecretPersistOp =
  | { op: "omit" }
  | { op: "set"; encrypted: string }
  | { op: "preserve" }
  | { op: "clear" };

export function encryptedFieldToCipherString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const parts = raw.split(".");
    return parts.length === 3 ? raw : null;
  }
  return null;
}

export function parseHttpIntegrationForm(
  formData: FormData,
  mode: "create" | "update",
): { configJson: Prisma.InputJsonValue; secret: SecretPersistOp } {
  const baseUrl = trimOrUndef(formData.get("config_baseUrl"));
  const method = trimOrUndef(formData.get("config_method")) || "POST";
  const headersText = String(formData.get("config_headers") || "").trim();
  let headers: Record<string, string> = {};
  if (headersText) {
    try {
      const parsed = JSON.parse(headersText) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        headers = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        );
      }
    } catch {
      throw new Error("Headers must be valid JSON object.");
    }
  }
  if (!baseUrl) {
    throw new Error("Base URL is required for HTTP integrations.");
  }
  const configJson: Prisma.InputJsonValue = {
    baseUrl,
    method,
    ...(Object.keys(headers).length ? { headers } : {}),
  };

  const authHeadersText = String(formData.get("secret_authHeadersJson") ?? "").trim();

  if (mode === "create") {
    if (!authHeadersText) {
      return { configJson, secret: { op: "omit" } };
    }
    try {
      const parsed = JSON.parse(authHeadersText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Auth headers must be a JSON object.");
      }
      const authHeaders = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
      );
      if (Object.keys(authHeaders).length === 0) {
        throw new Error("Auth headers object must have at least one key.");
      }
      return { configJson, secret: { op: "set", encrypted: encryptJsonSecret(authHeaders) } };
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Auth headers")) throw e;
      throw new Error("Auth headers must be valid JSON object.");
    }
  }

  // update: empty textarea = keep existing ciphertext
  if (authHeadersText === "") {
    return { configJson, secret: { op: "preserve" } };
  }
  try {
    const parsed = JSON.parse(authHeadersText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Auth headers must be a JSON object.");
    }
    const authHeaders = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
    if (Object.keys(authHeaders).length === 0) {
      return { configJson, secret: { op: "clear" } };
    }
    return { configJson, secret: { op: "set", encrypted: encryptJsonSecret(authHeaders) } };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Auth headers")) throw e;
    throw new Error("Auth headers must be valid JSON object.");
  }
}

export function parseSmtpIntegrationForm(
  formData: FormData,
  mode: "create" | "update",
  existingEncrypted: unknown,
): { configJson: Prisma.InputJsonValue; secret: SecretPersistOp } {
  const host = trimOrUndef(formData.get("config_host"));
  const portRaw = String(formData.get("config_port") || "").trim();
  const port = portRaw ? Number(portRaw) : undefined;
  const secure = parseBoolean(formData.get("config_secure"));
  const fromEmail = trimOrUndef(formData.get("config_fromEmail"));
  const configJson: Prisma.InputJsonValue = {
    ...(host != null ? { host } : {}),
    ...(port != null && Number.isFinite(port) ? { port } : {}),
    secure,
    ...(fromEmail != null ? { fromEmail } : {}),
  };

  const usernameInput = String(formData.get("secret_username") ?? "").trim();
  const passwordInput = String(formData.get("secret_password") ?? "").trim();

  let old: { username?: string; password?: string } = {};
  const cipher = encryptedFieldToCipherString(existingEncrypted);
  if (cipher) {
    try {
      old = decryptJsonSecret<Record<string, string>>(cipher) as { username?: string; password?: string };
    } catch {
      old = {};
    }
  }

  const username = usernameInput || old.username || "";
  const password = passwordInput || old.password || "";

  if (!username && !password) {
    if (mode === "update" && cipher) {
      return { configJson, secret: { op: "preserve" } };
    }
    return { configJson, secret: { op: "omit" } };
  }

  return {
    configJson,
    secret: { op: "set", encrypted: encryptJsonSecret({ username, password }) },
  };
}
