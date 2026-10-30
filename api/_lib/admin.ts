// Moderator-only operational data that RLS deliberately hides from browsers (service role required).
export interface AdminStore {
  getUser(token: string): Promise<{ id: string } | null>;
  isModerator(userId: string): Promise<boolean>;
  recentDeliveries(limit: number): Promise<Record<string, unknown>[]>;
}

export type AdminRequest = { method: string; url: string; headers: Record<string, string | string[] | undefined> };
export type AdminResponse = { status: number; body: Record<string, unknown> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function handleAdmin(req: AdminRequest, store: AdminStore): Promise<AdminResponse> {
  if (req.method !== 'GET') return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
  const auth = first(req.headers['authorization']);
  const token = auth && /^Bearer [A-Za-z0-9._~+/=-]{20,4096}$/.test(auth) ? auth.slice('Bearer '.length) : null;
  if (!token) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  const user = await store.getUser(token).catch(() => null);
  if (!user) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  // Authorization is decided here on the server; hiding the UI is not access control.
  if (!(await store.isModerator(user.id))) return { status: 403, body: { ok: false, error: 'forbidden' } };

  const resource = new URL(req.url, 'http://localhost').searchParams.get('resource');
  if (resource === 'deliveries') {
    return { status: 200, body: { ok: true, deliveries: await store.recentDeliveries(50) } };
  }
  return { status: 404, body: { ok: false, error: 'unknown_resource' } };
}
