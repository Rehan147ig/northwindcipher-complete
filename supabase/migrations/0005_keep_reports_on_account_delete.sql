-- Keep moderation evidence (anonymized) when a reporter deletes their account.
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;
