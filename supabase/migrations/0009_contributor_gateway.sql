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
