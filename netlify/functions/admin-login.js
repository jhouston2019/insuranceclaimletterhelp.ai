/**
 * Admin Login
 * Admin access key (env) + password (stored hash) for the primary admin user.
 */

import { getSupabaseAdmin } from "./_supabase.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getAdminAccessKey, isAdminAccessKeyValid } from "./_helpers/admin-access.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const envAccessKey = getAdminAccessKey();
    // Old pages sent { email, password }; treat that email field as the access key when env key is configured.
    let accessKey = body.accessKey ?? body.setupKey ?? "";
    if (!accessKey && envAccessKey && body.email) {
      accessKey = String(body.email);
    }
    const password = body.password;
    const legacyEmail = body.email;

    if (!password) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Password required",
        }),
      };
    }

    const supabase = getSupabaseAdmin();

    let adminUser = null;

    if (envAccessKey) {
      if (!isAdminAccessKeyValid(accessKey)) {
        await supabase.from("admin_activity_log").insert({
          action: "login_failed",
          resource_type: "admin_auth",
          details: { reason: "invalid_access_key" },
          ip_address:
            event.headers["x-forwarded-for"] || event.headers["client-ip"],
        });
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid credentials" }),
        };
      }

      const { data: rows, error: listError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);

      if (listError || !rows?.length) {
        await supabase.from("admin_activity_log").insert({
          action: "login_failed",
          resource_type: "admin_auth",
          details: { reason: "user_not_found" },
          ip_address:
            event.headers["x-forwarded-for"] || event.headers["client-ip"],
        });
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid credentials" }),
        };
      }
      adminUser = rows[0];
    } else if (legacyEmail) {
      const { data, error: userError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("email", String(legacyEmail).toLowerCase())
        .eq("is_active", true)
        .maybeSingle();
      if (!userError && data) {
        adminUser = data;
      }
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Admin access key and password required (set ADMIN_ACCESS_KEY in Netlify)",
        }),
      };
    }

    if (!adminUser) {
      await supabase.from("admin_activity_log").insert({
        action: "login_failed",
        resource_type: "admin_auth",
        details: { reason: "user_not_found" },
        ip_address:
          event.headers["x-forwarded-for"] || event.headers["client-ip"],
      });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid credentials" }),
      };
    }

    const passwordValid = await bcrypt.compare(
      password,
      adminUser.password_hash
    );

    if (!passwordValid) {
      await supabase.from("admin_activity_log").insert({
        admin_user_id: adminUser.id,
        action: "login_failed",
        resource_type: "admin_auth",
        details: { reason: "invalid_password" },
        ip_address:
          event.headers["x-forwarded-for"] || event.headers["client-ip"],
      });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid credentials" }),
      };
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error: sessionError } = await supabase
      .from("admin_sessions")
      .insert({
        admin_user_id: adminUser.id,
        session_token: sessionToken,
        ip_address:
          event.headers["x-forwarded-for"] || event.headers["client-ip"],
        user_agent: event.headers["user-agent"],
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      throw sessionError;
    }

    await supabase
      .from("admin_users")
      .update({
        last_login_at: new Date().toISOString(),
        login_count: (adminUser.login_count || 0) + 1,
      })
      .eq("id", adminUser.id);

    await supabase.from("admin_activity_log").insert({
      admin_user_id: adminUser.id,
      action: "login_success",
      resource_type: "admin_auth",
      details: { email: adminUser.email },
      ip_address:
        event.headers["x-forwarded-for"] || event.headers["client-ip"],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        user: {
          email: adminUser.email,
          fullName: adminUser.full_name,
          role: adminUser.role,
        },
      }),
    };
  } catch (error) {
    console.error("Admin login error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
