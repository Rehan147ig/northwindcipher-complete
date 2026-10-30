import {lazy,Suspense,useEffect,useRef,useState,type FormEvent} from 'react';
import {authConfigured,supabase,fetchAuthSettings,type AuthSettings} from './supabase';
import {friendlyAuthError} from './authErrors';
import {safeReturnPath} from './redirect';
import {demoStages,demoStageIndex,type DemoClock} from './roomDemo';

const OfficeGame=lazy(()=>import('./OriginalCommunityOffice'));
const noop=()=>{};
type Props={mode:'login'|'signup';onNavigate:(path:string)=>void};

// The same autoplaying contributor walkthrough as the workspace, shown read-only beside the form.
function AuthDemo({onNavigate}:{onNavigate:(path:string)=>void}){
 const clock=useRef<DemoClock>({elapsedMs:0,running:true});
 const [stage,setStage]=useState(0);
 useEffect(()=>{
  const timer=setInterval(()=>setStage(demoStageIndex(clock.current.elapsedMs)),700);
  return()=>clearInterval(timer);
 },[]);
 return <div className="nw-auth-demo" aria-label="Autoplaying contributor demo">
  <div className="nw-auth-demo-bar"><span><i className="nw-dot-pulse"/> Simulated demo</span><span>{demoStages[stage].name}</span></div>
  <div className="nw-auth-demo-stage">
   <Suspense fallback={<div className="nw-workspace-loading" role="status"><span>Opening the office…</span></div>}>
    <OfficeGame room="hq" color="#6e1423" onNavigate={noop} onRoom={noop} demoClock={clock.current} compact/>
   </Suspense>
  </div>
  <p className="nw-auth-demo-story" role="status">{demoStages[stage].description}</p>
  <button className="nw-text-button" onClick={()=>onNavigate('/community/world')}>Explore the full office without an account ↗</button>
 </div>;
}

export function AuthPage({mode,onNavigate}:Props){
 const signup=mode==='signup';
 const next=safeReturnPath(new URLSearchParams(location.search).get('next'));
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');
 const [settings,setSettings]=useState<AuthSettings|null>(null);
 useEffect(()=>{let alive=true;fetchAuthSettings().then(v=>{if(alive)setSettings(v)});return()=>{alive=false}},[]);
 // Already signed in (e.g. after the email confirmation link): continue to the requested page.
 useEffect(()=>{supabase?.auth.getSession().then(({data})=>{if(data.session)onNavigate(next)})},[next,onNavigate]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const inviteCode=(new URLSearchParams(location.search).get('invite')||'').replace(/[^a-f0-9]/gi,'').slice(0,64);
 const [inviteState,setInviteState]=useState<'none'|'checking'|'valid'|'invalid'>(inviteCode?'checking':'none');
 const [lockedEmail,setLockedEmail]=useState('');
 useEffect(()=>{
  if(!inviteCode||!supabase)return;
  try{localStorage.setItem('nw.invite',inviteCode)}catch{/* storage unavailable */}
  supabase.rpc('check_invitation',{code:inviteCode}).then(({data})=>{
   const row=Array.isArray(data)?data[0]:null;
   if(row){setInviteState('valid');setName(row.name);setEmail(row.email);setLockedEmail(row.email)}else setInviteState('invalid');
  });
 },[inviteCode]);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError('');setNotice('');
  if(!supabase){setError('Sign-in is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');return}
  if(signup&&!name.trim()){setError('Please enter a display name.');return}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())){setError('That email address does not look valid.');return}
  if(password.length<8){setError('Use a password of at least 8 characters.');return}
  setBusy(true);
  try{
   if(signup){
    const {data,error:err}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{display_name:name.trim()||email.split('@')[0]},emailRedirectTo:`${location.origin}${next}`}});
    if(err)throw err;
    if(data.session)onNavigate(next);else setNotice('Check your email to confirm your account, then log in.');
   }else{
    const {error:err}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(err)throw err;
    onNavigate(next);
   }
  }catch(err){const e=err as {message?:string;code?:string;status?:number};console.error('auth error',e?.status,e?.code,e?.message);setError(friendlyAuthError(e?.message,e?.code||e?.status))}
  finally{setBusy(false)}
 };
 const oauth=async()=>{if(!supabase)return;const {error:err}=await supabase.auth.signInWithOAuth({provider:'github',options:{redirectTo:`${location.origin}${next}`}});if(err)setError(friendlyAuthError(err.message))};
 return <section className="nw-auth" aria-labelledby="auth-title">
  <div className="nw-auth-card">
   <div className="nw-eyebrow">{signup?'JOIN THE COMMUNITY':'WELCOME BACK'}</div>
   <h1 id="auth-title">{signup?'Become a contributor.':'Log in to your desk.'}</h1>
   <p>{signup?'Create an account to keep your profile, saved issues and contributions in one place.':'Pick up where you left off.'}</p>
   {!authConfigured&&<div className="nw-auth-warning" role="alert">Sign-in is not connected yet. Add your Supabase keys to <code>.env</code> (see <code>.env.example</code>).</div>}
   {inviteState==='valid'&&<div className="nw-auth-notice" role="status">You have been invited. Finish creating your account with the email below.</div>}
   {inviteState==='invalid'&&<div className="nw-auth-error" role="alert">This invitation link is not valid or has already been used. <a href="/community/join">Request a new invitation</a>.</div>}
   <form onSubmit={submit} noValidate>
    {signup&&<label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} autoComplete="nickname" required/></label>}
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required readOnly={Boolean(lockedEmail)}/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={signup?'new-password':'current-password'} minLength={8} required/></label>
    {error&&<div className="nw-auth-error" role="alert">{error}</div>}
    {notice&&<div className="nw-auth-notice" role="status">{notice}</div>}
    <button className="nw-btn" type="submit" disabled={busy||!authConfigured}>{busy?'Please wait…':signup?'Create account':'Log in'} <span>↗</span></button>
    {settings?.github&&<button className="nw-btn secondary" type="button" onClick={oauth}>Continue with GitHub</button>}
   </form>
   <p className="nw-auth-switch">{signup?<>Already a contributor? <a href="/community/login">Log in</a></>:<>New here? <a href="/community/signup">Create an account</a></>}</p>
   <p className="nw-small nw-muted">Want to contribute? <a href="/community/join">Request an invitation</a>.</p>
  </div>
  <AuthDemo onNavigate={onNavigate}/>
 </section>;
}
