"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Mirrors static /success.html — calls Netlify functions on the same origin in production.
 * verify-payment requires Authorization: Bearer <access_token> on every request.
 */
function SuccessInner() {
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Confirming purchase…");
  const [err, setErr] = useState<string | null>(null);

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
          setErr(csData.error || "Session error");
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
            setErr(vErr.message);
            return;
          }
        }

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) {
          setErr("Authentication failed. Please return to pricing and try again.");
          return;
        }

        const {
          data: { session: sessionAfter },
          error: sessionErr,
        } = await supabase.auth.getSession();
        if (sessionErr || !sessionAfter?.access_token) {
          setErr("Authentication failed. Please return to pricing and try again.");
          return;
        }

        let unlocked = false;
        for (let i = 0; i < 24; i++) {
          const {
            data: { session: pollSession },
          } = await supabase.auth.getSession();
          const token = pollSession?.access_token;
          if (!token) {
            setErr("Session expired. Please sign in again.");
            return;
          }

          const vr = await fetch("/api/verify-payment", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ session_id: sessionId }),
          });
          const vj = await vr.json();
          if (vr.status === 401) {
            setErr(vj.message || "Not authorized to verify payment.");
            return;
          }
          const done = vj.success === true && vj.pending !== true;
          if (done) {
            unlocked = true;
            break;
          }
          if (vj.status === "invalid" || vj.status === "failed") {
            setErr(vj.message || "Payment verification failed.");
            return;
          }
          await new Promise((r) => setTimeout(r, 1200));
        }
        if (!unlocked) {
          setMsg("Still finalizing unlock — continuing to your account.");
        }

        setMsg("Redirecting…");
        window.location.href = "/app";
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Error");
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
        {err ? (
          <p style={{ color: "#fca5a5", maxWidth: 480, margin: "0 auto" }}>{err}</p>
        ) : (
          <p style={{ color: "#cbd5e1" }}>{msg}</p>
        )}
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
