import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
  const value = process.env.MASTER_ENCRYPTION_KEY;
  if (!value) {
    throw new Error("Missing MASTER_ENCRYPTION_KEY");
  }

  const key = Buffer.from(value, "base64");

  if (key.length !== 32) {
    throw new Error("MASTER_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
}

export function encryptJsonSecret(data: unknown): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const cipher = createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptJsonSecret<T = unknown>(encrypted: string): T {
  const key = getMasterKey();

  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivB64, tagB64, ciphertextB64] = parts;

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
