/**
 * One-time browser setup: admin access key + password → first admin row.
 * Additional admins: not supported from this endpoint (use DB if needed).
 */

import { getSupabaseAdmin } from "./_supabase.js";
import bcrypt from "bcryptjs";
import { getAdminAccessKey, isAdminAccessKeyValid } from "./_helpers/admin-access.js";

const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@insuranceclaimletterhelp.ai";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const accessKey = body.accessKey ?? body.setupKey ?? "";
    const password = body.password;

    const supabase = getSupabaseAdmin();

    const { count, error: countError } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "An administrator account already exists. Sign in at /admin-login.html",
        }),
      };
    }

    const serverKey = getAdminAccessKey();
    if (!serverKey) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error:
            "Set ADMIN_ACCESS_KEY in Netlify (or ADMIN_SETUP_KEY), redeploy, then try again.",
        }),
      };
    }

    if (!isAdminAccessKeyValid(accessKey)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Invalid admin access key" }),
      };
    }

    if (!password || typeof password !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Password required" }),
      };
    }

    if (password.length < 12) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Password must be at least 12 characters",
        }),
      };
    }

    const email = DEFAULT_ADMIN_EMAIL.toLowerCase();

    const { data: existing } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Admin user already exists" }),
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: adminUser, error: insertError } = await supabase
      .from("admin_users")
      .insert({
        email,
        password_hash: passwordHash,
        full_name: "Administrator",
        role: "super_admin",
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase.from("admin_activity_log").insert({
      admin_user_id: adminUser.id,
      action: "admin_created",
      resource_type: "admin_users",
      details: { email: adminUser.email },
      ip_address:
        event.headers["x-forwarded-for"] || event.headers["client-ip"],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        email: adminUser.email,
      }),
    };
  } catch (error) {
    console.error("Admin setup error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
