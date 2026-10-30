import {useEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Texture,type Ticker} from 'pixi.js';
import 'pixi.js/unsafe-eval';
import {TiledMapRenderer,type Point} from '../scene/office/TiledMapRenderer';
import {Character} from '../scene/office/Character';
import {Camera} from '../scene/office/Camera';
import {DeskScreen,MONITOR_OFF_TOPLEFT_GID} from '../scene/office/DeskScreen';
import {getCastFrames,OFFICE_CAST,type OfficeCharacterName} from '../scene/office/cast';
import {OFFICE_THEME,BROOKLYN99_THEME} from '../scene/office/themeRegistry';
import {resolveThemeMap,themeTilesetUrls} from '../scene/office/themeLoader';
import {demoStageIndex,type DemoClock} from './roomDemo';
import type {Profile} from './localState';
import {getAvatarFrames} from '../scene/office/avatarFrames';
import type {AvatarSpec} from '../scene/office/avatar';

type Props={room:string;color:string;profile?:Profile|null;avatarSpec?:AvatarSpec|null;onNavigate:(path:string)=>void;onRoom:(room:string)=>void;compact?:boolean;demoClock?:DemoClock};
const roomLook:Record<string,{title:string;tagline:string;tint:string}>={
 hq:{title:'Northwindcipher HQ',tagline:'Projects, people and events',tint:'transparent'},
 'cool-sdk':{title:'CooL SDK Studio',tagline:'Issues, pull requests and reviews',tint:'rgba(54,120,92,.16)'},
 meeting:{title:'Meeting Room',tagline:'Workshops and build sessions',tint:'rgba(110,20,35,.14)'},
};
// Each room is a different space: HQ and the meeting wing share the office map (the meeting
// room is its boardroom end, zoomed in); the CooL SDK studio is the open bullpen map.
type Layout={theme:typeof OFFICE_THEME;player:string;seats:string[];joinSeats:string[];wander:string[];focus?:{x:number;y:number;zoom:number}};
const layouts:Record<string,Layout>={
 hq:{theme:OFFICE_THEME,player:'entrance',seats:['pc-1','pc-3','desk-product-manager'],joinSeats:['pc-2','pc-4'],wander:['pc-2','pc-4','desk-ui-ux-expert']},
 'cool-sdk':{theme:BROOKLYN99_THEME,player:'entrance',seats:['pc-1','pc-3','pc-5'],joinSeats:['pc-2','pc-4'],wander:['pc-6','pc-7','pc-8']},
 meeting:{theme:OFFICE_THEME,player:'warroom-seat',seats:['desk-agent-organizer','desk-chief-architect','desk-ui-ux-expert'],joinSeats:['cafe-seat-1','cafe-seat-3'],wander:['cafe-seat-2','cafe-seat-4','desk-agent-organizer'],focus:{x:25*16,y:7*16,zoom:2}},
};
type Station={id:string;name:string;tile:Point;route:string};

const joiners:{id:string;name:string;cast:OfficeCharacterName;seat:string;triggerMs:number;welcome:string;thoughts:string[]}[]=[
 {id:'joiner-rohan',name:'Rohan',cast:'jim',seat:'pc-2',triggerMs:8000,welcome:'Demo: Rohan (sample character) joined the office',thoughts:['Joined the room! Exploring cool-sdk issues','Forked cool-sdk repo & setting up','Submitting my first PR!','First contribution accepted!']},
 {id:'joiner-priya',name:'Priya',cast:'kelly',seat:'pc-4',triggerMs:22000,welcome:'Demo: Priya (sample character) joined the office',thoughts:['Joined the room! Reviewing pull request #4','Testing the bugfix locally','Discussing API architecture','Merged and released!']},
];

