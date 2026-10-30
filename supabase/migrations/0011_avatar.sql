-- Customisable office character: a small JSON spec (skin, hair, outfit, colours...) stored on the profile.
-- The app validates and sanitises it on read; the database only bounds its size and shape.
alter table public.profiles add column if not exists avatar jsonb;
alter table public.profiles drop constraint if exists profiles_avatar_shape;
alter table public.profiles add constraint profiles_avatar_shape
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 1024));
grant update (avatar) on public.profiles to authenticated;
