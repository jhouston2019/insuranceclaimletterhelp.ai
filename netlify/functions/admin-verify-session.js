/**
 * Validates admin: Bearer token === ADMIN_ACCESS_KEY
 */

import { resolveAdminFromBearer } from "./_helpers/admin-verify-bearer.js";

export async function handler(event) {
  const authHeader = event.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ valid: false, error: "No token provided" }),
    };
  }

  const admin = resolveAdminFromBearer(event);
  if (admin) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        user: {
          id: admin.id,
          email: admin.email,
          fullName: admin.full_name,
          role: admin.role,
        },
      }),
    };
  }

  return {
    statusCode: 401,
    body: JSON.stringify({ valid: false, error: "Invalid session" }),
  };
}