const cast:{id:string;name:string;cast:OfficeCharacterName;seat:string;profile:string;thoughts:string[]}[]=[
 {id:'demo-maya',name:'Maya',cast:'pam',seat:'pc-1',profile:'maya',thoughts:['Demo: reading a CooL issue','Demo: preparing a pull request','Demo: responding to review','Demo: a sample merge']},
 {id:'demo-arjun',name:'Arjun',cast:'dwight',seat:'pc-3',profile:'arjun',thoughts:['Demo: reading the guide','Demo: adding tests','Demo: reviewing a change','Demo: updating sample notes']},
 {id:'demo-lena',name:'Lena',cast:'angela',seat:'desk-product-manager',profile:'lena',thoughts:['Demo: exploring the docs','Demo: explaining a change','Demo: discussing feedback','Demo: celebrating a sample merge']},
];

function loadTexture(url:string):Promise<Texture>{return new Promise((resolve,reject)=>{const img=new Image();const timer=setTimeout(()=>{img.onload=null;img.onerror=null;reject(new Error('An office asset took too long to load.'))},12000);img.onload=()=>{clearTimeout(timer);const texture=Texture.from(img);texture.source.scaleMode='nearest';resolve(texture)};img.onerror=()=>{clearTimeout(timer);reject(new Error('An original office asset could not be loaded.'))};img.src=url})}

