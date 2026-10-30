import {lazy,Suspense,useEffect,useRef} from 'react';
import {rooms,avatarColor} from './world';
import {ContributorDemo} from './ContributorDemo';
import {coolRepository} from './coolRepository';
import type {DemoClock} from './roomDemo';
import type {AvatarSpec} from '../scene/office/avatar';
import type {LocalData} from './localState';

const OfficeGame=lazy(()=>import('./OriginalCommunityOffice'));
type Props={avatar?:AvatarSpec|null;data:LocalData;room:string;onRoom:(room:string)=>void;onNavigate:(path:string)=>void;onProfile:()=>void};

export function WorkspaceHome({avatar,data,room,onRoom,onNavigate,onProfile}:Props){
 const demoClock=useRef<DemoClock>({elapsedMs:0,running:true});
 useEffect(()=>{demoClock.current.elapsedMs=0;demoClock.current.running=true;},[room]);
 const memberCount = 3 + (data.profile ? 1 : 0) + (demoClock.current.elapsedMs >= 22000 ? 2 : demoClock.current.elapsedMs >= 8000 ? 1 : 0);

 return <section className="nw-workspace" aria-labelledby="workspace-title">
  <div className="nw-workspace-heading">
   <div><div className="nw-eyebrow">Northwindcipher / COMMUNITY</div><h1 id="workspace-title">CooL contributor workspace.</h1><p>The original office and characters, connected to CooL contributor tools.</p></div>
   <div className="nw-workspace-identity"><span className="nw-workspace-avatar" style={{backgroundColor:avatarColor(data.profile?.color||'#6e1423')}}>{data.profile?.name.slice(0,2).toUpperCase()||'G'}</span><div><strong>{data.profile?.name||'Guest explorer'}</strong><button className="nw-text-button" onClick={onProfile}>{data.profile?'Edit your profile':'Set up your profile'} ↗</button></div></div>
  </div>
  <div className="nw-workspace-layout">
   <div className="nw-office-shell">
    <div className="nw-workspace-toolbar">
      <div role="group" aria-label="Choose workspace room" className="nw-room-tabs">{rooms.map(r=><button key={r.id} aria-pressed={room===r.id} onClick={()=>onRoom(r.id)}>{r.id==='hq'?'Headquarters':r.id==='cool-sdk'?'CooL SDK room':'Meeting room'}</button>)}</div>
      <div className="nw-workspace-live-status" role="status"><i className="nw-dot-pulse"/><span className="nw-presence-count">{memberCount} simulated characters</span></div>
    </div>
    <Suspense fallback={<div className="nw-workspace-loading" role="status"><span>Opening your workspace…</span><p>Your projects are available in the shortcuts alongside the office.</p></div>}><OfficeGame room={room} color={data.profile?.color||'#6e1423'} profile={data.profile} avatarSpec={avatar} onNavigate={onNavigate} onRoom={onRoom} demoClock={demoClock.current} compact/></Suspense>
    <ContributorDemo clock={demoClock.current} profile={data.profile}/>
   </div>
   <aside className="nw-workspace-sidebar" aria-label="Workspace shortcuts">
    <div className="nw-sidebar-title"><h2>Contribute to CooL</h2><p>Real repository. Simulated office walkthrough.</p></div><a className="nw-cool-repo-shortcut" href={coolRepository.url} target="_blank" rel="noopener noreferrer"><strong>Northwind-Cipher / cool-sdk ↗</strong><span>Open the source repository</span></a>
    <a className="nw-workspace-shortcut" href="/community"><span className="nw-shortcut-icon">🏠</span><div><strong>Community Overview</strong><span>Landing page, guides, and principles</span></div><span>↗</span></a>
    <a className="nw-workspace-shortcut" href="/community/projects"><span className="nw-shortcut-icon">⌘</span><div><strong>Explore CooL SDK</strong><span>Contribution guide, real issues, and pull requests</span></div><span>↗</span></a>
    <a className="nw-workspace-shortcut" href="/community/projects/cool-sdk#issues"><span className="nw-shortcut-icon">◉</span><div><strong>Find a contribution</strong><span>Browse actual work returned by GitHub</span></div><span>↗</span></a>
    <a className="nw-workspace-shortcut" href="/community/contributors"><span className="nw-shortcut-icon">✳</span><div><strong>Meet the community</strong><span>Explore clearly labeled sample profiles</span></div><span>↗</span></a>
    <a className="nw-workspace-shortcut" href="/community/events"><span className="nw-shortcut-icon">📅</span><div><strong>Community events</strong><span>Workshops and time to build together</span></div><span>↗</span></a>
    <a className="nw-workspace-shortcut" href="/community/settings#saved-work"><span className="nw-shortcut-icon">⭐</span><div><strong>Your saved work <b>{data.saved.length}</b></strong><span>Return to issues you want to work on</span></div><span>↗</span></a>
    <a className="nw-workspace-shortcut" href="/community/avatar"><span className="nw-shortcut-icon">🙂</span><div><strong>Create your character</strong><span>Choose how you look in the office</span></div><span>↗</span></a>
    <details className="nw-workspace-help"><summary>How to use the office</summary><ol><li>Click a desk to open its projects, people, or events.</li><li>Click the floor to walk there, or use WASD and arrow keys.</li><li>When standing near a desk, press E to open it.</li></ol><p>On touch screens, use the arrow buttons below the office. The shortcuts work without moving an avatar.</p></details>
    <div className="nw-workspace-disclosure">CooL repository links and public GitHub reads are real. Animated characters, profiles, and events are demo fixtures. Multiplayer and sign-in are not connected.</div>
   </aside>
  </div>
 </section>;
}
