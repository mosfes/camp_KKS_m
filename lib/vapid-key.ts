function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  const first = trimmed.at(0);
  const last = trimmed.at(-1);

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normalizeBase64Url(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = stripWrappingQuotes(value)
    .replace(/\s+/g, "")
    .replace(/=+$/g, "");

  return normalized && /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : null;
}

export function normalizeVapidPublicKey(value: unknown) {
  const normalized = normalizeBase64Url(value);

  // A P-256 uncompressed public key is 65 bytes, or 87 base64url characters
  // without padding.
  return normalized?.length === 87 ? normalized : null;
}

export function normalizeVapidPrivateKey(value: unknown) {
  const normalized = normalizeBase64Url(value);

  // A P-256 private key is 32 bytes, or 43 base64url characters without
  // padding.
  return normalized?.length === 43 ? normalized : null;
}

export function normalizeEnvironmentUrl(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = stripWrappingQuotes(value);

  return normalized || null;
}
