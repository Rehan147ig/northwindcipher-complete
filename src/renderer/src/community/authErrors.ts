// Turns raw Supabase auth errors into messages a contributor can act on.
const rules:[RegExp,string][]=[
 [/provider is not enabled|unsupported provider/i,'GitHub sign-in is not turned on for this site yet. Please use email and password.'],
 [/user already registered|already been registered/i,'An account with this email already exists. Try logging in instead.'],
 [/invalid login credentials/i,'That email and password do not match. Check them and try again.'],
 [/email not confirmed/i,'Please confirm your email first. Check your inbox for the confirmation link.'],
 [/email address not authorized|email_address_not_authorized/i,'We cannot send email to this address yet because our email service is still being set up. Please try again later or contact the team.'],
 [/database error (saving|granting|updating|querying)/i,'Your account could not be created because of a setup problem on our side. Please contact the team.'],
 [/error sending (confirmation|recovery|magic link|invite)|smtp|unexpected_failure/i,'We could not send the email right now. Please try again in a few minutes.'],
 [/rate limit|too many requests|over_email_send_rate_limit|after \d+ seconds/i,'Too many attempts just now. Please wait a minute and try again.'],
 [/password should be at least|weak password|password is too short/i,'Choose a longer password (at least 8 characters).'],
 [/unable to validate email|invalid email|email address .* is invalid/i,'That email address does not look valid.'],
 [/signups? not allowed|signup is disabled/i,'New sign-ups are currently turned off.'],
 [/manual linking is disabled|identity.*link/i,'Linking GitHub is not enabled for this site yet.'],
 [/failed to fetch|networkerror|load failed/i,'Could not reach the sign-in service. Check your connection and try again.'],
];
export function friendlyAuthError(message:string|undefined|null,code?:string|number|null):string{
 const text=String(message||'');
 for(const [pattern,friendly] of rules)if(pattern.test(text))return friendly;
 // Unknown error: show only the short machine code (never the raw message) so the team can diagnose it.
 const tag=code!==undefined&&code!==null&&/^[A-Za-z0-9_.-]{1,40}$/.test(String(code))?` (reference: ${code})`:'';
 return `Something went wrong${tag}. Please try again.`;
}
