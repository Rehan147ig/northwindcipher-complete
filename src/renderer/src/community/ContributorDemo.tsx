import {useEffect,useState} from 'react';
import {DEMO_STAGE_MS,demoStageIndex,demoStages,getDemoMembers,type DemoClock} from './roomDemo';
import type {Profile} from './localState';

export function ContributorDemo({clock,profile}:{clock:DemoClock;profile?:Profile|null}){
 const [elapsed,setElapsed]=useState(clock.elapsedMs);
 useEffect(()=>{
  clock.running=true;
  const timer=setInterval(()=>{setElapsed(clock.elapsedMs);},600);
  return()=>clearInterval(timer);
 },[clock]);
 const stage=demoStageIndex(elapsed);
 const members=getDemoMembers(elapsed);
 const userMember = profile?.name ? {
  id:'user-member',
  name: profile.name,
  handle: profile.name.toLowerCase().replace(/\s+/g,'-'),
  action: 'At personal desk • CooL SDK contributor',
  tag: 'YOU'
 } : null;

 const rohanJoined = elapsed >= 8000;
 const priyaJoined = elapsed >= 22000;

 return <section className="nw-contributor-demo" aria-label="Animated contributor demo">
  <div className="nw-demo-controls">
   <div>
    <span className="nw-eyebrow">AUTOMATIC CONTRIBUTOR WORKFLOW</span>
    <h2>Continuous contribution cycle</h2>
   </div>
   <div className="nw-demo-live-tag">
    <span className="nw-live-pill"><i className="nw-dot-pulse"/> Simulated demo</span>
   </div>
  </div>
  <p className="nw-small nw-muted">Simulated demo room. These are sample characters, not real people: they act out how issues, pull requests and reviews work.</p>
  <div className="nw-demo-stages" role="group" aria-label="Explore sample contribution stages">
   {demoStages.map((s,i)=><button key={s.id} aria-pressed={i===stage} onClick={()=>{clock.elapsedMs=i*DEMO_STAGE_MS;setElapsed(clock.elapsedMs)}}><span>{String(i+1).padStart(2,'0')}</span>{s.name}</button>)}
  </div>
  <p className="nw-demo-story" role="status">{demoStages[stage].description}</p>
  <div className="nw-demo-members" aria-label="Active contributors in room">
   {userMember && (
    <a key={userMember.id} className="nw-member-active-user" href="/community/settings">
     <span className="nw-demo-member-initial" style={{backgroundColor:profile?.color||'#6e1423'}}>{userMember.name[0].toUpperCase()}</span>
     <div><strong>{userMember.name} <small>YOU</small></strong><span>{userMember.action}</span></div>
     <span>↗</span>
    </a>
   )}
   {members.map(m=><a key={m.id} href={`/community/contributors/${m.handle}`}><span className="nw-demo-member-initial">{m.name[0]}</span><div><strong>{m.name} <small>DEMO CHARACTER</small></strong><span>{m.action}</span></div><span>↗</span></a>)}
   {rohanJoined && (
    <div className="nw-dynamic-contributor-card">
     <span className="nw-demo-member-initial" style={{backgroundColor:'#2d5f7c',color:'#fff'}}>R</span>
     <div><strong>Rohan <small>DEMO CHARACTER</small></strong><span>Joined room • reviewing open issues</span></div>
     <span className="nw-new-badge">Demo</span>
    </div>
   )}
   {priyaJoined && (
    <div className="nw-dynamic-contributor-card">
     <span className="nw-demo-member-initial" style={{backgroundColor:'#5b3e6c',color:'#fff'}}>P</span>
     <div><strong>Priya <small>DEMO CHARACTER</small></strong><span>Joined room • testing pull request #4</span></div>
     <span className="nw-new-badge">Demo</span>
    </div>
   )}
  </div>
 </section>;
}
