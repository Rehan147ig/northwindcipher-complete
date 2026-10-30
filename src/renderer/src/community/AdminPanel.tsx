import {useCallback,useEffect,useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';
import {parseRepo} from './repoInput';
import type {Access} from './membership';

type Tab='requests'|'projects'|'reports'|'audit'|'deliveries';
type Project={id:string;slug:string;name:string;summary:string;visibility:string;status:string};
type Repo={id:string;project_id:string;full_name:string;sync_status:string;last_synced_at:string|null};
type Report={id:string;target_type:string;target_id:string;category:string;description:string;status:string;created_at:string};
type Audit={id:string;action:string;resource_type:string;resource_id:string;created_at:string;metadata:Record<string,unknown>};
type Delivery={delivery_id:string;event_type:string;status:string;attempts:number;received_at:string;error:string|null};

const REPORT_STATUSES=['open','reviewing','actioned','dismissed'];
const when=(v:string)=>new Date(v).toLocaleString();
const explain=(message:string)=>/row-level security|permission denied|violates/i.test(message)
 ?'Not allowed. To enroll a repository you must be a verified contributor who owns that GitHub account, or a moderator.'
 :message;

export function AdminPanel({session,access}:{session:Session;access:Access}){
 const [roles,setRoles]=useState<string[]|null>(null);
 const [tab,setTab]=useState<Tab>(access.staff?'requests':'projects');
 const [msg,setMsg]=useState('');
 const isMod=Boolean(roles?.some(r=>r==='moderator'||r==='owner'));
 useEffect(()=>{if(isMod)setTab(t=>t==='projects'?'requests':t)},[isMod]);
 useEffect(()=>{
  if(!supabase)return;
  supabase.from('app_roles').select('role').eq('user_id',session.user.id).then(({data})=>setRoles((data||[]).map((r:{role:string})=>r.role)));
 },[session.user.id]);
 if(roles===null)return <section className="nw-dashboard"><div role="status" className="nw-empty">Loading…</div></section>;
 const tabs:[Tab,string][]=[...(isMod?[['requests','Requests']] as [Tab,string][]:[]),['projects','My projects'],...(isMod?[['reports','Reports'],['audit','Audit log'],['deliveries','GitHub deliveries']] as [Tab,string][]:[])];
 return <section className="nw-dashboard nw-admin" aria-labelledby="admin-title">
  <div className="nw-eyebrow">{isMod?'ADMIN PANEL':'PROJECT MANAGEMENT'}</div>
  <h1 id="admin-title">{isMod?'Community admin.':'Your projects.'}</h1>
  {!isMod&&<p>Moderation tools are visible to moderators only. You can create projects and connect their GitHub repositories here.</p>}
  <div role="tablist" className="nw-room-tabs" aria-label="Admin sections">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} aria-pressed={tab===id} onClick={()=>{setTab(id);setMsg('')}}>{label}</button>)}</div>
  {msg&&<div role="status" className="nw-auth-notice">{msg}</div>}
  {tab==='projects'&&<Projects session={session} setMsg={setMsg}/>}
  {isMod&&tab==='requests'&&<Requests setMsg={setMsg}/>}
  {isMod&&tab==='reports'&&<Reports setMsg={setMsg}/>}
  {isMod&&tab==='audit'&&<AuditLog/>}
  {isMod&&tab==='deliveries'&&<Deliveries session={session}/>}
 </section>;
}

