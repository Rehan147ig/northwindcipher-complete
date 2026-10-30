import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { handleAdmin, type AdminStore } from './_lib/admin.js';

// Server-only: uses SUPABASE_SERVICE_ROLE_KEY, which must never reach the browser bundle.
function createStore(): AdminStore {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('not_configured');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async getUser(token) {
      const { data, error } = await db.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },
    async isModerator(userId) {
      const { data, error } = await db.from('app_roles').select('role').eq('user_id', userId).in('role', ['moderator', 'owner']).limit(1);
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async recentDeliveries(limit) {
      const { data, error } = await db.from('webhook_deliveries')
        .select('delivery_id,event_type,provider_repo_id,received_at,status,attempts,error')
        .order('received_at', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  try {
    const result = await handleAdmin({ method: req.method || 'GET', url: req.url || '/', headers: req.headers }, createStore());
    send(result.status, result.body);
  } catch (err) {
    if (err instanceof Error && err.message === 'not_configured') return send(503, { ok: false, error: 'not_configured' });
    send(500, { ok: false, error: 'internal_error' });
  }
}
