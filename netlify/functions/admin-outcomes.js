/**
 * Admin Outcomes
 * Returns outcome tracking data
 */

import { getSupabaseAdmin } from "./_supabase.js";
import { resolveAdminFromBearer } from "./_helpers/admin-verify-bearer.js";

export async function handler(event) {
  const adminUser = resolveAdminFromBearer(event);
  if (!adminUser) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get outcomes
    const { data: outcomes, error } = await supabase
      .from('outcome_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    // Log access
    await supabase.from('admin_activity_log').insert({
      admin_user_id: adminUser.id,
      action: 'view_outcomes',
      resource_type: 'outcome_tracking',
      ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip']
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        outcomes: outcomes || []
      })
    };

  } catch (error) {
    console.error('Admin outcomes error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
