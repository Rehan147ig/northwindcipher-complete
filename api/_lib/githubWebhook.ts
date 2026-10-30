import { createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_BODY_BYTES = 1_000_000;
const SYNCED_EVENTS = new Set(['issues', 'pull_request']);
const ACKNOWLEDGED_EVENTS = new Set(['ping', 'installation', 'installation_repositories']);

export type IssueRow = {
  issue_number: number; title: string; state: 'open' | 'closed'; labels: string[];
  author_provider_id: number | null; html_url: string; updated_at: string;
};
export type PullRequestRow = {
  pr_number: number; title: string; state: 'open' | 'closed' | 'merged'; merged_at: string | null;
  author_provider_id: number | null; html_url: string; updated_at: string;
};

/** Constant-time check of GitHub's `X-Hub-Signature-256` against the raw request bytes. */
export function verifySignature(secret: string, rawBody: Buffer, header: string | undefined): boolean {
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v : '').slice(0, max);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);
const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== 'string' || v.length > 500) return null;
  try { const u = new URL(v); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
};
const iso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

export function normalizeIssue(raw: any): IssueRow | null {
  const number = num(raw?.number); const url = httpsUrl(raw?.html_url); const updated = iso(raw?.updated_at);
  if (number === null || number < 1 || !url || !updated) return null;
  const labels = Array.isArray(raw.labels) ? raw.labels.map((l: any) => text(l?.name, 50)).filter(Boolean).slice(0, 20) : [];
  return {
    issue_number: number, title: text(raw.title, 300), state: raw.state === 'closed' ? 'closed' : 'open',
    labels, author_provider_id: num(raw.user?.id), html_url: url, updated_at: updated,
  };
}

export function normalizePullRequest(raw: any): PullRequestRow | null {
  const number = num(raw?.number); const url = httpsUrl(raw?.html_url); const updated = iso(raw?.updated_at);
  if (number === null || number < 1 || !url || !updated) return null;
  const mergedAt = iso(raw.merged_at);
  return {
    pr_number: number, title: text(raw.title, 300), state: mergedAt ? 'merged' : raw.state === 'closed' ? 'closed' : 'open',
    merged_at: mergedAt, author_provider_id: num(raw.user?.id), html_url: url, updated_at: updated,
  };
}

/** Persistence seam, implemented with the Supabase service role in api/github-webhook.ts. */
export interface WebhookStore {
  /** Returns false when the delivery id was already recorded (a replay). */
  recordDelivery(d: { delivery_id: string; event_type: string; provider_repo_id: number | null }): Promise<boolean>;
  findRepository(providerRepoId: number): Promise<{ id: string } | null>;
  upsertIssue(repositoryId: string, row: IssueRow): Promise<void>;
  upsertPullRequest(repositoryId: string, row: PullRequestRow): Promise<void>;
  finishDelivery(deliveryId: string, status: 'processed' | 'ignored' | 'failed', error?: string): Promise<void>;
}

export type WebhookRequest = { method: string; headers: Record<string, string | string[] | undefined>; rawBody: Buffer };
export type WebhookResponse = { status: number; body: { ok: boolean; result?: string; error?: string } };

const header = (h: WebhookRequest['headers'], name: string): string | undefined => {
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
};

export async function handleWebhook(req: WebhookRequest, secret: string, store: WebhookStore): Promise<WebhookResponse> {
  if (req.method !== 'POST') return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
  if (!secret) return { status: 500, body: { ok: false, error: 'not_configured' } };
  if (req.rawBody.length > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: 'payload_too_large' } };
  // Signature is checked on the raw bytes before any JSON parsing.
  if (!verifySignature(secret, req.rawBody, header(req.headers, 'x-hub-signature-256'))) {
    return { status: 401, body: { ok: false, error: 'invalid_signature' } };
  }
  const deliveryId = header(req.headers, 'x-github-delivery');
  const event = header(req.headers, 'x-github-event');
  if (!deliveryId || deliveryId.length > 100 || !event || event.length > 60) {
    return { status: 400, body: { ok: false, error: 'missing_headers' } };
  }
  let payload: any;
  try { payload = JSON.parse(req.rawBody.toString('utf8')); } catch { return { status: 400, body: { ok: false, error: 'invalid_json' } }; }

  const repoId = num(payload?.repository?.id);
  const isNew = await store.recordDelivery({ delivery_id: deliveryId, event_type: event, provider_repo_id: repoId });
  if (!isNew) return { status: 200, body: { ok: true, result: 'duplicate' } };

  if (ACKNOWLEDGED_EVENTS.has(event) || !SYNCED_EVENTS.has(event) || repoId === null) {
    await store.finishDelivery(deliveryId, 'ignored');
    return { status: 200, body: { ok: true, result: 'ignored' } };
  }
  try {
    const repo = await store.findRepository(repoId);
    if (!repo) { await store.finishDelivery(deliveryId, 'ignored'); return { status: 200, body: { ok: true, result: 'not_enrolled' } }; }
    if (event === 'issues') {
      const row = normalizeIssue(payload.issue);
      if (!row) throw new Error('invalid issue payload');
      await store.upsertIssue(repo.id, row);
    } else {
      const row = normalizePullRequest(payload.pull_request);
      if (!row) throw new Error('invalid pull request payload');
      await store.upsertPullRequest(repo.id, row);
    }
    await store.finishDelivery(deliveryId, 'processed');
    return { status: 200, body: { ok: true, result: 'processed' } };
  } catch (err) {
    await store.finishDelivery(deliveryId, 'failed', (err instanceof Error ? err.message : 'error').slice(0, 300)).catch(() => {});
    return { status: 500, body: { ok: false, error: 'processing_failed' } };
  }
}
