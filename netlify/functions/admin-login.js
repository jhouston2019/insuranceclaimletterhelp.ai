exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const accessKey = body.accessKey;
    const password = body.password;

    console.log("=== DEBUG START ===");
    console.log("ENV KEY:", process.env.ADMIN_ACCESS_KEY);
    console.log("ENV PASS:", process.env.ADMIN_PASSWORD);
    console.log("INPUT KEY:", accessKey);
    console.log("INPUT PASS:", password);

    // HARD TEST (bypass env completely)
    if (accessKey === "InsLett2026" && password === "InsLett2026!") {
      console.log("HARDCODE MATCH SUCCESS");
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      };
    }

    console.log("HARDCODE MATCH FAILED");

    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid credentials" }),
    };

  } catch (err) {
    console.log("ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
