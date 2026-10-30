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
