"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Mirrors static /success.html — calls Netlify functions on the same origin in production.
 */
function SuccessInner() {
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Confirming purchase…");

  useEffect(() => {
    const sessionId = sp.get("session_id");
    if (!sessionId) {
      setMsg("Missing session. Redirecting…");
      window.location.href = "/pricing";
      return;
    }

    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const supabase = createClient(url, key);

        const cs = await fetch("/.netlify/functions/create-session-from-stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const csData = await cs.json();
        if (!cs.ok) {
          setMsg(csData.error || "Session error");
          return;
        }
        if (csData.action_link && !csData.token_hash) {
          window.location.href = csData.action_link;
          return;
        }
        if (csData.token_hash) {
          let { error: vErr } = await supabase.auth.verifyOtp({
            token_hash: csData.token_hash,
            type: "email",
          });
          if (vErr) {
            ({ error: vErr } = await supabase.auth.verifyOtp({
              token_hash: csData.token_hash,
              type: "magiclink",
            }));
          }
          if (vErr) {
            setMsg(vErr.message);
            return;
          }
        }

        for (let i = 0; i < 5; i++) {
          const vr = await fetch("/.netlify/functions/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, userId: csData.userId }),
          });
          const vj = await vr.json();
          if (vj.success && !vj.pending) break;
          await new Promise((r) => setTimeout(r, 1200));
        }

        setMsg("Redirecting…");
        window.location.href = "/app";
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Error");
      }
    })();
  }, [sp]);

  return (
    <div
      style={{
        background: "#0f1e35",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div>
        <h1>Payment</h1>
        <p style={{ color: "#cbd5e1" }}>{msg}</p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<p style={{ color: "#fff" }}>Loading…</p>}>
      <SuccessInner />
    </Suspense>
  );
}
