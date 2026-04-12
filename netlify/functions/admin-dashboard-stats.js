/**
 * Admin Dashboard Stats
 * Returns comprehensive dashboard statistics
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

    // Get dashboard stats view
    const { data: stats, error: statsError } = await supabase
      .from('admin_dashboard_stats')
      .select('*')
      .single();

    if (statsError) {
      console.error('Stats error:', statsError);
    }

    // Get recent activity view
    const { data: recentActivity, error: activityError } = await supabase
      .from('admin_recent_activity')
      .select('*')
      .limit(20);

    if (activityError) {
      console.error('Activity error:', activityError);
    }

    // Log access
    await supabase.from('admin_activity_log').insert({
      admin_user_id: adminUser.id,
      action: 'view_dashboard',
      resource_type: 'dashboard',
      ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip']
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        stats: stats || {},
        recentActivity: recentActivity || []
      })
    };

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
