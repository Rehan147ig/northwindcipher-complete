import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { MAX_ACCOUNT_BODY_BYTES, handleAccount, type AccountStore } from './_lib/account.js';

// Server-only: uses SUPABASE_SERVICE_ROLE_KEY, which must never reach the browser bundle.
function createStore(): AccountStore {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('not_configured');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = async (table: string, column: string, userId: string) => {
    const { data, error } = await db.from(table).select('*').eq(column, userId).limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  return {
    async getUser(token) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null, created_at: data.user.created_at ?? null };
    },
    async exportData(userId) {
      return {
        profile: await rows('profiles', 'id', userId),
        project_memberships: await rows('project_memberships', 'user_id', userId),
        projects_owned: await rows('projects', 'owner_user_id', userId),
        reports_filed: await rows('reports', 'reporter_id', userId),
      };
    },
    async ownedProjectCount(userId) {
      const { count, error } = await db.from('projects').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async recordDeletion(userId) {
      const { error } = await db.from('audit_events').insert({ actor_id: null, action: 'account deleted', resource_type: 'user', resource_id: userId });
      if (error) throw new Error(error.message);
    },
    async deleteUser(userId) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}

async function readRaw(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_ACCOUNT_BODY_BYTES + 1) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  try {
    const rawBody = await readRaw(req);
    if (!rawBody) return send(413, { ok: false, error: 'payload_too_large' });
    const result = await handleAccount({ method: req.method || 'GET', headers: req.headers, rawBody }, createStore());
    send(result.status, result.body);
  } catch (err) {
    // Missing configuration is not secret and is the most common setup mistake; anything else stays generic.
    if (err instanceof Error && err.message === 'not_configured') return send(503, { ok: false, error: 'not_configured' });
    send(500, { ok: false, error: 'internal_error' });
  }
}
