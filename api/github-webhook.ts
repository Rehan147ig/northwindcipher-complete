import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { MAX_BODY_BYTES, handleWebhook, type WebhookStore } from './_lib/githubWebhook.js';

// Server-only: SUPABASE_SERVICE_ROLE_KEY and GITHUB_WEBHOOK_SECRET must never be exposed to the browser bundle.
function createStore(): WebhookStore {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('not_configured');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
  return {
    async recordDelivery(d) {
      const { error } = await db.from('webhook_deliveries').insert(d);
      if (!error) return true;
      if ((error as { code?: string }).code === '23505') return false; // unique violation: replayed delivery
      throw new Error(error.message);
    },
    async findRepository(providerRepoId) {
      const { data, error } = await db.from('repositories').select('id').eq('provider_repo_id', providerRepoId).maybeSingle();
      check(error);
      return data as { id: string } | null;
    },
    async upsertIssue(repositoryId, row) {
      check((await db.from('github_issues').upsert({ repository_id: repositoryId, ...row, synced_at: new Date().toISOString() })).error);
    },
    async upsertPullRequest(repositoryId, row) {
      check((await db.from('pull_requests').upsert({ repository_id: repositoryId, ...row, synced_at: new Date().toISOString() })).error);
    },
    async finishDelivery(deliveryId, status, error) {
      check((await db.from('webhook_deliveries').update({ status, error: error ?? null }).eq('delivery_id', deliveryId)).error);
    },
  };
}

async function readRaw(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES + 1) return null;
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
    // Read the stream directly (never touch req.body) so the signature is checked on the exact bytes GitHub sent.
    const rawBody = await readRaw(req);
    if (!rawBody) return send(413, { ok: false, error: 'payload_too_large' });
    const result = await handleWebhook(
      { method: req.method || 'GET', headers: req.headers, rawBody },
      process.env.GITHUB_WEBHOOK_SECRET || '',
      createStore(),
    );
    send(result.status, result.body);
  } catch (err) {
    // Missing configuration is not secret and is the most common setup mistake; anything else stays generic.
    if (err instanceof Error && err.message === 'not_configured') return send(503, { ok: false, error: 'not_configured' });
    // Never echo internal errors (they can contain connection details).
    send(500, { ok: false, error: 'internal_error' });
  }
}
