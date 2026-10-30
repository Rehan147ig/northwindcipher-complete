-- RLS permission matrix. Run by scripts/test-rls.mjs (or CI) against a throwaway Postgres.
-- Each check runs as a different user by setting the role and the JWT subject the auth.uid() stub reads.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- alice: maintainer
  ('00000000-0000-0000-0000-00000000000b'),  -- bob: contributor
  ('00000000-0000-0000-0000-00000000000c'),  -- carol: outsider
  ('00000000-0000-0000-0000-00000000000d');  -- dave: moderator
insert into public.app_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000d', 'moderator');
-- alice and bob were approved earlier; carol stays pending to exercise the gateway below.
update public.profiles set membership_status = 'approved' where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

create schema if not exists testutil;
grant usage on schema testutil to anon, authenticated;
alter default privileges in schema testutil grant execute on functions to anon, authenticated;
create or replace function testutil.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
end $$;
create or replace function testutil.expect(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function testutil.denied(label text, stmt text) returns void language plpgsql as $$
declare blocked boolean := false; affected bigint;
begin
  begin execute stmt; get diagnostics affected = row_count; blocked := affected = 0;
  exception when others then blocked := true; end;
  if not blocked then raise exception 'FAILED (was allowed): %', label; end if;
  raise notice 'ok - % (denied)', label;
end $$;

-- alice creates one public and one private project; the trigger makes her maintainer.
select testutil.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.projects (id, slug, name, visibility, owner_user_id) values
  ('10000000-0000-0000-0000-000000000001', 'open-one', 'Open One', 'public', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', 'secret-one', 'Secret One', 'private', '00000000-0000-0000-0000-00000000000a');
select testutil.expect('creator is maintainer', (select count(*) from public.project_memberships where role = 'maintainer') = 2);
insert into public.project_memberships (project_id, user_id, role)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'contributor');

-- anonymous
select testutil.as_user(null);
select testutil.expect('anon sees only public projects', (select count(*) from public.projects) = 1);
select testutil.denied('anon cannot create projects', $$insert into public.projects (slug, name, owner_user_id) values ('x1', 'X', '00000000-0000-0000-0000-00000000000a')$$);
select testutil.expect('anon sees no reports', (select count(*) from public.reports) = 0);
select testutil.expect('anon sees no audit events', (select count(*) from public.audit_events) = 0);

-- outsider
select testutil.as_user('00000000-0000-0000-0000-00000000000c');
select testutil.expect('outsider cannot see private project', (select count(*) from public.projects where slug = 'secret-one') = 0);
select testutil.denied('outsider cannot edit public project', $$update public.projects set name = 'hacked' where slug = 'open-one'$$);
select testutil.denied('outsider cannot add themselves as maintainer', $$insert into public.project_memberships (project_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'maintainer')$$);
select testutil.denied('cannot create a project owned by someone else', $$insert into public.projects (slug, name, owner_user_id) values ('x2', 'X', '00000000-0000-0000-0000-00000000000a')$$);

-- contributor
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.expect('contributor sees private project they belong to', (select count(*) from public.projects where slug = 'secret-one') = 1);
select testutil.denied('contributor cannot edit project', $$update public.projects set name = 'nope' where slug = 'secret-one'$$);
select testutil.denied('contributor cannot promote themselves', $$update public.project_memberships set role = 'maintainer' where user_id = '00000000-0000-0000-0000-00000000000b'$$);
select testutil.denied('contributor cannot grant app roles', $$insert into public.app_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000b', 'moderator')$$);

-- reports
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.reports (reporter_id, target_type, target_id, category) values ('00000000-0000-0000-0000-00000000000b', 'project', 'open-one', 'spam');
select testutil.denied('cannot file a report as someone else', $$insert into public.reports (reporter_id, target_type, target_id, category) values ('00000000-0000-0000-0000-00000000000a', 'project', 'open-one', 'spam')$$);
select testutil.expect('reporter sees own report', (select count(*) from public.reports) = 1);
select testutil.denied('reporter cannot close their own report', $$update public.reports set status = 'dismissed'$$);
select testutil.as_user('00000000-0000-0000-0000-00000000000c');
select testutil.expect('other users cannot see the report', (select count(*) from public.reports) = 0);

-- moderator
select testutil.as_user('00000000-0000-0000-0000-00000000000d');
select testutil.expect('moderator sees all reports', (select count(*) from public.reports) = 1);
update public.reports set status = 'actioned';
select testutil.expect('moderator review wrote an audit event', (select count(*) from public.audit_events where action = 'report status') = 1);
select testutil.expect('moderator can read audit log', (select count(*) from public.audit_events) >= 1);
select testutil.denied('moderator cannot write audit events directly', $$insert into public.audit_events (action, resource_type, resource_id) values ('forged', 'x', 'y')$$);

-- maintainer
select testutil.as_user('00000000-0000-0000-0000-00000000000a');
update public.projects set summary = 'updated' where slug = 'open-one';
select testutil.expect('maintainer can edit project', (select summary from public.projects where slug = 'open-one') = 'updated');
select testutil.expect('maintainer cannot read audit log', (select count(*) from public.audit_events) = 0);

select testutil.as_user('00000000-0000-0000-0000-00000000000d');
select testutil.expect('membership changes are in the audit log', (select count(*) from public.audit_events where resource_type = 'project') >= 3);
-- verification: members cannot self-verify, and the function requires BOTH a confirmed email and GitHub
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.denied('members cannot set verified_at directly', $$update public.profiles set verified_at = now() where id = '00000000-0000-0000-0000-00000000000b'$$);
select testutil.denied('members cannot set github_login directly', $$update public.profiles set github_login = 'torvalds' where id = '00000000-0000-0000-0000-00000000000b'$$);
select testutil.as_user(null);
select testutil.denied('anon cannot call refresh_my_verification', $$select public.refresh_my_verification()$$);
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
update public.profiles set display_name = 'Bob', skills = array['rust'] where id = '00000000-0000-0000-0000-00000000000b';
select testutil.expect('members can still edit their own display fields', (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Bob');
select testutil.expect('github alone does not verify (email unconfirmed)', (select verified_at from public.refresh_my_verification()) is null);

reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000b';
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.expect('confirmed email without GitHub does not verify', (select verified_at from public.refresh_my_verification()) is null);

reset role;
insert into auth.identities (user_id, provider, identity_data) values ('00000000-0000-0000-0000-00000000000b', 'github', '{"user_name":"bobhub"}');
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.expect('confirmed email + GitHub verifies the contributor', (select verified_at is not null and github_login = 'bobhub' from public.refresh_my_verification()));

reset role;
insert into auth.identities (user_id, provider, identity_data) values ('00000000-0000-0000-0000-00000000000c', 'github', '{"user_name":"bad name; drop table"}');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000c';
select testutil.as_user('00000000-0000-0000-0000-00000000000c');
select testutil.expect('an invalid GitHub login is rejected, not stored', (select verified_at is null and github_login is null from public.refresh_my_verification()));

-- repository enrollment: verified + owns the GitHub account, or moderator
select testutil.as_user('00000000-0000-0000-0000-00000000000a');
select testutil.denied('unverified maintainer cannot enroll a repository', $$insert into public.repositories (project_id, provider_repo_id, full_name) values ('10000000-0000-0000-0000-000000000001', 111, 'alicehub/lib')$$);

reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000a';
insert into auth.identities (user_id, provider, identity_data) values ('00000000-0000-0000-0000-00000000000a', 'github', '{"user_name":"AliceHub"}');
select testutil.as_user('00000000-0000-0000-0000-00000000000a');
select testutil.expect('alice is now verified', (select verified_at is not null from public.refresh_my_verification()));
insert into public.repositories (project_id, provider_repo_id, full_name) values ('10000000-0000-0000-0000-000000000001', 111, 'alicehub/lib');
select testutil.expect('verified owner can enroll her own repository (case-insensitive)', (select count(*) from public.repositories where provider_repo_id = 111) = 1);
select testutil.denied('verified maintainer cannot enroll someone else''s repository', $$insert into public.repositories (project_id, provider_repo_id, full_name) values ('10000000-0000-0000-0000-000000000001', 222, 'torvalds/linux')$$);

select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.denied('contributor cannot enroll into a project they do not maintain', $$insert into public.repositories (project_id, provider_repo_id, full_name) values ('10000000-0000-0000-0000-000000000001', 333, 'bobhub/x')$$);

-- contributor gateway: carol is a pending member
reset role;
select testutil.as_user('00000000-0000-0000-0000-00000000000c');
select testutil.denied('pending member cannot create a project', $$insert into public.projects (slug, name, owner_user_id) values ('pending-try', 'x', '00000000-0000-0000-0000-00000000000c')$$);
select testutil.denied('pending member cannot save issues', $$update public.profiles set saved_issues = array['wk-12'] where id = '00000000-0000-0000-0000-00000000000c'$$);
select testutil.denied('members cannot approve themselves', $$update public.profiles set membership_status = 'approved' where id = '00000000-0000-0000-0000-00000000000c'$$);
update public.profiles set display_name = 'Carol' where id = '00000000-0000-0000-0000-00000000000c';
select testutil.expect('pending member can still edit their own display name', (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Carol');
-- invitation gateway (public request form -> staff review -> personal invite link)
reset role;
update auth.users set email = 'carol@example.com' where id = '00000000-0000-0000-0000-00000000000c';
select testutil.as_user(null);
select testutil.denied('visitors cannot read requests', $$select 1 from public.invitation_requests$$);
insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct)
  values ('Carol C', 'Carol@Example.com', 'contribute_docs', 'beginner', 'I want to improve the CooL getting-started documentation.', true);
select testutil.denied('a visitor cannot file a pre-approved request', $$insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct, status) values ('Mallory', 'm@example.com', 'create_tool', 'advanced', 'Give me access immediately please, thank you.', true, 'approved')$$);
select testutil.denied('a request cannot carry its own invite code', $$insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct, invite_code) values ('Mallory', 'm2@example.com', 'create_tool', 'advanced', 'Give me access immediately please, thank you.', true, 'abc')$$);
select testutil.denied('invalid emails are rejected', $$insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct) values ('Bad Mail', 'not-an-email', 'create_tool', 'advanced', 'This request has an invalid email address.', true)$$);
select testutil.denied('the conduct rules must be accepted', $$insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct) values ('No Rules', 'norules@example.com', 'create_tool', 'advanced', 'This request did not accept the guidelines.', false)$$);
select testutil.denied('only one pending request per email, case-insensitive', $$insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct) values ('Carol Again', 'carol@EXAMPLE.com', 'create_tool', 'advanced', 'A second request while the first is still pending.', true)$$);
select testutil.denied('visitors cannot call the review function', $$select public.review_invitation_request((select id from public.invitation_requests limit 1), 'approved', null)$$);
select testutil.expect('visitors cannot look up random invitation codes', (select count(*) from public.check_invitation('guess')) = 0);