function Projects({session,setMsg}:{session:Session;setMsg:(m:string)=>void}){
 const [projects,setProjects]=useState<Project[]>([]);const [repos,setRepos]=useState<Repo[]>([]);
 const [slug,setSlug]=useState('');const [name,setName]=useState('');const [summary,setSummary]=useState('');const [visibility,setVisibility]=useState('public');
 const [repoInput,setRepoInput]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase)return;
  const p=await supabase.from('projects').select('*').eq('owner_user_id',session.user.id).order('created_at',{ascending:false});
  if(p.error){setMsg(p.error.message);return}
  setProjects(p.data as Project[]);
  const ids=(p.data||[]).map((x:{id:string})=>x.id);
  if(ids.length){const r=await supabase.from('repositories').select('*').in('project_id',ids);setRepos((r.data||[]) as Repo[])}else setRepos([]);
 },[session.user.id,setMsg]);
 useEffect(()=>{load()},[load]);
 const create=async(e:FormEvent)=>{
  e.preventDefault();if(!supabase)return;setBusy(true);setMsg('');
  if(!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)){setBusy(false);setMsg('Slug: 2–49 lowercase letters, numbers or hyphens.');return}
  const {error}=await supabase.from('projects').insert({slug,name:name.trim(),summary:summary.trim(),visibility,owner_user_id:session.user.id});
  setBusy(false);
  if(error){setMsg(error.code==='23505'?'That slug is already taken.':explain(error.message));return}
  setSlug('');setName('');setSummary('');setMsg('Project created. You are its first maintainer.');load();
 };
 const enroll=async(project:Project)=>{
  if(!supabase)return;setMsg('');
  const parsed=parseRepo(repoInput[project.id]||'');
  if(!parsed){setMsg('Enter a repository as owner/name or a github.com link.');return}
  let id:number;let canonical:string;let branch:string|null;
  try{
   const res=await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,{headers:{Accept:'application/vnd.github+json'}});
   if(res.status===404){setMsg('GitHub could not find that public repository.');return}
   if(!res.ok){setMsg('GitHub is not responding right now. Try again in a minute.');return}
   const body=await res.json();id=body.id;
   if(typeof id!=='number'||!Number.isSafeInteger(id))throw new Error('bad id');
   canonical=String(body.full_name||parsed.fullName);branch=body.default_branch?String(body.default_branch):null;
  }catch{setMsg('Could not look that repository up. Check the name and try again.');return}
  const {error}=await supabase.from('repositories').insert({project_id:project.id,provider_repo_id:id,full_name:canonical,default_branch:branch});
  if(error){setMsg(error.code==='23505'?'That repository is already enrolled.':explain(error.message));return}
  setRepoInput(v=>({...v,[project.id]:''}));setMsg(`Enrolled ${canonical}. Add the webhook in GitHub to start syncing.`);load();
 };
 const unenroll=async(repo:Repo)=>{
  if(!supabase)return;const {error}=await supabase.from('repositories').delete().eq('id',repo.id);
  if(error){setMsg(explain(error.message));return}setMsg(`Removed ${repo.full_name}.`);load();
 };
 return <>
  <form className="nw-panel nw-dash-form" onSubmit={create}>
   <h2>Create a project</h2>
   <label>Slug (URL name)<input value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())} maxLength={49} required/></label>
   <label>Name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} required/></label>
   <label>Summary<input value={summary} onChange={e=>setSummary(e.target.value)} maxLength={500}/></label>
   <label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Public</option><option value="private">Private</option></select></label>
   <div className="nw-actions"><button className="nw-btn" disabled={busy}>{busy?'Creating…':'Create project'}</button></div>
  </form>
  {!projects.length&&<div className="nw-empty">You have no projects yet.</div>}
  {projects.map(p=><div className="nw-panel nw-dash-form" key={p.id}>
   <h3>{p.name} <small>/{p.slug} · {p.visibility}</small></h3>
   {repos.filter(r=>r.project_id===p.id).map(r=><div key={r.id} className="nw-admin-row"><span>{r.full_name} <small>({r.sync_status}{r.last_synced_at?`, last sync ${when(r.last_synced_at)}`:', no events yet'})</small></span><button className="nw-text-button" onClick={()=>unenroll(r)}>Remove</button></div>)}
   <label>Connect a GitHub repository<input placeholder="owner/name or https://github.com/owner/name" value={repoInput[p.id]||''} onChange={e=>setRepoInput(v=>({...v,[p.id]:e.target.value}))}/></label>
   <div className="nw-actions"><button type="button" className="nw-btn small" onClick={()=>enroll(p)}>Enroll repository</button></div>
  </div>)}
 </>;
}

