import { beforeAll, describe, expect, it } from "vitest";
import { decryptPayload, encryptPayload } from "./crypto";

beforeAll(() => {
  process.env.SNAPSHOT_ENCRYPTION_KEY = "test-only-secret-do-not-use-in-prod";
});

describe("encryptPayload / decryptPayload", () => {
  it("round-trips arbitrary text", () => {
    const plaintext = JSON.stringify({ tables: ["users", "orders"], columns: 42 });
    const encrypted = encryptPayload(plaintext);
    expect(decryptPayload(encrypted)).toBe(plaintext);
  });

  it("produces ciphertext that does not contain the plaintext", () => {
    const plaintext = "ssn,credit_card_number";
    const encrypted = encryptPayload(plaintext);
    expect(encrypted).not.toContain(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const plaintext = "same input";
    expect(encryptPayload(plaintext)).not.toBe(encryptPayload(plaintext));
  });

  it("throws on a malformed stored payload", () => {
    expect(() => decryptPayload("not-a-valid-payload")).toThrow();
  });

  it("throws when the auth tag has been tampered with", () => {
    const encrypted = encryptPayload("sensitive data");
    const [iv, authTag, data] = encrypted.split(":");
    const tampered = [iv, authTag.slice(0, -2) + "AA", data].join(":");
    expect(() => decryptPayload(tampered)).toThrow();
  });
});
