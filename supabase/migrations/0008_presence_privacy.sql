-- Member-controlled presence and privacy (spec §10, §17, §24). Conservative defaults: hidden, no idle tracking.
alter table public.profiles add column if not exists presence_mode text not null default 'hidden'
  check (presence_mode in ('hidden','online','away','dnd'));
alter table public.profiles add column if not exists idle_detection boolean not null default false;
alter table public.profiles add column if not exists show_contributions boolean not null default true;

-- Members may change only their own presentation and privacy fields (verification stays server-controlled).
grant update (presence_mode, idle_detection, show_contributions) on public.profiles to authenticated;
