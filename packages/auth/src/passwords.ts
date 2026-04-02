import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return [HASH_PREFIX, salt, derivedKey].join("$");
}

export function verifyPassword(password: string, passwordHash: string) {
  const [prefix, salt, storedKey] = passwordHash.split("$");

  if (prefix !== HASH_PREFIX || !salt || !storedKey) {
    return false;
  }

  const candidateKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const referenceKey = Buffer.from(storedKey, "hex");

  if (candidateKey.byteLength !== referenceKey.byteLength) {
    return false;
  }

  return timingSafeEqual(candidateKey, referenceKey);
}
