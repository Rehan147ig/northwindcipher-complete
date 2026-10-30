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
