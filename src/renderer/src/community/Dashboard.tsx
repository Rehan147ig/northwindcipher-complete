import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {authConfigured,supabase,fetchAuthSettings,type AuthSettings,type ContributorProfile} from './supabase';
import {friendlyAuthError} from './authErrors';
import {events,issues,projects} from './data';
import {nextStep,onboardingSteps,recommendIssues} from './recommend';
import type {LocalData} from './localState';
import type {Access} from './membership';

export function useSession(){
 const [session,setSession]=useState<Session|null>(null);const [ready,setReady]=useState(!authConfigured);
 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setReady(true)}});
  const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return()=>{alive=false;sub.subscription.unsubscribe()};
 },[]);
 return {session,ready};
}

type Props={session:Session;local:LocalData;access:Access;onNavigate:(p:string)=>void;onSave:(id:string)=>void;onSyncSaved:(ids:string[])=>void};
const PRESENCE:[string,string][]=[['hidden','Hidden: nobody sees me online'],['online','Online'],['away','Away'],['dnd','Do not disturb']];
const sameSet=(a:string[],b:string[])=>a.length===b.length&&a.every(x=>b.includes(x));

export function Dashboard({session,local,access,onNavigate,onSave,onSyncSaved}:Props){
 const approved=access.state==='approved';
 const [profile,setProfile]=useState<ContributorProfile|null>(null);
 const [name,setName]=useState('');const [skills,setSkills]=useState('');
 const [presence,setPresence]=useState('hidden');const [idle,setIdle]=useState(false);const [showContrib,setShowContrib]=useState(true);
 const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
 const [settings,setSettings]=useState<AuthSettings|null>(null);
 const [remoteSaved,setRemoteSaved]=useState<string[]|null>(null);
 const firstSync=useRef(true);
 useEffect(()=>{let alive=true;fetchAuthSettings().then(v=>{if(alive)setSettings(v)});return()=>{alive=false}},[]);
 const emailConfirmed=Boolean(session.user.email_confirmed_at);

 const load=useCallback(async()=>{
  if(!supabase)return;
  // The server decides verification (confirmed email + linked GitHub); fall back to a plain read if the function is missing.
  let row:ContributorProfile|null=null;
  const rpc=await supabase.rpc('refresh_my_verification');
  if(!rpc.error&&rpc.data)row=rpc.data as ContributorProfile;
  else{
   const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
   if(error){setMsg('Could not load your profile: '+error.message);return}
   row=data as ContributorProfile|null;
  }
  const p:ContributorProfile=row||{id:session.user.id,display_name:String(session.user.user_metadata?.display_name||session.user.email?.split('@')[0]||'Contributor'),skills:[],color:'#6e1423',github_login:null,verified_at:null,saved_issues:[]};
  setProfile(p);setName(p.display_name);setSkills((p.skills||[]).join(', '));
  setPresence(p.presence_mode||'hidden');setIdle(Boolean(p.idle_detection));setShowContrib(p.show_contributions!==false);
  setRemoteSaved(p.saved_issues||[]);
 },[session.user]);
 useEffect(()=>{load()},[load]);

 // Saved issues follow the account: merge both lists once on load, then mirror every change.
 useEffect(()=>{
  if(!supabase||remoteSaved===null||!approved)return;
  let target=local.saved;
  if(firstSync.current){
   firstSync.current=false;
   target=[...new Set([...local.saved,...remoteSaved])].slice(0,100);
   if(!sameSet(target,local.saved))onSyncSaved(target);
  }
  if(sameSet(target,remoteSaved))return;
  supabase.from('profiles').update({saved_issues:target}).eq('id',session.user.id).then(({error})=>{if(!error)setRemoteSaved(target)});
 },[local.saved,remoteSaved,session.user.id,onSyncSaved,approved]);

 const currentSkills=useMemo(()=>skills.split(',').map(s=>s.trim()).filter(Boolean),[skills]);
 const steps=useMemo(()=>onboardingSteps({emailConfirmed,displayName:profile?.display_name||'',skills:profile?.skills||[],approved,githubLinked:Boolean(profile?.github_login),saved:local.saved.length,events:local.attendance.length}),[emailConfirmed,profile,approved,local.saved.length,local.attendance.length]);
 const doneCount=steps.filter(s=>s.done).length;
 const next=nextStep(steps);
 const recs=useMemo(()=>recommendIssues(profile?.skills||[],local.saved,issues,projects,3),[profile?.skills,local.saved]);
 const savedIssues=local.saved.map(id=>issues.find(i=>i.id===id)).filter((i):i is NonNullable<typeof i>=>Boolean(i));
 const upcoming=events.filter(e=>Date.parse(e.date)>=Date.now()).slice(0,2);

 const save=async(e:FormEvent)=>{
  e.preventDefault();
  if(!supabase||!profile)return;
  setBusy(true);setMsg('');
  // Only the fields members may edit; verification fields are server-controlled.
  const next={id:profile.id,display_name:name.trim().slice(0,40)||'Contributor',skills:currentSkills.slice(0,20),color:profile.color,...(approved?{saved_issues:local.saved.slice(0,100)}:{})};
  const {error}=await supabase.from('profiles').upsert(next);
  setBusy(false);
  if(error){setMsg('Could not save: '+error.message);return}
  setProfile({...profile,...next});if(next.saved_issues)setRemoteSaved(next.saved_issues);setMsg('Profile saved.');
 };
 const savePrivacy=async(e:FormEvent)=>{
  e.preventDefault();
  if(!supabase||!profile)return;
  setBusy(true);setMsg('');
  const {error}=await supabase.from('profiles').update({presence_mode:presence,idle_detection:idle,show_contributions:showContrib}).eq('id',profile.id);
  setBusy(false);
  setMsg(error?'Privacy settings are not available yet (the latest database update has not been applied).':'Privacy settings saved.');
 };
 const linkGithub=async()=>{
  if(!supabase)return;
  const {error}=await supabase.auth.linkIdentity({provider:'github',options:{redirectTo:`${location.origin}/community/dashboard`}});
  if(error)setMsg(friendlyAuthError(error.message));
 };
 const signOut=async()=>{await supabase?.auth.signOut();onNavigate('/community')};

 const [confirmDelete,setConfirmDelete]=useState('');
 const callAccount=async(method:'GET'|'DELETE')=>{
  const res=await fetch('/api/account',{method,headers:{Authorization:`Bearer ${session.access_token}`,...(method==='DELETE'?{'Content-Type':'application/json'}:{})},body:method==='DELETE'?JSON.stringify({confirm:'DELETE'}):undefined});
  const body=await res.json().catch(()=>({}));
  return {ok:res.ok,status:res.status,body};
 };
 const exportData=async()=>{
  setMsg('');
  const r=await callAccount('GET');
  if(!r.ok){setMsg(r.status===404?'The account service is not available here yet.':'Could not export your data.');return}
  const url=URL.createObjectURL(new Blob([JSON.stringify(r.body,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='northwind-cipher-data.json';a.click();URL.revokeObjectURL(url);
 };
 const deleteAccount=async()=>{
  if(confirmDelete!=='DELETE')return;
  const r=await callAccount('DELETE');
  if(r.status===409){setMsg('You own projects. Archive them or hand them to another maintainer first.');return}
  if(!r.ok){setMsg('Could not delete your account.');return}
  await supabase?.auth.signOut();onNavigate('/community');
 };

 const verified=Boolean(profile?.verified_at);
 const stepAction=(id:string)=>{
  if(id==='profile')return <a className="nw-btn small" href="#profile">Edit profile ↓</a>;
  if(id==='access')return access.state==='applied'?<span className="nw-small nw-muted">Under review</span>:<a className="nw-btn small" href="/community/join">{access.state==='rejected'?'Send a new request':'Request access'} ↗</a>;
  if(id==='github')return settings?.github?<button type="button" className="nw-btn small" onClick={linkGithub}>Link GitHub ↗</button>:<span className="nw-small nw-muted">GitHub sign-in is being set up.</span>;
  if(id==='first')return <a className="nw-btn small" href="/community/projects?beginner=1">Find an issue ↗</a>;
  return null;
 };
 return <section className="nw-dashboard" aria-labelledby="dash-title">
  <div className="nw-eyebrow">CONTRIBUTOR DASHBOARD</div>
  <h1 id="dash-title">Hello, {profile?.display_name||'contributor'}.</h1>
  <p>{session.user.email}{verified&&<> · <strong>Verified contributor ✓</strong></>}</p>
  {msg&&<div role="status" className="nw-auth-notice">{msg}</div>}
  {access.state==='none'&&<div className="nw-panel nw-gate" role="status"><strong>You can explore the community.</strong> To contribute, send a short request and the Northwind Cipher team will review it. <a className="nw-btn small" href="/community/join">Request to contribute ↗</a></div>}
  {access.state==='applied'&&<div className="nw-panel nw-gate" role="status"><strong>Your request is under review.</strong> We will email you with the decision. Until then you can browse, but not take action.</div>}
  {access.state==='rejected'&&<div className="nw-panel nw-gate" role="status"><strong>Your last request was not approved.</strong>{access.note?` Note from the team: ${access.note}`:''} <a className="nw-btn small" href="/community/join">Send a new request ↗</a></div>}

  <section className="nw-panel nw-path" aria-labelledby="path-title">
   <h2 id="path-title">{next?`Your path: ${doneCount} of ${steps.length} steps`:'You are all set 🎉'}</h2>
   <progress value={doneCount} max={steps.length} aria-label="Onboarding progress"/>
   <ol className="nw-path-list">
    {steps.map(s=><li key={s.id} className={s.done?'done':s.id===next?.id?'current':''}>
     <span className="nw-path-mark" aria-hidden="true">{s.done?'✓':'○'}</span>
     <div><strong>{s.title}</strong><span>{s.done?'Done':s.hint}</span></div>
     {!s.done&&s.id===next?.id&&<div className="nw-path-action">{stepAction(s.id)}</div>}
    </li>)}
   </ol>
  </section>

  <section className="nw-panel" aria-labelledby="rec-title">
   <h2 id="rec-title">Recommended for you</h2>
   <p className="nw-small nw-muted">{currentSkills.length?'Ranked by your skills. Each suggestion says why.':'Add skills to your profile for better matches. These are good places to start.'}</p>
   {!recs.length?<div className="nw-empty">You have saved every suggestion. <a href="/community/projects">Browse all projects →</a></div>:
    <div className="nw-issue-list">{recs.map(r=><article className="nw-issue" key={r.issue.id}>
     <span className="nw-issue-symbol">◉</span>
     <div><div className="nw-issue-meta">{r.project?.name} <span>#{r.issue.number} · Demo issue</span></div>
      <a href={`/community/projects/${r.issue.project}#issues`}><h3>{r.issue.title}</h3></a>
      <ul className="nw-reasons">{r.reasons.map(x=><li key={x}>{x}</li>)}</ul></div>
     <button className="nw-save" disabled={!approved} title={approved?undefined:'Contributor access is needed to save issues'} onClick={()=>onSave(r.issue.id)}>Save +</button>
    </article>)}</div>}
  </section>

  <section className="nw-panel" aria-labelledby="resume-title">
   <h2 id="resume-title">Pick up where you left off</h2>
   {!savedIssues.length?<div className="nw-empty">Nothing saved yet. Save an issue above and it will appear here on every device.</div>:
    <div className="nw-issue-list">{savedIssues.map(i=><article className="nw-issue" key={i.id}>
     <span className="nw-issue-symbol">◉</span>
     <div><div className="nw-issue-meta">{projects.find(p=>p.slug===i.project)?.name} <span>#{i.number}</span></div><a href={`/community/projects/${i.project}#issues`}><h3>{i.title}</h3></a></div>
     <button className="nw-save is-saved" aria-pressed="true" onClick={()=>onSave(i.id)}>Saved ✓</button>
    </article>)}</div>}
  </section>

  <section className="nw-panel" aria-labelledby="events-title">
   <h2 id="events-title">Coming up</h2>
   {!upcoming.length?<div className="nw-empty">No upcoming events yet.</div>:
    upcoming.map(e=><div className="nw-admin-row" key={e.id}><span><strong>{e.name}</strong> · {new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(e.date))}</span><a className="nw-text-link" href="/community/events">{local.attendance.includes(e.id)?'Interested ✓':'Details →'}</a></div>)}
  </section>

  <div className="nw-people">
   <a className="nw-panel" href="/community/admin"><h3>{access.staff?'Admin portal':'Manage projects'}</h3><p>{access.staff?'Review requests, reports and activity.':'Create projects and connect repositories.'}</p></a>
   <a className="nw-panel" href="/community/avatar"><h3>Your character</h3><p>Design how you look in the office.</p></a>
   <a className="nw-panel" href="/community/world"><h3>Enter the office</h3><p>Walk in as {profile?.display_name||'yourself'} (demo office).</p></a>
  </div>

  <form id="profile" className="nw-panel nw-dash-form" onSubmit={save}>
   <h2>Your profile</h2>
   <label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} required/></label>
   <label>Skills (comma separated, e.g. TypeScript, Documentation)<input value={skills} onChange={e=>setSkills(e.target.value)}/></label>
   <div className="nw-actions"><button className="nw-btn" disabled={busy||!profile}>{busy?'Saving…':'Save profile'}</button><button type="button" className="nw-btn secondary" onClick={signOut}>Sign out</button></div>
  </form>

  <form className="nw-panel nw-dash-form" onSubmit={savePrivacy}>
   <h2>Presence and privacy</h2>
   <p className="nw-small nw-muted">Hidden by default. Presence is never used to score or rank you.</p>
   <label>Who can see I am online<select value={presence} onChange={e=>setPresence(e.target.value)}>{PRESENCE.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label className="nw-check"><input type="checkbox" checked={idle} onChange={e=>setIdle(e.target.checked)}/> Mark me away when I am idle</label>
   <label className="nw-check"><input type="checkbox" checked={showContrib} onChange={e=>setShowContrib(e.target.checked)}/> Show my verified contributions on my public profile</label>
   <div className="nw-actions"><button className="nw-btn secondary" disabled={busy||!profile}>Save privacy settings</button></div>
  </form>

  <div className="nw-panel nw-dash-form">
   <h2>Your data</h2>
   <p>Download everything we store about you, or delete your account. Deleting removes your profile and sign-in; reports you filed are kept anonymously for moderation.</p>
   <div className="nw-actions"><button type="button" className="nw-btn secondary" onClick={exportData}>Export my data</button></div>
   <label>Type DELETE to enable account deletion<input value={confirmDelete} onChange={e=>setConfirmDelete(e.target.value)} autoComplete="off"/></label>
   <div className="nw-actions"><button type="button" className="nw-btn" disabled={confirmDelete!=='DELETE'} onClick={deleteAccount}>Delete my account</button></div>
  </div>
 </section>;
}
