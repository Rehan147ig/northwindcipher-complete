-- Users who signed up before 0001 was applied have no profile row (the trigger did not exist yet).
-- Idempotent: safe to run any number of times; never overwrites existing profiles.
insert into public.profiles (id, display_name)
select u.id,
       left(coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(split_part(u.email, '@', 1), ''), 'Contributor'), 40)
from auth.users u
on conflict (id) do nothing;
