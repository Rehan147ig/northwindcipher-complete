-- Contributor profiles for the Northwind community site.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  color text not null default '#6e1423' check (color ~* '^#[0-9a-f]{6}$'),
  github text check (github is null or github ~ '^[A-Za-z0-9-]{1,39}$'),
  saved_issues text[] not null default '{}' check (cardinality(saved_issues) <= 100),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "own profile delete" on public.profiles for delete using (auth.uid() = id);

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(split_part(new.email,'@',1),''), 'Contributor'), 40));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Projects, memberships, reports and an audit log for the Northwind community.
-- Authorization lives in row-level security; service-role code must still check permissions itself.

create table if not exists public.app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','moderator')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.app_roles enable row level security;
-- Roles are granted with the service role only; members can read their own.
create policy "own roles read" on public.app_roles for select using (auth.uid() = user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  name text not null check (char_length(name) between 1 and 80),
  summary text not null default '' check (char_length(summary) <= 500),
  visibility text not null default 'public' check (visibility in ('public','private')),
  status text not null default 'active' check (status in ('active','archived')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_visibility_idx on public.projects (visibility, status);
create index if not exists projects_owner_idx on public.projects (owner_user_id);

create table if not exists public.project_memberships (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('maintainer','contributor')),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists memberships_user_idx on public.project_memberships (user_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('profile','message','room','event','project')),
  target_id text not null check (char_length(target_id) between 1 and 100),
  category text not null check (char_length(category) between 1 and 60),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_events (created_at);

-- Helpers are SECURITY DEFINER so policies never recurse into the tables they protect.
create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_roles where user_id = auth.uid() and role in ('moderator','owner'));
$$;
create or replace function public.is_project_maintainer(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_memberships
    where project_id = pid and user_id = auth.uid() and role = 'maintainer' and status = 'active');
$$;
create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_memberships
    where project_id = pid and user_id = auth.uid() and status = 'active');
$$;

alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.reports enable row level security;
alter table public.audit_events enable row level security;

-- projects: public ones are readable by anyone; private ones only by members.
create policy "projects read" on public.projects for select
  using (visibility = 'public' or public.is_project_member(id) or owner_user_id = auth.uid());
create policy "projects create" on public.projects for insert
  with check (auth.uid() = owner_user_id);
create policy "projects update" on public.projects for update
  using (public.is_project_maintainer(id)) with check (public.is_project_maintainer(id));
create policy "projects delete" on public.projects for delete
  using (public.is_project_maintainer(id));

-- memberships: members see their own rows; maintainers manage their project's roster.
create policy "memberships read" on public.project_memberships for select
  using (user_id = auth.uid() or public.is_project_maintainer(project_id));
create policy "memberships add" on public.project_memberships for insert
  with check (public.is_project_maintainer(project_id));
create policy "memberships update" on public.project_memberships for update
  using (public.is_project_maintainer(project_id)) with check (public.is_project_maintainer(project_id));
create policy "memberships leave" on public.project_memberships for delete
  using (user_id = auth.uid() or public.is_project_maintainer(project_id));

-- reports: anyone signed in can file one; reporters see their own; moderators review all.
create policy "reports create" on public.reports for insert
  with check (auth.uid() = reporter_id and status = 'open');
create policy "reports read" on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator());
create policy "reports review" on public.reports for update
  using (public.is_moderator()) with check (public.is_moderator());

-- audit log: readable by moderators only; written only by the triggers below / the service role.
create policy "audit read" on public.audit_events for select using (public.is_moderator());

