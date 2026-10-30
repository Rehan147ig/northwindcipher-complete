// Generates the Supabase auth email templates from one branded layout.
// Run: node supabase/templates/build.mjs   (writes the .html files next to this script)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const LOGO = '{{ .SiteURL }}/community/nc-logo.png';
const BRAND = '#6e1423';

const layout = ({ preheader, title, intro, button, link, note, extra = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#faf8f1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#faf8f1;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f1;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dedfd2;border-radius:8px;">
    <tr><td style="padding:28px 32px 8px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;"><img src="${LOGO}" width="44" height="44" alt="Northwind Cipher" style="display:block;border-radius:8px;border:0;"></td>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;color:#273b32;line-height:1.5;">NORTHWIND CIPHER<br><span style="font-family:'Courier New',monospace;font-size:10px;font-weight:400;letter-spacing:1.6px;color:#70776b;">COMMUNITY</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 32px 0 32px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#273b32;">${title}</td></tr>
    <tr><td style="padding:12px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4b564c;">${intro}</td></tr>
    <tr><td style="padding:24px 32px 8px 32px;">
      <a href="${link}" style="display:inline-block;background:${BRAND};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:5px;">${button}</a>
    </td></tr>
    ${extra}
    <tr><td style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#70776b;">Button not working? Paste this link into your browser:<br><a href="${link}" style="color:${BRAND};word-break:break-all;">${link}</a></td></tr>
    <tr><td style="padding:20px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#70776b;border-top:1px solid #efece0;margin-top:20px;">${note}</td></tr>
  </table>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a9f93;padding:16px;">Northwind Cipher · Open source, open doors.</div>
</td></tr>
</table>
</body>
</html>
`;

const code = `<tr><td style="padding:12px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4b564c;">Or enter this code: <strong style="font-family:'Courier New',monospace;font-size:18px;letter-spacing:3px;color:#273b32;">{{ .Token }}</strong></td></tr>`;

const steps = `<tr><td style="padding:20px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#4b564c;"><strong style="color:#273b32;">What happens next</strong><br>1. Confirm your email with the button above.<br>2. Link your GitHub account on your dashboard to become a <em>verified contributor</em>.<br>3. Pick a beginner-friendly issue in CooL and say hello in the virtual office.</td></tr>`;

const templates = {
  confirmation: {
    subject: 'Confirm your Northwind Cipher account',
    html: layout({
      preheader: 'One click to verify your email and join the contributor community.',
      title: 'Welcome to the community.',
      intro: 'Thanks for signing up. Confirm your email address to verify your account and start contributing to CooL.',
      button: 'Confirm my email', link: '{{ .ConfirmationURL }}', extra: code + steps,
      note: 'You received this because {{ .Email }} was used to sign up at Northwind Cipher. If this wasn’t you, you can safely ignore this email; no account is active until the address is confirmed.',
    }),
  },
  magic_link: {
    subject: 'Your Northwind Cipher sign-in link',
    html: layout({
      preheader: 'Use this link to sign in. It expires shortly.',
      title: 'Sign in to your desk.',
      intro: 'Use the button below to sign in. The link works once and expires soon.',
      button: 'Sign in', link: '{{ .ConfirmationURL }}', extra: code,
      note: 'If you didn’t request this, ignore this email. Nobody can sign in without access to your inbox.',
    }),
  },
  recovery: {
    subject: 'Reset your Northwind Cipher password',
    html: layout({
      preheader: 'Choose a new password for your account.',
      title: 'Reset your password.',
      intro: 'We received a request to reset the password for {{ .Email }}. Choose a new one with the button below.',
      button: 'Choose a new password', link: '{{ .ConfirmationURL }}',
      note: 'If you didn’t ask for this, you can ignore this email; your password stays the same.',
    }),
  },
  invite: {
    subject: 'You’re invited to Northwind Cipher',
    html: layout({
      preheader: 'Accept your invitation to the contributor community.',
      title: 'You’re invited.',
      intro: 'A maintainer invited you to join the Northwind Cipher contributor community. Accept to create your account.',
      button: 'Accept invitation', link: '{{ .ConfirmationURL }}',
      note: 'If you weren’t expecting this invitation, you can ignore this email.',
    }),
  },
  email_change: {
    subject: 'Confirm your new email address',
    html: layout({
      preheader: 'Confirm the change to your account email.',
      title: 'Confirm your new email.',
      intro: 'You asked to change your account email from {{ .Email }} to {{ .NewEmail }}. Confirm to finish the change.',
      button: 'Confirm new email', link: '{{ .ConfirmationURL }}',
      note: 'If you didn’t request this change, secure your account and ignore this email.',
    }),
  },
  reauthentication: {
    subject: 'Your Northwind Cipher confirmation code',
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#faf8f1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #dedfd2;border-radius:8px;"><tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:#273b32;"><img src="${LOGO}" width="44" height="44" alt="Northwind Cipher" style="display:block;border-radius:8px;margin-bottom:16px;"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 12px;">Confirm it’s you.</h1><p style="font-size:15px;line-height:1.6;color:#4b564c;">Enter this code to continue:</p><p style="font-family:'Courier New',monospace;font-size:28px;letter-spacing:6px;margin:8px 0 20px;"><strong>{{ .Token }}</strong></p><p style="font-size:12px;color:#70776b;">If you didn’t request this, ignore this email and consider changing your password.</p></td></tr></table></td></tr></table></body></html>
`,
  },
};

const summary = [];
for (const [name, t] of Object.entries(templates)) {
  writeFileSync(join(dir, `${name}.html`), t.html);
  summary.push(`${name.padEnd(16)} ${t.subject}`);
}
writeFileSync(join(dir, 'subjects.txt'), summary.join('\n') + '\n');
console.log(summary.join('\n'));
