// Only same-site community paths are allowed as post-login destinations.
// Rejects absolute URLs, protocol-relative (//host), backslash tricks, dot segments and control characters.
const COMMUNITY_PATH = /^\/community(\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?(\?[^\s\\]*)?(#[^\s\\]*)?$/;
export function safeReturnPath(value: string | null | undefined, fallback = '/community/dashboard'): string {
  if (!value || value.length > 200) return fallback;
  if (!COMMUNITY_PATH.test(value)) return fallback;
  if (value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return fallback;
  if (/\/\.\.?(\/|$)/.test(value.split(/[?#]/)[0])) return fallback;
  return value;
}