type Request={id:string;name:string;email:string;project_type:string;experience:string;skills:string[];details:string;github_login:string|null;link_url:string|null;status:string;review_note:string|null;created_at:string;reviewed_at:string|null;invite_code:string|null;redeemed_at:string|null};
const TYPE_LABEL:Record<string,string>={contribute_code:'Contribute code to CooL',contribute_docs:'Improve docs, tests or design',create_plugin:'Build a plugin or integration',create_tool:'Build a tool or app on CooL',create_other:'Something else'};
const inviteLink=(code:string)=>`${location.origin}/community/signup?invite=${code}`;

function Requests({setMsg}:{setMsg:(m:string)=>void}){
 const [pending,setPending]=useState<Request[]|null>(null);const [decided,setDecided]=useState<Request[]>([]);
 const [notes,setNotes]=useState<Record<string,string>>({});const [busy,setBusy]=useState('');
 const load=useCallback(async()=>{
  if(!supabase)return;
  const p=await supabase.from('invitation_requests').select('*').eq('status','pending').order('created_at',{ascending:true}).limit(50);
  if(p.error){setMsg(p.error.message);setPending([]);return}
  setPending(p.data as Request[]);
  const d=await supabase.from('invitation_requests').select('*').neq('status','pending').order('reviewed_at',{ascending:false}).limit(20);
  setDecided((d.data||[]) as Request[]);
 },[setMsg]);
 useEffect(()=>{load()},[load]);
 const decide=async(r:Request,decision:'approved'|'rejected')=>{
  if(!supabase)return;
  if(decision==='rejected'&&!(notes[r.id]||'').trim()){setMsg('Please add a short note so the person knows why.');return}
  setBusy(r.id);setMsg('');
  const {data,error}=await supabase.rpc('review_invitation_request',{request_id:r.id,decision,note:(notes[r.id]||'').trim()||null});
  setBusy('');
  if(error){setMsg(error.code==='42501'?'Only moderators can review requests.':'Could not save the decision: '+error.message);return}
  const row=data as Request|null;
  setMsg(decision==='rejected'?'Rejected, with your note.':row?.redeemed_at?'Approved. They already had an account, so access is active now.':'Approved. Copy the invitation link below and send it to '+r.email+'.');
  load();
 };
 const copy=async(code:string)=>{try{await navigator.clipboard.writeText(inviteLink(code));setMsg('Invitation link copied. Send it to the person by email.')}catch{setMsg('Could not copy automatically. Link: '+inviteLink(code))}};
 if(!pending)return <div role="status" className="nw-empty">Loading requests…</div>;
 return <>
  {!pending.length&&<div className="nw-empty">No requests waiting.</div>}
  <div className="nw-admin-list">{pending.map(r=><div className="nw-panel nw-request" key={r.id}>
   <h3>{r.name} <small>{r.email} · {r.experience}</small></h3>
   <p><strong>{TYPE_LABEL[r.project_type]||r.project_type}</strong></p>
   <p>{r.details}</p>
   <ul className="nw-reasons">
    {r.skills.map(s=><li key={s}>{s}</li>)}
    {r.github_login&&<li>GitHub: <a href={`https://github.com/${r.github_login}`} target="_blank" rel="noopener noreferrer">@{r.github_login}</a></li>}
    {r.link_url&&<li><a href={r.link_url} target="_blank" rel="noopener noreferrer">Link ↗</a></li>}
   </ul>
   <small>Sent {when(r.created_at)}</small>
   <label>Note to the person (required to reject)<input value={notes[r.id]||''} onChange={e=>setNotes(v=>({...v,[r.id]:e.target.value}))} maxLength={1000}/></label>
   <div className="nw-actions"><button className="nw-btn small" disabled={busy===r.id} onClick={()=>decide(r,'approved')}>Approve and create invite</button><button className="nw-btn small secondary" disabled={busy===r.id} onClick={()=>decide(r,'rejected')}>Reject</button></div>
  </div>)}</div>
  {decided.length>0&&<><h2>Recently decided</h2><div className="nw-admin-list">{decided.map(r=><div className="nw-admin-row" key={r.id}>
   <span><strong>{r.name}</strong> · {r.email} · {r.status}{r.status==='approved'?(r.redeemed_at?' · joined':' · invite not used yet'):''}{r.review_note?` — ${r.review_note}`:''}</span>
   {r.status==='approved'&&!r.redeemed_at&&r.invite_code&&<button className="nw-btn small secondary" onClick={()=>copy(r.invite_code!)}>Copy invite link</button>}
  </div>)}</div></>}
 </>;
}

