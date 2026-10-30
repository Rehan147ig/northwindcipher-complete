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