select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.expect('other members cannot read someone else''s request', (select count(*) from public.invitation_requests) = 0);
select testutil.denied('non-moderators cannot review requests', $$select public.review_invitation_request((select id from public.invitation_requests limit 1), 'approved', null)$$);

select testutil.as_user('00000000-0000-0000-0000-00000000000d');
select testutil.expect('moderator sees the pending request', (select count(*) from public.invitation_requests where status = 'pending') = 1);
select testutil.denied('invalid decisions are rejected', $$select public.review_invitation_request((select id from public.invitation_requests limit 1), 'maybe', null)$$);
select public.review_invitation_request((select id from public.invitation_requests where lower(email) = 'carol@example.com'), 'approved', 'Welcome to CooL!');
select testutil.expect('approving an existing account applies immediately', (select membership_status from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'approved');
select testutil.expect('the request is marked redeemed and has an invite code', (select redeemed_at is not null and length(invite_code) = 64 from public.invitation_requests where lower(email) = 'carol@example.com'));
select testutil.expect('the decision is written to the audit log', (select count(*) from public.audit_events where action = 'invitation request approved') = 1);
select testutil.denied('a request cannot be reviewed twice', $$select public.review_invitation_request((select id from public.invitation_requests limit 1), 'rejected', 'again')$$);

select testutil.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.projects (slug, name, owner_user_id) values ('carol-first', 'Carol First', '00000000-0000-0000-0000-00000000000c');
select testutil.expect('approved member can now create a project', (select count(*) from public.projects where slug = 'carol-first') = 1);
update public.profiles set saved_issues = array['wk-12'] where id = '00000000-0000-0000-0000-00000000000c';
select testutil.expect('approved member can now save issues', (select saved_issues[1] from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'wk-12');

-- a brand-new person: request -> approval -> invite link -> signup -> first login
select testutil.as_user(null);
insert into public.invitation_requests (name, email, project_type, experience, details, accepted_conduct)
  values ('Eve New', 'newperson@example.com', 'create_plugin', 'intermediate', 'I would like to build a CooL plugin for editors.', true);
select testutil.as_user('00000000-0000-0000-0000-00000000000d');
select public.review_invitation_request((select id from public.invitation_requests where email = 'newperson@example.com'), 'approved', null);
reset role;
create table testutil.invite_code_holder as select invite_code from public.invitation_requests where email = 'newperson@example.com';
grant select on testutil.invite_code_holder to anon, authenticated;
select testutil.expect('no account yet, so the request stays unredeemed', (select redeemed_at is null from public.invitation_requests where email = 'newperson@example.com'));

select testutil.as_user(null);
select testutil.expect('the signup page can look the invitation up', (select count(*) from public.check_invitation((select invite_code from testutil.invite_code_holder))) = 1);
select testutil.expect('and it returns the invited name and email only', (select email from public.check_invitation((select invite_code from testutil.invite_code_holder))) = 'newperson@example.com');

reset role;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000000e', 'newperson@example.com', null);
select testutil.as_user('00000000-0000-0000-0000-00000000000e');
select testutil.denied('an unconfirmed email cannot redeem', $$select public.redeem_invitation((select invite_code from testutil.invite_code_holder))$$);
select testutil.expect('still pending before the email is confirmed', (select membership_status from public.profiles where id = '00000000-0000-0000-0000-00000000000e') = 'pending');

reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000e';
select testutil.as_user('00000000-0000-0000-0000-00000000000b');
select testutil.expect('someone else cannot use the invitation', not (select public.redeem_invitation((select invite_code from testutil.invite_code_holder))));

select testutil.as_user('00000000-0000-0000-0000-00000000000e');
select testutil.expect('the invited person redeems it after confirming their email', (select public.redeem_invitation((select invite_code from testutil.invite_code_holder))));
select testutil.expect('and is now an approved contributor', (select membership_status from public.profiles where id = '00000000-0000-0000-0000-00000000000e') = 'approved');
select testutil.expect('an invitation can only be used once', not (select public.redeem_invitation((select invite_code from testutil.invite_code_holder))));

reset role;
\echo 'ALL RLS CHECKS PASSED'
