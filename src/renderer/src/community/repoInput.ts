// Accepts "owner/repo" or a github.com URL and returns a validated, normalized name (or null).
export type ParsedRepo = { owner: string; repo: string; fullName: string };

export function parseRepo(input: string): ParsedRepo | null {
  let text = input.trim();
  if (!text || text.length > 200) return null;
  text = text.replace(/^https:\/\/(www\.)?github\.com\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(text);
  if (!match || match[2] === '.' || match[2] === '..') return null;
  return { owner: match[1], repo: match[2], fullName: `${match[1]}/${match[2]}` };
}