// Reuses the original scene's map, sprite recipes, Character, Camera and monitor
// animation. Deliberately does not import OfficeFloor, the agent store or IPC.
export default function OriginalCommunityOffice({room,color,profile,avatarSpec,onNavigate,onRoom,demoClock}:Props){
 const [avatar,setAvatar]=useState<OfficeCharacterName|'custom'>(avatarSpec?'custom':'jim');
 const avatarKey=avatarSpec?JSON.stringify(avatarSpec):'';
 useEffect(()=>{if(avatarSpec)setAvatar('custom')},[avatarKey]);
 const host=useRef<HTMLDivElement>(null);const controls=useRef({x:0,y:0});const interact=useRef<()=>void>(()=>{});const reset=useRef<()=>void>(()=>{});
 const [status,setStatus]=useState('Loading the original office…');const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);const [nearby,setNearby]=useState(false);
 useEffect(()=>{
  const layout=layouts[room]||layouts.hq;const theme=layout.theme;
  let disposed=false;let initialized=false;let app:Application|undefined;let cleanup=()=>{};
  const actors:Character[]=[];const screens:DeskScreen[]=[];const textures:Texture[]=[];
  const destroy=()=>{const release=cleanup;cleanup=()=>{};release();for(const actor of actors.splice(0))actor.destroy();for(const screen of screens.splice(0))screen.destroy();if(initialized&&app){app.destroy(true,{children:true,texture:false,textureSource:false});initialized=false}for(const texture of textures.splice(0))texture.destroy(true)};
  setStatus('Loading the original office…');setFailed(false);setNearby(false);
  const start=async()=>{
   if(!host.current)return;const holder=host.current;app=new Application();
   await app.init({resizeTo:holder,backgroundColor:0x1a1320,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true,antialias:false,roundPixels:true,powerPreference:'low-power',preference:'webgl'});initialized=true;
   if(disposed){destroy();return}
   const loaded=await Promise.all(themeTilesetUrls(theme).map(loadTexture));textures.push(...loaded);if(disposed){destroy();return}
   holder.appendChild(app.canvas);app.canvas.tabIndex=0;app.canvas.setAttribute('role','img');app.canvas.setAttribute('aria-label','Original animated office. Click the floor to walk, use WASD or arrows, and press E near a workstation. Contributor characters are simulated.');
   const world=new Container();app.stage.addChild(world);const map=new TiledMapRenderer(resolveThemeMap(theme),loaded);world.addChild(map.getContainer());const layer=map.getCharacterContainer();
   const camera=new Camera(world);camera.setMapSize(map.width*map.tileSize,map.height*map.tileSize);camera.setPixelSnap(true,app.renderer.resolution);const mapPx={w:map.width*map.tileSize,h:map.height*map.tileSize};const fitHolder=()=>{if(layout.focus||!holder.parentElement){holder.style.width='';holder.style.height='';holder.style.margin='';return}const dpr=app!.renderer.resolution;const avail=holder.parentElement.clientWidth;if(avail<=0)return;const fit=avail*dpr/mapPx.w;const device=fit>=1?Math.floor(fit+1e-6):fit;const w=mapPx.w*device/dpr,h=mapPx.h*device/dpr;holder.style.width=`${w}px`;holder.style.height=`${h}px`;holder.style.margin='0 auto';app!.renderer.resize(w,h)};fitHolder();const fitObserver=typeof ResizeObserver!=='undefined'&&holder.parentElement?new ResizeObserver(()=>fitHolder()):undefined;if(holder.parentElement)fitObserver?.observe(holder.parentElement);camera.setViewSize(app.screen.width,app.screen.height);camera.fitToScreen();const frame=()=>{if(layout.focus)camera.focusOn(layout.focus.x,layout.focus.y,layout.focus.zoom);else camera.fitToScreen()};frame();
   const spawn=map.getSpawnPoint(layout.player)||map.getSpawnPoint('entrance')||{x:16,y:20};
   const station=(id:string,name:string,spawnName:string,route:string):Station=>({id,name,tile:map.getSpawnPoint(spawnName)||spawn,route});
   const events:Station={id:'events',name:'Community events',tile:theme.anchors.calendar,route:'/community/events'};
   const stationSets:Record<string,Station[]>={
    hq:[station('project','CooL SDK project','pc-2','/community/projects/cool-sdk'),station('issues','CooL issues & pull requests','pc-4','/community/projects/cool-sdk#issues'),station('people','Contributor profiles','desk-chief-architect','/community/contributors'),station('desk','Your saved work','desk-team-lead','/community/settings#saved-work'),station('room','CooL SDK room','desk-agent-organizer','room:cool-sdk'),station('meeting','Meeting room','warroom-seat','room:meeting'),events],
    'cool-sdk':[station('project','CooL SDK project','pc-2','/community/projects/cool-sdk'),station('issues','CooL issues & pull requests','pc-4','/community/projects/cool-sdk#issues'),station('people','Contributor profiles','pc-6','/community/contributors'),station('desk','Your saved work','desk-ceo','/community/settings#saved-work'),station('hq','Headquarters','entrance','room:hq'),station('meeting','Meeting room','cafe-seat-1','room:meeting'),events],
    meeting:[station('people','Contributor profiles','desk-chief-architect','/community/contributors'),station('project','CooL SDK project','desk-ui-ux-expert','/community/projects/cool-sdk'),station('issues','CooL issues & pull requests','desk-agent-organizer','/community/projects/cool-sdk#issues'),station('hq','Headquarters','cafe-seat-2','room:hq'),station('room','CooL SDK room','cafe-seat-4','room:cool-sdk'),events],
   };
   const stations:Station[]=stationSets[room]||stationSets.hq;
   const open=(s:Station)=>s.route.startsWith('room:')?onRoom(s.route.slice(5)):onNavigate(s.route);
   for(const s of stations){const g=new Graphics();g.rect(-14,-35,36,46).fill({color:0xfff8e7,alpha:.001});g.position.set(s.tile.x*16+8,s.tile.y*16+16);g.eventMode='static';g.cursor='pointer';g.on('pointertap',event=>{event.stopPropagation();open(s)});g.on('pointerover',()=>{g.clear().rect(-14,-35,36,46).fill({color:0xfff8e7,alpha:.1}).stroke({color:0xe8c14d,width:1});setStatus('Click · '+s.name)});g.on('pointerout',()=>{g.clear().rect(-14,-35,36,46).fill({color:0xfff8e7,alpha:.001})});g.zIndex=10;layer.addChild(g)}
   const frames=await Promise.all([avatar,...cast.map(c=>c.cast),...joiners.map(j=>j.cast)].map((c,i)=>i===0&&c==='custom'&&avatarSpec?Promise.resolve(getAvatarFrames(avatarSpec)):getCastFrames((c==='custom'?'jim':c) as OfficeCharacterName)));if(disposed){destroy();return}
   const player=new Character({agentId:'community-you',displayName:'YOU',mapRenderer:map,frames:frames[0],seatTile:spawn,spawnTile:spawn,glowColor:Number.parseInt(color.slice(1),16)});player.show(layer);actors.push(player);
   if(profile?.name)player.showThought('Joined as contributor: '+profile.name);
   const members=cast.map((definition,i)=>{const seat=map.getSpawnPoint(layout.seats[i])||spawn;const character=new Character({agentId:definition.id,displayName:definition.name,mapRenderer:map,frames:frames[i+1],seatTile:seat,spawnTile:seat,seatDirection:'up',glowColor:[0x9caf88,0xb89b3e,0x8a86a6][i],onClick:()=>onNavigate('/community/contributors/'+definition.profile)});character.show(layer);character.sitAtDesk(false);character.update(.5);actors.push(character);return {definition,character,seat}});
   for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(map.gidAt('furniture-above',x,y)===MONITOR_OFF_TOPLEFT_GID||map.gidAt('furniture-below',x,y)===MONITOR_OFF_TOPLEFT_GID){const screen=new DeskScreen(map,{x,y},theme.monitor);screen.setOn(true);layer.addChild(screen.container);screens.push(screen)}
   const spawnedJoiners=new Set<string>();const keys=new Set<string>();let focused=false;let lastStatus='';let lastStage=-1;let lastLeg=-1;let previousElapsed=demoClock?.elapsedMs||0;let stepRemaining=0;
   const chooseNearby=()=>{const p=player.getTilePosition();return stations.find(s=>Math.hypot(s.tile.x-p.x,s.tile.y-p.y)<=2.4)};
   interact.current=()=>{const s=chooseNearby();if(s)open(s)};reset.current=()=>{player.setIdle();player.repositionTo(spawn.x,spawn.y);frame()};
   const down=(event:KeyboardEvent)=>{if(!focused)return;const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e'].includes(key)){event.preventDefault();keys.add(key);if(key==='e'&&!event.repeat)interact.current()}};
   const up=(event:KeyboardEvent)=>keys.delete(event.key.toLowerCase());const focus=()=>{focused=true};const blur=()=>{focused=false;keys.clear();controls.current={x:0,y:0}};
   app.canvas.addEventListener('focus',focus);app.canvas.addEventListener('blur',blur);app.canvas.addEventListener('pointerdown',()=>app?.canvas.focus());window.addEventListener('keydown',down);window.addEventListener('keyup',up);
   app.stage.eventMode='static';app.stage.hitArea=app.screen;app.stage.on('pointertap',event=>{const target=world.toLocal(event.global);const tile=map.pixelToTile(target.x,target.y);if(map.isWalkable(tile.x,tile.y))player.walkToTile(tile)});
   const resize=()=>{if(!app)return;app.stage.hitArea=app.screen;camera.setViewSize(app.screen.width,app.screen.height)};app.renderer.on('resize',resize);
   const tick=(ticker:Ticker)=>{if(disposed||!app)return;const dt=Math.min(ticker.deltaMS/1000,.05);const visible=!document.hidden;const running=visible;const elapsed=demoClock?.elapsedMs||0;
    if(running&&demoClock){demoClock.running=true;demoClock.elapsedMs+=dt*1000;}
    for(const j of joiners){
     if(elapsed>=j.triggerMs&&!spawnedJoiners.has(j.id)){
      spawnedJoiners.add(j.id);
      const dest=map.getSpawnPoint(layout.joinSeats[joiners.indexOf(j)])||spawn;
      const char=new Character({agentId:j.id,displayName:j.name,mapRenderer:map,frames:frames[1+cast.length+joiners.indexOf(j)],seatTile:dest,spawnTile:spawn,seatDirection:'up',glowColor:0xb89b3e});
      char.show(layer);char.sitAtDesk(false);char.showThought(j.thoughts[0]);actors.push(char);
      char.walkToAndThen(dest,()=>{char.faceDirection('down');char.sitAtDesk(true);char.showThought(j.thoughts[stage])});
      members.push({definition:{id:j.id,name:j.name,cast:j.cast,seat:j.seat,profile:j.id,thoughts:j.thoughts},character:char,seat:dest});
      setStatus(j.welcome);
     }
    }
    const stage=demoStageIndex(elapsed);const leg=Math.floor(elapsed/4500);const resetClock=elapsed<previousElapsed;previousElapsed=elapsed;
    if(stage!==lastStage||resetClock){members.forEach(m=>m.character.showThought(m.definition.thoughts[stage]));lastStage=stage}
    if((leg!==lastLeg||resetClock)&&running){members.forEach((m,i)=>{if((leg+i)%3===0){m.character.sitAtDesk(true);m.character.showThought(m.definition.thoughts[stage])}else{const place=(leg+i)%3===1?map.getSpawnPoint(theme.cafeSeatNames[i]):map.getSpawnPoint(layout.wander[i]);if(place)m.character.walkToAndThen(place,()=>{m.character.faceDirection('down');m.character.showThought(m.definition.thoughts[stage])})}});lastLeg=leg}
    const direction={x:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+controls.current.x,y:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+controls.current.y};
    stepRemaining-=dt;if(visible&&stepRemaining<=0&&player.getAnimation()!=='walk'&&(direction.x||direction.y)){const p=player.getTilePosition();const next={x:p.x+Math.sign(direction.x),y:p.y+(direction.x?0:Math.sign(direction.y))};if(map.isWalkable(next.x,next.y))player.walkToTile(next);stepRemaining=.05}
    player.update(visible?dt:0);for(const m of members)m.character.update(running?dt:0);for(const screen of screens)screen.update(running?dt:0);camera.update(dt);
    const s=chooseNearby();const message=s?'E · '+s.name:'Click the floor to walk · Click a desk to open CooL tools';if(message!==lastStatus){setStatus(message);setNearby(!!s);lastStatus=message}
   };app.ticker.add(tick);
   cleanup=()=>{fitObserver?.disconnect();keys.clear();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);if(app){app.canvas.removeEventListener('focus',focus);app.canvas.removeEventListener('blur',blur);app.renderer.off('resize',resize);app.ticker.remove(tick)}};
   setStatus('Click the floor to walk · Click a desk to open CooL tools');
  };
  start().catch(error=>{if(!disposed){setFailed(true);setStatus(error instanceof Error?error.message:'The original office could not load.');destroy()}});
  return()=>{disposed=true;interact.current=()=>{};reset.current=()=>{};controls.current={x:0,y:0};destroy()};
 },[room,retry,onNavigate,onRoom,demoClock,avatar,color,profile,avatarKey]);
 const look=roomLook[room]||roomLook.hq;
 return <><div className="nw-game nw-original-office" ref={host} data-room={room}><div className="nw-room-banner" aria-hidden="true"><strong>{look.title}</strong><span>{look.tagline}</span></div><div className="nw-room-tint" aria-hidden="true" style={{background:look.tint}}/></div><div className="nw-game-bottom"><span role="status" aria-live="polite">{status}</span><div className="nw-original-controls">{failed?<button className="nw-btn small" onClick={()=>setRetry(n=>n+1)}>Retry office</button>:<><button className="nw-text-button" onClick={()=>reset.current()}>Reset view ↺</button><button className="nw-btn small" disabled={!nearby} onClick={()=>interact.current()}>Interact ↵</button></>}</div></div><div className="nw-touch" aria-label="Touch movement controls">{[['←',-1,0],['↑',0,-1],['↓',0,1],['→',1,0]].map(([label,x,y])=><button key={label} aria-label={`Move ${label}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current={x:Number(x),y:Number(y)}}} onPointerUp={()=>controls.current={x:0,y:0}} onPointerCancel={()=>controls.current={x:0,y:0}}>{label}</button>)}</div><div className="nw-original-avatar-tools"><label>Character style<select aria-label="Character style" value={avatar} onChange={e=>setAvatar(e.target.value as OfficeCharacterName|'custom')}>{avatarSpec&&<option value="custom">My character</option>}{OFFICE_CAST.map(c=><option key={c.name} value={c.name}>{c.displayName}</option>)}</select></label><span>Same original sprites and animation engine</span></div><div className="nw-original-credit">Original office artwork by <a href="https://limezu.itch.io/" target="_blank" rel="noopener noreferrer">LimeZu</a> · original bundled character sprites · local contributor demo</div></>;
}
