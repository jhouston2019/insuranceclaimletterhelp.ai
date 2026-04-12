/**
 * Admin Logs
 * Returns system logs
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

    // Get logs
    const { data: logs, error } = await supabase
      .from('structured_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    // Log access
    await supabase.from('admin_activity_log').insert({
      admin_user_id: adminUser.id,
      action: 'view_logs',
      resource_type: 'structured_logs',
      ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip']
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        logs: logs || []
      })
    };

  } catch (error) {
    console.error('Admin logs error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
