/**
 * Whether first-time browser setup is available (no admins yet + access key configured).
 */

import { getSupabaseAdmin } from "./_supabase.js";
import { getAdminAccessKey } from "./_helpers/admin-access.js";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        ...jsonHeaders,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    const firstTime = (count ?? 0) === 0;
    const hasAccessKey = !!getAdminAccessKey();
    const canCreateFirstAdmin = firstTime && hasAccessKey;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        firstTime,
        canCreateFirstAdmin,
      }),
    };
  } catch (e) {
    console.error("admin-setup-status:", e);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: "Could not read admin status" }),
    };
  }
}
