const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      statusCode: 401,
      headers: cors,
      body: JSON.stringify({ user: null }),
    };
  }

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({ error: "Auth not configured" }),
    };
  }

  const supabase = createClient(url, anon);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      statusCode: 401,
      headers: cors,
      body: JSON.stringify({ user: null, error: error?.message }),
    };
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({
      user: { id: user.id, email: user.email, created_at: user.created_at },
    }),
  };
};
