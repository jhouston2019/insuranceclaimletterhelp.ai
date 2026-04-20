/**
 * Billing reads: user_entitlements + user_review_usage only.
 * "paid" is true only when user_entitlements.paid === true and active.
 * No claim_letters inference.
 */

const { getSupabaseAdmin } = require("./_supabase");

const PLAN_LIMITS = {
  single: { reviews: 1 },
  premier: { reviews: 25 },
  enterprise: { reviews: -1 },
  STANDARD: { reviews: 1 },
  COMPLEX: { reviews: 1 },
  STARTER: { reviews: 1 },
  PRO: { reviews: 3 },
  PROPLUS: { reviews: -1 },
  FREE: { reviews: 0 },
};

function reviewCapForPlan(planType) {
  const row = PLAN_LIMITS[planType] || PLAN_LIMITS.single;
  return row.reviews;
}

/**
 * @param {string} [userId]
 */
async function getBillingSnapshot(userId) {
  const supabase = getSupabaseAdmin();

  if (!userId) {
    return {
      userId: null,
      plan_type: "none",
      paid: false,
      active: false,
      renewalDate: null,
      usage: { used: 0, limit: 0 },
    };
  }

  const { data: ent } = await supabase
    .from("user_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: usageRow } = await supabase
    .from("user_review_usage")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const planType = ent?.plan_type || "single";
  const active = ent?.active !== false;
  const paid =
    ent?.paid === true && active === true ? true : false;

  let renewalDate = ent?.current_period_end || null;

  let sub = null;
  try {
    const r = await supabase
      .from("subscriptions")
      .select("current_period_end, plan_type, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!r.error) sub = r.data;
  } catch (_) {
    sub = null;
  }

  if (sub?.current_period_end) {
    renewalDate = sub.current_period_end || renewalDate;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let used = usageRow?.review_count ?? 0;
  if (usageRow?.period_start) {
    const ps = new Date(usageRow.period_start);
    if (ps < monthStart) used = 0;
  }

  const limit = reviewCapForPlan(planType);

  return {
    userId,
    plan_type: planType,
    paid,
    active,
    renewalDate,
    usage: { used, limit },
  };
}

/**
 * @param {string} userId
 */
async function recordReviewUsageIncrement(userId) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: row } = await supabase
    .from("user_review_usage")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let next = 1;
  let periodStart = monthStart.toISOString();
  if (row) {
    const ps = row.period_start ? new Date(row.period_start) : monthStart;
    const sameMonth = ps >= monthStart;
    const base = sameMonth ? row.review_count || 0 : 0;
    next = base + 1;
    periodStart = sameMonth ? row.period_start : monthStart.toISOString();
  }

  await supabase.from("user_review_usage").upsert(
    {
      user_id: userId,
      review_count: next,
      period_start: periodStart,
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );

  return { review_count: next };
}

module.exports = {
  getBillingSnapshot,
  recordReviewUsageIncrement,
  reviewCapForPlan,
};
