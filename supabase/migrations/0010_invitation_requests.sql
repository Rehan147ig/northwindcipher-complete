-- Invitation gateway (replaces the account-first applications of 0009).
-- 1. Anyone fills a public request form (no account needed): name, email, project type, details.
-- 2. Staff review it in the admin portal. Approving creates a personal, unguessable invitation link.
-- 3. The person signs up through that link (email must match) and is approved on first login.
--    If they already have an account with that email, approval takes effect immediately.

drop function if exists public.review_contributor_application(uuid, text, text);
drop table if exists public.contributor_applications;

create table if not exists public.invitation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  project_type text not null check (project_type in ('contribute_code','contribute_docs','create_plugin','create_tool','create_other')),
  experience text not null check (experience in ('beginner','intermediate','advanced')),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  details text not null check (char_length(details) between 20 and 1500),
  github_login text check (github_login is null or github_login ~ '^[A-Za-z0-9-]{1,39}$'),
  link_url text check (link_url is null or (link_url ~ '^https://' and char_length(link_url) <= 300)),
  accepted_conduct boolean not null check (accepted_conduct),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_at timestamptz,
  invite_code text unique,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists one_pending_request_per_email on public.invitation_requests (lower(email)) where status = 'pending';
create index if not exists invitation_requests_status_idx on public.invitation_requests (status, created_at);
alter table public.invitation_requests enable row level security;

-- Anyone (including signed-out visitors) may submit a request, but only as a fresh pending one.
drop policy if exists "requests create" on public.invitation_requests;
create policy "requests create" on public.invitation_requests for insert with check (
  status = 'pending' and reviewer_id is null and review_note is null and reviewed_at is null
  and invite_code is null and redeemed_at is null and redeemed_by is null);
-- Staff read everything; a signed-in person can read requests made with their own email.
drop policy if exists "requests read" on public.invitation_requests;
create policy "requests read" on public.invitation_requests for select using (
  public.is_moderator() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
-- No update/delete policies: decisions only go through the functions below.

create or replace function public.review_invitation_request(request_id uuid, decision text, note text default null)
returns public.invitation_requests
language plpgsql security definer set search_path = public as $$
declare
  result public.invitation_requests;
  member uuid;
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision' using errcode = '22023'; end if;
  update public.invitation_requests
     set status = decision, reviewer_id = auth.uid(), review_note = left(note, 1000), reviewed_at = now(),
         invite_code = case when decision = 'approved' then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') end
   where id = request_id and status = 'pending'
   returning * into result;
  if result.id is null then raise exception 'request not found or already reviewed' using errcode = 'P0002'; end if;
  -- Someone with this email already has an account: apply the decision right away.
  update public.profiles p set membership_status = decision
    from auth.users u where u.id = p.id and lower(u.email) = lower(result.email)
    returning p.id into member;
  if member is not null and decision = 'approved' then
    update public.invitation_requests set redeemed_at = now(), redeemed_by = member where id = result.id returning * into result;
  end if;
  perform public.write_audit('invitation request ' || decision, 'invitation', result.id::text, jsonb_build_object('existing_account', member is not null));
  return result;
end $$;
revoke all on function public.review_invitation_request(uuid, text, text) from public, anon;
grant execute on function public.review_invitation_request(uuid, text, text) to authenticated;

-- The signup page asks this to pre-fill the form. Codes are 244 random bits, so they cannot be guessed.
create or replace function public.check_invitation(code text)
returns table(name text, email text)
language sql stable security definer set search_path = public as $$
  select r.name, r.email from public.invitation_requests r
   where r.invite_code = code and r.status = 'approved' and r.redeemed_at is null limit 1;
$$;
grant execute on function public.check_invitation(text) to anon, authenticated;

create or replace function public.redeem_invitation(code text) returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare
  r public.invitation_requests;
  confirmed timestamptz;
  mail text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select email_confirmed_at, email into confirmed, mail from auth.users where id = auth.uid();
  if confirmed is null then raise exception 'confirm your email first' using errcode = '42501'; end if;
  select * into r from public.invitation_requests
   where invite_code = code and status = 'approved' and redeemed_at is null for update;
  if r.id is null or lower(r.email) <> lower(mail) then return false; end if;
  update public.invitation_requests set redeemed_at = now(), redeemed_by = auth.uid() where id = r.id;
  update public.profiles set membership_status = 'approved' where id = auth.uid();
  perform public.write_audit('invitation redeemed', 'invitation', r.id::text, '{}'::jsonb);
  return true;
end $$;
revoke all on function public.redeem_invitation(text) from public, anon;
grant execute on function public.redeem_invitation(text) to authenticated;
