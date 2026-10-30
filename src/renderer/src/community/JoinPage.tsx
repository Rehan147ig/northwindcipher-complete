import {useEffect,useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {authConfigured,supabase} from './supabase';
import type {Access} from './membership';

export const PROJECT_TYPES:[string,string,string][]=[
 ['contribute_code','Contribute code to CooL','Fix bugs, build features, review pull requests.'],
 ['contribute_docs','Improve docs, tests or design','Guides, examples, test coverage, UI and accessibility.'],
 ['create_plugin','Build a plugin or integration','Extend CooL or connect it to another tool.'],
 ['create_tool','Build a tool or app on top of CooL','A new project that uses the CooL SDK.'],
 ['create_other','Something else','Tell us about it below.'],
];
const COOLDOWN_KEY='nw.join.last';

export function JoinPage({session,access,onNavigate}:{session:Session|null;access:Access;onNavigate:(p:string)=>void}){
 const [name,setName]=useState('');const [email,setEmail]=useState('');
 const [projectType,setProjectType]=useState('contribute_code');
 const [experience,setExperience]=useState('beginner');
 const [skills,setSkills]=useState('');const [details,setDetails]=useState('');
 const [github,setGithub]=useState('');const [link,setLink]=useState('');
 const [conduct,setConduct]=useState(false);const [trap,setTrap]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [sentTo,setSentTo]=useState('');
 useEffect(()=>{
  if(!session)return;
  setEmail(e=>e||session.user.email||'');
  setName(n=>n||String(session.user.user_metadata?.display_name||''));
 },[session]);

 if(sentTo)return <section className="nw-dashboard"><div className="nw-eyebrow">REQUEST RECEIVED</div><h1>Thank you. We will be in touch.</h1><p>The Northwind Cipher team reviews every request. If it is approved, we will send a personal invitation link to <strong>{sentTo}</strong>. You can keep exploring the community in the meantime.</p><div className="nw-actions"><a className="nw-btn" href="/community">Back to the community</a></div></section>;
 if(access.state==='approved')return <section className="nw-dashboard"><div className="nw-eyebrow">REQUEST TO CONTRIBUTE</div><h1>You already have contributor access.</h1><p>Head to your dashboard to find your first issue.</p><div className="nw-actions"><a className="nw-btn" href="/community/dashboard">Open dashboard</a></div></section>;

 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError('');
  if(trap)return; // bots fill the hidden field
  if(!supabase){setError('Requests are not available right now. Please try again later.');return}
  if(name.trim().length<2){setError('Please enter your name.');return}
  if(!/^[^@\s]+@[^@\s]+[.][^@\s]+$/.test(email.trim())){setError('That email address does not look valid.');return}
  if(details.trim().length<20){setError('Please describe what you want to work on in at least 20 characters.');return}
  if(github&&!/^[A-Za-z0-9-]{1,39}$/.test(github.trim())){setError('That GitHub username does not look valid.');return}
  if(link&&!/^https:\/\/\S{3,290}$/.test(link.trim())){setError('The link must start with https:// and contain no spaces.');return}
  if(!conduct){setError('Please accept the community guidelines to continue.');return}
  try{const last=Number(localStorage.getItem(COOLDOWN_KEY)||0);if(Date.now()-last<30000){setError('Please wait a moment before sending another request.');return}}catch{/* storage unavailable */}
  setBusy(true);
  const {error:err}=await supabase.from('invitation_requests').insert({
   name:name.trim(),email:email.trim().toLowerCase(),project_type:projectType,experience,
   skills:skills.split(',').map(s=>s.trim()).filter(Boolean).slice(0,20),details:details.trim(),
   github_login:github.trim()||null,link_url:link.trim()||null,accepted_conduct:true,
  });
  setBusy(false);
  if(err){
   if(err.code==='23505')setError('A request for this email is already waiting for review.');
   else if(err.code==='PGRST205'||err.code==='42P01')setError('Requests are not open yet. Please try again soon.');
   else setError('Could not send your request. Please check the details and try again.');
   return;
  }
  try{localStorage.setItem(COOLDOWN_KEY,String(Date.now()))}catch{/* ignore */}
  setSentTo(email.trim().toLowerCase());
 };

 return <section className="nw-dashboard nw-apply" aria-labelledby="join-title">
  <div className="nw-eyebrow">REQUEST TO CONTRIBUTE</div>
  <h1 id="join-title">Tell us what you would like to build.</h1>
  <p>Anyone can explore the community. To contribute, send a short request. The Northwind Cipher team reviews it and, if approved, sends you a personal invitation link. It takes about two minutes and needs no account.</p>
  {!authConfigured&&<div className="nw-auth-warning" role="alert">Requests are not connected yet.</div>}
  {access.state==='rejected'&&<div className="nw-auth-error" role="status">Your last request was not approved.{access.note?` Note from the team: ${access.note}`:''} You are welcome to send a new one.</div>}
  {access.state==='applied'&&<div className="nw-auth-notice" role="status">You already have a request under review. We will email you with the decision.</div>}
  <form className="nw-panel nw-dash-form" onSubmit={submit} noValidate>
   <label>Your name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="name" required/></label>
   <label>Email (we will send your invitation here)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="email" required readOnly={Boolean(session?.user.email)}/></label>
   <fieldset className="nw-fieldset"><legend>What do you want to do?</legend>
    {PROJECT_TYPES.map(([value,label,hint])=><label key={value} className="nw-check nw-choice"><input type="radio" name="projectType" value={value} checked={projectType===value} onChange={()=>setProjectType(value)}/><span><strong>{label}</strong><small>{hint}</small></span></label>)}
   </fieldset>
   <label>Your experience<select value={experience} onChange={e=>setExperience(e.target.value)}><option value="beginner">Beginner: my first open-source contribution</option><option value="intermediate">Intermediate: I have contributed before</option><option value="advanced">Advanced: I maintain or lead projects</option></select></label>
   <label>Skills (comma separated)<input value={skills} onChange={e=>setSkills(e.target.value)} placeholder="TypeScript, Documentation, Testing"/></label>
   <label>Tell us about your idea or what you want to work on ({details.trim().length}/1500)<textarea value={details} onChange={e=>setDetails(e.target.value)} maxLength={1500} rows={6} placeholder="For example: I would like to improve the getting-started guide, or build an editor plugin that uses the CooL SDK."/></label>
   <label>GitHub username (optional)<input value={github} onChange={e=>setGithub(e.target.value)} maxLength={39} placeholder="octocat"/></label>
   <label>A link to an issue, pull request or idea (optional)<input value={link} onChange={e=>setLink(e.target.value)} maxLength={300} placeholder="https://github.com/…"/></label>
   <label className="nw-trap" aria-hidden="true">Leave this empty<input tabIndex={-1} autoComplete="off" value={trap} onChange={e=>setTrap(e.target.value)}/></label>
   <label className="nw-check"><input type="checkbox" checked={conduct} onChange={e=>setConduct(e.target.checked)}/> I agree to be kind, follow the community guidelines and only contribute work I have the right to share.</label>
   {error&&<div className="nw-auth-error" role="alert">{error}</div>}
   <div className="nw-actions"><button className="nw-btn" disabled={busy||!authConfigured}>{busy?'Sending…':'Send request'}</button><a className="nw-btn secondary" href="/community" onClick={ev=>{ev.preventDefault();onNavigate('/community')}}>Cancel</a></div>
  </form>
 </section>;
}