function Reports({setMsg}:{setMsg:(m:string)=>void}){
 const [rows,setRows]=useState<Report[]|null>(null);
 const load=useCallback(async()=>{
  if(!supabase)return;
  const {data,error}=await supabase.from('reports').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){setMsg(error.message);return}setRows(data as Report[]);
 },[setMsg]);
 useEffect(()=>{load()},[load]);
 const setStatus=async(id:string,status:string)=>{
  if(!supabase)return;const {error}=await supabase.from('reports').update({status}).eq('id',id);
  if(error){setMsg(explain(error.message));return}setMsg('Report updated and recorded in the audit log.');load();
 };
 if(!rows)return <div role="status" className="nw-empty">Loading reports…</div>;
 if(!rows.length)return <div className="nw-empty">No reports. 🎉</div>;
 return <div className="nw-admin-list">{rows.map(r=><div className="nw-panel" key={r.id}>
  <strong>{r.category}</strong> · {r.target_type}: {r.target_id} <small>{when(r.created_at)}</small>
  {r.description&&<p>{r.description}</p>}
  <label>Status <select value={r.status} onChange={e=>setStatus(r.id,e.target.value)}>{REPORT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
 </div>)}</div>;
}

function AuditLog(){
 const [rows,setRows]=useState<Audit[]|null>(null);
 useEffect(()=>{
  if(!supabase)return;
  supabase.from('audit_events').select('*').order('created_at',{ascending:false}).limit(100).then(({data})=>setRows((data||[]) as Audit[]));
 },[]);
 if(!rows)return <div role="status" className="nw-empty">Loading audit log…</div>;
 if(!rows.length)return <div className="nw-empty">No audit events yet.</div>;
 return <div className="nw-admin-list">{rows.map(a=><div className="nw-admin-row" key={a.id}><span><strong>{a.action}</strong> · {a.resource_type} {a.resource_id.slice(0,8)}</span><small>{when(a.created_at)}</small></div>)}</div>;
}

function Deliveries({session}:{session:Session}){
 const [rows,setRows]=useState<Delivery[]|null>(null);const [err,setErr]=useState('');
 useEffect(()=>{
  fetch('/api/admin?resource=deliveries',{headers:{Authorization:`Bearer ${session.access_token}`}})
   .then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error==='not_configured'?'The server is missing its Supabase service key.':b.error==='forbidden'?'Moderators only.':'Could not load deliveries.');setRows(b.deliveries as Delivery[])})
   .catch(e=>setErr(e.message));
 },[session.access_token]);
 if(err)return <div className="nw-auth-error" role="alert">{err}</div>;
 if(!rows)return <div role="status" className="nw-empty">Loading deliveries…</div>;
 if(!rows.length)return <div className="nw-empty">No webhook deliveries yet. Add the webhook in your GitHub repository settings.</div>;
 return <div className="nw-admin-list">{rows.map(d=><div className="nw-admin-row" key={d.delivery_id}><span><strong>{d.event_type}</strong> · {d.status}{d.error?` — ${d.error}`:''}</span><small>{when(d.received_at)}</small></div>)}</div>;
}
