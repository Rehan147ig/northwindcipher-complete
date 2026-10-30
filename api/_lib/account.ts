// Account export and deletion (spec §12/§24). Pure logic; persistence is injected so it can be tested.
export const MAX_ACCOUNT_BODY_BYTES = 1024;

export interface AccountStore {
  /** Verifies the access token and returns the user, or null if it is invalid/expired. */
  getUser(token: string): Promise<{ id: string; email: string | null; created_at: string | null } | null>;
  exportData(userId: string): Promise<Record<string, unknown>>;
  ownedProjectCount(userId: string): Promise<number>;
  recordDeletion(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export type AccountRequest = { method: string; headers: Record<string, string | string[] | undefined>; rawBody: Buffer };
export type AccountResponse = { status: number; body: Record<string, unknown> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function handleAccount(req: AccountRequest, store: AccountStore): Promise<AccountResponse> {
  if (req.method !== 'GET' && req.method !== 'DELETE') return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
  if (req.rawBody.length > MAX_ACCOUNT_BODY_BYTES) return { status: 413, body: { ok: false, error: 'payload_too_large' } };

  const auth = first(req.headers['authorization']);
  const token = auth && /^Bearer [A-Za-z0-9._~+/=-]{20,4096}$/.test(auth) ? auth.slice('Bearer '.length) : null;
  if (!token) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  const user = await store.getUser(token).catch(() => null);
  if (!user) return { status: 401, body: { ok: false, error: 'unauthorized' } };

  if (req.method === 'GET') {
    const data = await store.exportData(user.id);
    return { status: 200, body: { ok: true, exportedAt: new Date().toISOString(), user: { id: user.id, email: user.email, created_at: user.created_at }, data } };
  }

  let confirm: unknown;
  try { confirm = req.rawBody.length ? JSON.parse(req.rawBody.toString('utf8'))?.confirm : undefined; } catch { /* handled below */ }
  if (confirm !== 'DELETE') return { status: 400, body: { ok: false, error: 'confirmation_required' } };

  // Projects must be archived or handed to another maintainer first; deleting the owner would orphan them.
  if ((await store.ownedProjectCount(user.id)) > 0) return { status: 409, body: { ok: false, error: 'owns_projects' } };

  await store.recordDeletion(user.id);
  await store.deleteUser(user.id);
  return { status: 200, body: { ok: true, result: 'deleted' } };
}
