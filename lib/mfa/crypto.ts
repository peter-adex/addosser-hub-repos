import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function loadKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "MFA_ENCRYPTION_KEY is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` " +
        "and add it to your environment before enabling 2FA.",
    );
  }

  let key: Buffer;
  try {
    const asBase64 = Buffer.from(raw, "base64");
    if (asBase64.length === 32) {
      key = asBase64;
    } else {
      const asHex = Buffer.from(raw, "hex");
      key = asHex;
    }
  } catch {
    throw new Error("MFA_ENCRYPTION_KEY is not valid base64 or hex.");
  }

  if (key.length !== 32) {
    throw new Error(
      `MFA_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM ` +
        `(got ${key.length}). Regenerate it.`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unrecognized MFA secret ciphertext format.");
  }
  const [, ivB64, authTagB64, ciphertextB64] = parts;

  const key = loadKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
