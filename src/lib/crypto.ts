import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Encrypts SchemaSnapshot payloads at rest — table/column names can reveal a
// customer's data model (e.g. "ssn", "credit_card_number"), decided sensitive
// in /plan-ceo-review Section 3. AES-256-GCM, key derived from a server-only
// secret. Never import this file from a "use client" component.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.SNAPSHOT_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "SNAPSHOT_ENCRYPTION_KEY is not set — required to encrypt/decrypt SchemaSnapshot payloads",
    );
  }
  return scryptSync(secret, "planoo-schema-snapshot", 32);
}

export function encryptPayload(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext, all base64 — self-contained so decryptPayload
  // doesn't need any out-of-band state.
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptPayload(stored: string): string {
  const [ivB64, authTagB64, dataB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload — expected iv:authTag:ciphertext");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