create or replace function public.write_audit(action text, rtype text, rid text, meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  values (auth.uid(), action, rtype, rid, meta);
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- The creator becomes the first maintainer.
create or replace function public.project_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_memberships (project_id, user_id, role) values (new.id, new.owner_user_id, 'maintainer')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists projects_owner_membership on public.projects;
create trigger projects_owner_membership after insert on public.projects
  for each row execute function public.project_owner_membership();

create or replace function public.audit_membership_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(tg_op || ' membership', 'project', coalesce(new.project_id, old.project_id)::text,
    jsonb_build_object('user', coalesce(new.user_id, old.user_id), 'role', coalesce(new.role, old.role)));
  return coalesce(new, old);
end $$;
drop trigger if exists memberships_audit on public.project_memberships;
create trigger memberships_audit after insert or update or delete on public.project_memberships
  for each row execute function public.audit_membership_change();

create or replace function public.audit_report_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.write_audit('report status', 'report', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
drop trigger if exists reports_audit on public.reports;
create trigger reports_audit after update on public.reports
  for each row execute function public.audit_report_review();
-- GitHub sync read models and webhook delivery log.
-- These tables are written only by the webhook function (service role); clients can only read public data.

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null default 'github' check (provider = 'github'),
  provider_repo_id bigint not null unique,
  full_name text not null check (char_length(full_name) <= 140),
  default_branch text,
  installation_id bigint,
  sync_status text not null default 'active' check (sync_status in ('awaiting_installation','active','rate_limited','degraded','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists repositories_project_idx on public.repositories (project_id);

create table if not exists public.github_issues (
  repository_id uuid not null references public.repositories(id) on delete cascade,
  issue_number integer not null,
  title text not null check (char_length(title) <= 300),
  state text not null check (state in ('open','closed')),
  labels jsonb not null default '[]'::jsonb,
  author_provider_id bigint,
  html_url text not null,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  primary key (repository_id, issue_number)
);
create index if not exists github_issues_state_idx on public.github_issues (state, updated_at desc);

create table if not exists public.pull_requests (
  repository_id uuid not null references public.repositories(id) on delete cascade,
  pr_number integer not null,
  title text not null check (char_length(title) <= 300),
  state text not null check (state in ('open','closed','merged')),
  merged_at timestamptz,
  author_provider_id bigint,
  html_url text not null,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  primary key (repository_id, pr_number)
);

create table if not exists public.webhook_deliveries (
  delivery_id text primary key,
  event_type text not null,
  provider_repo_id bigint,
  received_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  attempts integer not null default 1,
  error text
);

alter table public.repositories enable row level security;
alter table public.github_issues enable row level security;
alter table public.pull_requests enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Read models follow the visibility of the project they belong to.
create policy "repositories read" on public.repositories for select using (
  exists (select 1 from public.projects p where p.id = project_id
    and (p.visibility = 'public' or public.is_project_member(p.id))));
create policy "issues read" on public.github_issues for select using (
  exists (select 1 from public.repositories r join public.projects p on p.id = r.project_id
    where r.id = repository_id and (p.visibility = 'public' or public.is_project_member(p.id))));
create policy "pull requests read" on public.pull_requests for select using (
  exists (select 1 from public.repositories r join public.projects p on p.id = r.project_id
    where r.id = repository_id and (p.visibility = 'public' or public.is_project_member(p.id))));
-- webhook_deliveries: no policies, so only the service role can touch it.

-- Maintainers may enroll a repository for their own project; the webhook only syncs enrolled repositories.
create policy "repositories enroll" on public.repositories for insert with check (public.is_project_maintainer(project_id));
create policy "repositories unenroll" on public.repositories for delete using (public.is_project_maintainer(project_id));
-- Contributor verification: a confirmed email AND a linked GitHub identity.
-- Users can never set these fields themselves; only the function below (SECURITY DEFINER) or the service role can.

alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles add column if not exists github_login text
  check (github_login is null or github_login ~ '^[A-Za-z0-9-]{1,39}$');

-- Column-level privileges: members may edit only their own presentation fields.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, display_name, skills, color, saved_issues) on public.profiles to authenticated;
grant update (display_name, skills, color, saved_issues) on public.profiles to authenticated;

create or replace function public.refresh_my_verification() returns public.profiles
language plpgsql security definer set search_path = public, auth as $$
declare
  confirmed timestamptz;
  gh text;
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select email_confirmed_at into confirmed from auth.users where id = auth.uid();
  select coalesce(identity_data->>'user_name', identity_data->>'preferred_username') into gh
    from auth.identities where user_id = auth.uid() and provider = 'github' limit 1;
  if gh is not null and gh !~ '^[A-Za-z0-9-]{1,39}$' then gh := null; end if;
  update public.profiles set
    github_login = gh,
    verified_at = case when confirmed is not null and gh is not null then coalesce(verified_at, now()) else null end
  where id = auth.uid()
  returning * into result;
  return result;
end $$;
revoke all on function public.refresh_my_verification() from public, anon;
grant execute on function public.refresh_my_verification() to authenticated;
-- Keep moderation evidence (anonymized) when a reporter deletes their account.
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;
-- A repository can only be enrolled by a maintainer of the project who either
--   (a) is a moderator/owner, or
--   (b) is a verified contributor whose linked GitHub login matches the repository's owner (user or org name).
-- This stops anyone from claiming a repository they do not control.
drop policy if exists "repositories enroll" on public.repositories;
create policy "repositories enroll" on public.repositories for insert with check (
  public.is_project_maintainer(project_id)
  and (
    public.is_moderator()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.verified_at is not null
        and lower(split_part(full_name, '/', 1)) = lower(p.github_login)
    )
  )
);
-- Users who signed up before 0001 was applied have no profile row (the trigger did not exist yet).
-- Idempotent: safe to run any number of times; never overwrites existing profiles.
insert into public.profiles (id, display_name)
select u.id,
       left(coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(split_part(u.email, '@', 1), ''), 'Contributor'), 40)
from auth.users u
on conflict (id) do nothing;
-- Member-controlled presence and privacy (spec §10, §17, §24). Conservative defaults: hidden, no idle tracking.
alter table public.profiles add column if not exists presence_mode text not null default 'hidden'
  check (presence_mode in ('hidden','online','away','dnd'));
alter table public.profiles add column if not exists idle_detection boolean not null default false;
alter table public.profiles add column if not exists show_contributions boolean not null default true;

-- Members may change only their own presentation and privacy fields (verification stays server-controlled).
grant update (presence_mode, idle_detection, show_contributions) on public.profiles to authenticated;
-- Contributor gateway: anyone can browse; contributing needs a staff-approved request.
-- Enforced in the database (not just hidden buttons). Staff (moderators/owners) always count as approved.

alter table public.profiles add column if not exists membership_status text not null default 'pending'
  check (membership_status in ('pending','approved','rejected'));
-- No column grant for membership_status: members can never change it themselves.

create or replace function public.is_approved_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_moderator()
      or exists (select 1 from public.profiles where id = auth.uid() and membership_status = 'approved');
$$;
grant execute on function public.is_approved_member() to anon, authenticated;

create table if not exists public.contributor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  intent text not null check (intent in ('contribute','create')),
  experience text not null check (experience in ('beginner','intermediate','advanced')),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  summary text not null check (char_length(summary) between 20 and 1500),
  github_login text check (github_login is null or github_login ~ '^[A-Za-z0-9-]{1,39}$'),
  link_url text check (link_url is null or (link_url ~ '^https://' and char_length(link_url) <= 300)),
  accepted_conduct boolean not null check (accepted_conduct),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists one_pending_application on public.contributor_applications (user_id) where status = 'pending';
create index if not exists applications_status_idx on public.contributor_applications (status, created_at);
alter table public.contributor_applications enable row level security;

drop policy if exists "applications create" on public.contributor_applications;
create policy "applications create" on public.contributor_applications for insert with check (
  user_id = auth.uid() and status = 'pending' and reviewer_id is null and review_note is null and reviewed_at is null);
drop policy if exists "applications read" on public.contributor_applications;
create policy "applications read" on public.contributor_applications for select using (
  user_id = auth.uid() or public.is_moderator());
-- No update/delete policies: decisions only go through review_contributor_application() below.

-- Reviewers need to see who applied.
drop policy if exists "profiles moderator read" on public.profiles;
create policy "profiles moderator read" on public.profiles for select using (public.is_moderator());

create or replace function public.review_contributor_application(app_id uuid, decision text, note text default null)
returns public.contributor_applications
language plpgsql security definer set search_path = public as $$
declare result public.contributor_applications;
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision' using errcode = '22023'; end if;
  update public.contributor_applications
     set status = decision, reviewer_id = auth.uid(), review_note = left(note, 1000), reviewed_at = now()
   where id = app_id and status = 'pending' and user_id <> auth.uid()
   returning * into result;
  if result.id is null then raise exception 'application not found, already reviewed, or your own' using errcode = 'P0002'; end if;
  update public.profiles set membership_status = decision where id = result.user_id;
  perform public.write_audit('application ' || decision, 'application', result.id::text, jsonb_build_object('user', result.user_id));
  return result;
end $$;
revoke all on function public.review_contributor_application(uuid, text, text) from public, anon;
grant execute on function public.review_contributor_application(uuid, text, text) to authenticated;

-- Saving issues is a contributor action.
create or replace function public.profiles_gate_saved() returns trigger
language plpgsql as $$
begin
  if new.saved_issues is distinct from old.saved_issues and not public.is_approved_member() then
    raise exception 'contributor access required' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_gate_saved on public.profiles;
create trigger profiles_gate_saved before update on public.profiles
  for each row execute function public.profiles_gate_saved();

-- Creating projects and enrolling repositories now also need approval.
drop policy if exists "projects create" on public.projects;
create policy "projects create" on public.projects for insert
  with check (auth.uid() = owner_user_id and public.is_approved_member());

drop policy if exists "repositories enroll" on public.repositories;
create policy "repositories enroll" on public.repositories for insert with check (
  public.is_approved_member()
  and public.is_project_maintainer(project_id)
  and (
    public.is_moderator()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.verified_at is not null
        and lower(split_part(full_name, '/', 1)) = lower(p.github_login)
    )
  )
);
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
-- Customisable office character: a small JSON spec (skin, hair, outfit, colours...) stored on the profile.
-- The app validates and sanitises it on read; the database only bounds its size and shape.
alter table public.profiles add column if not exists avatar jsonb;
alter table public.profiles drop constraint if exists profiles_avatar_shape;
alter table public.profiles add constraint profiles_avatar_shape
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 1024));
grant update (avatar) on public.profiles to authenticated;

notify pgrst, 'reload schema';
