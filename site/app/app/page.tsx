"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Plan routing: single → /upload; premier / enterprise / default → /dashboard
 * Requires Supabase session (set env for local Next dev).
 */
function AppGateInner() {
  const sp = useSearchParams();
  const [line, setLine] = useState("Checking your account…");

  useEffect(() => {
    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const supabase = createClient(url, key);

      const recoverSession = sp.get("session_id");
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        const redir = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.href = "/login.html?redirect=" + redir;
        return;
      }

      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessionErr || !token) {
        const redir = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.href = "/login.html?redirect=" + redir;
        return;
      }

      const bill = await fetch("/.netlify/functions/billing-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const b = await bill.json();

      if (b.paid === false) {
        setLine("Payment required.");
        window.location.href = "/pricing";
        return;
      }

      const plan = String(b.plan_type || "single").toLowerCase();
      let target = "/dashboard";
      if (plan === "single") target = "/upload";
      else if (plan === "premier" || plan === "enterprise") target = "/dashboard";

      if (recoverSession) {
        await fetch("/api/verify-payment", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session_id: recoverSession }),
        });
      }

      window.location.replace(target);
    })();
  }, [sp]);

  return <p style={{ color: "#e2e8f0", padding: 24 }}>{line}</p>;
}

export default function AppPage() {
  return (
    <div style={{ background: "#0f172a", minHeight: "100vh" }}>
      <Suspense fallback={<p style={{ color: "#fff" }}>…</p>}>
        <AppGateInner />
      </Suspense>
    </div>
  );
}
