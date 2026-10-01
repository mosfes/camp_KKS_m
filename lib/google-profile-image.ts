import cloudinary, { isCloudinaryConfigured } from "@/config/cloudinary";

export type GoogleProfileAccountType = "student" | "teacher";

const GOOGLE_PROFILE_FOLDER = "camp_google_profiles";

/**
 * Clerk normally proxies Google avatars through img.clerk.com. Accept only
 * Clerk and Google delivery hosts so this helper cannot become a generic
 * server-side URL fetcher.
 */
export function isTrustedGoogleProfileImageUrl(
  value: unknown,
): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") return false;

    return (
      hostname === "googleusercontent.com" ||
      hostname.endsWith(".googleusercontent.com") ||
      hostname === "clerk.com" ||
      hostname.endsWith(".clerk.com") ||
      hostname === "clerk.dev" ||
      hostname.endsWith(".clerk.dev")
    );
  } catch {
    return false;
  }
}

export function getGoogleProfilePublicId(
  accountType: GoogleProfileAccountType,
  accountId: number,
): string {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error("Invalid account ID for Google profile image");
  }

  return `${GOOGLE_PROFILE_FOLDER}/${accountType}_${accountId}/profile`;
}

/**
 * Copy a Google/Clerk avatar into the app's persistent Cloudinary storage.
 * A deterministic public ID makes concurrent first logins idempotent.
 */
export async function cacheGoogleProfileImage(input: {
  sourceUrl: unknown;
  accountType: GoogleProfileAccountType;
  accountId: number;
}): Promise<string | null> {
  if (
    !isCloudinaryConfigured() ||
    !isTrustedGoogleProfileImageUrl(input.sourceUrl)
  ) {
    return null;
  }

  const result = await cloudinary.uploader.upload(input.sourceUrl, {
    public_id: getGoogleProfilePublicId(input.accountType, input.accountId),
    resource_type: "image",
    overwrite: true,
    unique_filename: false,
    invalidate: false,
    format: "webp",
    timeout: 10000,
    transformation: [
      { width: 512, height: 512, crop: "fill", gravity: "face" },
      { quality: "auto" },
    ],
  });

  return typeof result.secure_url === "string" ? result.secure_url : null;
}
