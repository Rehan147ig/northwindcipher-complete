const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const {friendlyAuthError}=loadTs('src/renderer/src/community/authErrors.ts');

test('maps the raw Supabase messages contributors actually hit',()=>{
 const cases=[
  ['Unsupported provider: provider is not enabled',/GitHub sign-in is not turned on/],
  ['User already registered',/already exists/],
  ['Invalid login credentials',/do not match/],
  ['Email not confirmed',/confirm your email/i],
  ['email rate limit exceeded',/Too many attempts/],
  ['Password should be at least 6 characters',/longer password/],
  ['Unable to validate email address: invalid format',/does not look valid/],
  ['Signups not allowed for this instance',/turned off/],
  ['Manual linking is disabled',/Linking GitHub/],
  ['Failed to fetch',/Could not reach/],
  ['Email address not authorized',/email service is still being set up/],
  ['Error sending confirmation email',/could not send the email/],
 ];
 for(const [raw,expected] of cases)assert.match(friendlyAuthError(raw),expected,raw);
});

test('never leaks raw JSON or internals for unknown errors',()=>{
 for(const raw of ['{"code":500,"msg":"db password=hunter2"}',undefined,null,''])assert.equal(friendlyAuthError(raw),'Something went wrong. Please try again.');
 assert.equal(friendlyAuthError('weird thing','unexpected_failure'),'Something went wrong (reference: unexpected_failure). Please try again.');
 assert.equal(friendlyAuthError('weird thing','bad code with spaces'),'Something went wrong. Please try again.');
 assert.match(friendlyAuthError('Database error saving new user','unexpected_failure'),/setup problem/);
});
