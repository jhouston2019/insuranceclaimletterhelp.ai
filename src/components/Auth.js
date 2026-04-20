import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

/**
 * Passwordless login — magic link / OTP email only.
 * @param {string} email
 * @param {string} emailRedirectTo - Full URL (e.g. origin + /app?session_id=…)
 */
export async function signInWithMagicLink(email, emailRedirectTo) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: emailRedirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/app` : undefined),
    },
  });
}

/** @deprecated Use signInWithMagicLink — kept only for unusual tooling */
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** @deprecated Prefer signInWithMagicLink for new accounts */
export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
