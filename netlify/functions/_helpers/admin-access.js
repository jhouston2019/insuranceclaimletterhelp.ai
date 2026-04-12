import crypto from "crypto";

/** Site-wide secret: prefer ADMIN_ACCESS_KEY; ADMIN_SETUP_KEY kept for older deploys. */
export function getAdminAccessKey() {
  return process.env.ADMIN_ACCESS_KEY || process.env.ADMIN_SETUP_KEY || "";
}

export function isAdminAccessKeyValid(provided) {
  const key = getAdminAccessKey();
  if (!key || typeof provided !== "string") return false;
  const a = Buffer.from(key, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
