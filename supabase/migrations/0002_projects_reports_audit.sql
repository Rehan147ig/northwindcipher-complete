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
