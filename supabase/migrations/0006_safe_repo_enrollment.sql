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
