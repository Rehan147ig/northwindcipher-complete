// Checks a Gmail (or any SMTP over TLS, port 465) login directly, WITHOUT sending any email.
// The password is typed at a hidden prompt in your own terminal; it is never printed or stored.
//   npm run smtp:test
import tls from 'node:tls';
import readline from 'node:readline';

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    let muted = hidden;
    rl._writeToOutput = (s) => { if (!muted || s === '\r\n' || s === '\n') process.stdout.write(s); else process.stdout.write('*'); };
    rl.question('', (a) => { muted = false; rl.close(); resolve(a.trim()); });
  });
}

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER || (await ask('Gmail address (the Username in Supabase): '));
const raw = process.env.SMTP_PASS || (await ask('App password (hidden): ', true));
const pass = raw.replace(/\s+/g, '');
if (!user || !pass) { console.error('Both values are required.'); process.exit(1); }
if (port !== 465) { console.error('This check supports port 465 only.'); process.exit(1); }
console.log(`\nChecking ${user} against ${host}:${port} (password length ${pass.length}; Google App passwords have 16)...`);

const socket = tls.connect({ host, port, servername: host });
socket.setTimeout(15000, () => { console.error('Timed out connecting. Check your internet or firewall.'); process.exit(1); });
socket.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });

let buffer = '';
const waiters = [];
socket.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let idx;
  while ((idx = buffer.indexOf('\r\n')) !== -1) {
    const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
    // A reply is complete when the 4th character is a space (e.g. "250 OK"), not a dash ("250-...").
    if (/^\d{3} /.test(line) && waiters.length) waiters.shift()({ code: Number(line.slice(0, 3)), text: line });
  }
});
const reply = () => new Promise((resolve) => waiters.push(resolve));
const send = async (command) => { socket.write(command + '\r\n'); return reply(); };

await reply(); // greeting
await send('EHLO northwind.local');
let r = await send('AUTH LOGIN');
r = await send(Buffer.from(user).toString('base64'));
r = await send(Buffer.from(pass).toString('base64'));
socket.write('QUIT\r\n'); socket.end();

if (r.code === 235) {
  console.log('\n✅ Gmail accepted this username and App password.');
  console.log('Use exactly these in Supabase: Host smtp.gmail.com, Port 465, Username = the address above, Password = the same App password (no spaces).');
} else {
  console.log(`\n❌ Gmail refused the login: ${r.text.replace(pass, '***')}`);
  const hint = r.code === 535 ? 'The username or App password is wrong. Create a fresh App password in THIS Google account and paste it again.'
    : r.code === 534 ? 'Google wants an App password: turn on 2-Step Verification, then create one under Security > App passwords.'
    : r.code === 454 || r.code === 421 ? 'Google is throttling or blocking sign-ins right now. Check the inbox of this Gmail for a security alert, then retry in a few minutes.'
    : 'Unexpected reply from the server.';
  console.log(hint);
  process.exit(2);
}
