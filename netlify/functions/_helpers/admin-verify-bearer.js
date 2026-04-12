/**
 * Env-only admin: Bearer token must equal ADMIN_ACCESS_KEY (set after login from client).
 */

export function resolveAdminFromBearer(event) {
  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const envKey = process.env.ADMIN_ACCESS_KEY;
  if (envKey && token === envKey) {
    return {
      id: null,
      email: "admin",
      full_name: "Admin",
      role: "super_admin",
      is_active: true,
    };
  }
  return null;
}
