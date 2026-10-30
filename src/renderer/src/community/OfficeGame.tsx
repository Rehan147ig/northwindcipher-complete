import {useEffect,useRef,useState} from 'react';
import {demoRoomProvider,type DemoClock} from './roomDemo';
import {WORLD,drawOffice,canMove,nearStation,rooms,stations,avatarColor} from './world';
type Props={demoClock?:DemoClock;compact?:boolean;room:string;color:string;onNavigate:(path:string)=>void;onRoom:(room:string)=>void};
export default function OfficeGame({room,color,onNavigate,onRoom,compact=false,demoClock}:Props){
 const host=useRef<HTMLDivElement>(null);const [status,setStatus]=useState('Loading your office…');const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);
 const input=useRef({x:0,y:0});const action=useRef<()=>void>(()=>{});
 useEffect(()=>{let disposed=false;let game:import('phaser').Game|undefined;
  setFailed(false);setStatus('Loading your office…');
  import('phaser').then(({default:P})=>{if(disposed||!host.current)return;
   class OfficeScene extends P.Scene {
    avatar!:import('phaser').GameObjects.Container;keys!:Record<string,import('phaser').Input.Keyboard.Key>;step=0;demoActors=new Map<string,{actor:import('phaser').GameObjects.Container;body:import('phaser').GameObjects.Graphics}>();
    create(){const canvas=document.createElement('canvas');canvas.width=WORLD.width;canvas.height=WORLD.height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');drawOffice(ctx,room);this.textures.addCanvas('office',canvas);this.add.image(0,0,'office').setOrigin(0);
     const body=this.add.graphics();body.fillStyle(0x233d32,.2);body.fillEllipse(0,15,25,9);body.fillStyle(0x283e38);body.fillRect(-8,8,6,8);body.fillRect(2,8,6,8);body.fillStyle(Number.parseInt(avatarColor(color).slice(1),16));body.fillRect(-10,-7,20,18);body.fillStyle(0xe8b38e);body.fillRect(-7,-22,14,15);body.fillStyle(0x46382f);body.fillRect(-8,-24,16,6);body.fillRect(-8,-20,4,6);body.fillStyle(0x303a32);body.fillRect(3,-16,2,2);
     const tag=this.add.text(0,-42,'YOU',{fontFamily:'monospace',fontSize:'10px',color:'#fff8e7',backgroundColor:'#284a3b',padding:{x:7,y:4}}).setOrigin(.5);this.avatar=this.add.container(WORLD.spawn.x,WORLD.spawn.y,[body,tag]);
     if(demoClock)for(const member of demoRoomProvider.members(0)){
      const figure=this.add.graphics();figure.fillStyle(0x111111,.2);figure.fillEllipse(0,15,25,8);figure.fillStyle(0x283e38);figure.fillRect(-8,8,6,8);figure.fillRect(2,8,6,8);figure.fillStyle(member.tone);figure.fillRect(-10,-7,20,18);figure.lineStyle(1,0xffffff,.65);figure.strokeRect(-10,-7,20,18);figure.fillStyle(0xe8b38e);figure.fillRect(-7,-22,14,15);figure.fillStyle(0x46382f);figure.fillRect(-8,-24,16,6);figure.fillRect(-8,-20,4,6);figure.fillStyle(0x303a32);figure.fillRect(3,-16,2,2);
      const name=this.add.text(0,-43,member.name.toUpperCase()+' · DEMO',{fontFamily:'monospace',fontSize:'10px',color:'#345144',backgroundColor:'#fff8e7',padding:{x:5,y:3}}).setOrigin(.5);
      const actor=this.add.container(member.x,member.y,[figure,name]);actor.setSize(28,48).setInteractive(new P.Geom.Rectangle(-14,-30,28,50),P.Geom.Rectangle.Contains).on('pointerdown',()=>onNavigate('/community/contributors/'+member.handle));this.demoActors.set(member.id,{actor,body:figure});
     }
     // Mouse and touch visitors can open desks directly; walking remains optional.
     for(const station of stations){
      const highlight=this.add.rectangle(station.x,station.y-50,172,85).setStrokeStyle(2,0xffffff,.85).setVisible(false);
      const label=this.add.text(station.x,station.y-106,station.name+' ↗',{fontFamily:'monospace',fontSize:'11px',color:'#fff8e7',backgroundColor:'#284a3b',padding:{x:8,y:6}}).setOrigin(.5).setVisible(false).setDepth(20);
      this.add.zone(station.x,station.y-50,172,85).setInteractive({useHandCursor:true}).on('pointerover',()=>{highlight.setVisible(true);label.setVisible(true)}).on('pointerout',()=>{highlight.setVisible(false);label.setVisible(false)}).on('pointerdown',()=>{station.route.startsWith('room:')?onRoom(station.route.slice(5)):onNavigate(station.route)});
     }
     this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string,import('phaser').Input.Keyboard.Key>;
     // Only focused canvas captures movement, preserving page and form keyboard access.
     this.input.keyboard!.enabled=false;
     const canvasEl=this.game.canvas;canvasEl.tabIndex=0;canvasEl.setAttribute('aria-label','Interactive office. Use WASD or arrows to walk, E to interact. Tab leaves the office.');
     const focus=()=>{this.input.keyboard!.enabled=true};const pointerFocus=()=>canvasEl.focus();canvasEl.addEventListener('pointerdown',pointerFocus);const blur=()=>{this.input.keyboard!.enabled=false;this.input.keyboard!.resetKeys();input.current={x:0,y:0}};canvasEl.addEventListener('focus',focus);canvasEl.addEventListener('blur',blur);
     this.events.once('shutdown',()=>{canvasEl.removeEventListener('pointerdown',pointerFocus);canvasEl.removeEventListener('focus',focus);canvasEl.removeEventListener('blur',blur)});
     this.cameras.main.setBounds(0,0,960,640);this.cameras.main.startFollow(this.avatar,true,window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:.12,window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:.12);const fit=()=>{const zoom=this.scale.width>=700?Math.min(this.scale.width/960,this.scale.height/640):Math.max(.65,this.scale.width/800);const px=Math.max(0,(this.scale.width-960*zoom)/2)/zoom;const py=Math.max(0,(this.scale.height-640*zoom)/2)/zoom;this.cameras.main.setZoom(zoom);this.cameras.main.setBounds(-px,-py,960+2*px,640+2*py)};fit();this.scale.on('resize',fit);this.events.once('shutdown',()=>this.scale.off('resize',fit));this.cameras.main.roundPixels=true;
     action.current=()=>{const station=nearStation(this.avatar.x,this.avatar.y);if(!station)return;if(station.route.startsWith('room:'))onRoom(station.route.slice(5));else onNavigate(station.route)};
     this.keys.E.on('down',()=>action.current());
     setStatus('Click the office to walk. WASD / arrows · E to interact');
    }
    update(_time:number,delta:number){if(!this.avatar)return;
     if(demoClock){if(demoClock.running&&!document.hidden)demoClock.elapsedMs+=Math.min(delta,100);for(const member of demoRoomProvider.members(demoClock.elapsedMs)){const rendered=this.demoActors.get(member.id);if(rendered){rendered.actor.setPosition(Math.round(member.x),Math.round(member.y)).setDepth(member.y);rendered.body.y=demoClock.running&&member.walking?(Math.sin(demoClock.elapsedMs/90)>0?-1:0):0;}}}this.avatar.setDepth(this.avatar.y);
const keys=this.keys;let dx=(keys.D.isDown||keys.RIGHT.isDown?1:0)-(keys.A.isDown||keys.LEFT.isDown?1:0)+input.current.x;let dy=(keys.S.isDown||keys.DOWN.isDown?1:0)-(keys.W.isDown||keys.UP.isDown?1:0)+input.current.y;const len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;const d=Math.min(delta,40)*.16;const x=this.avatar.x+dx*d,y=this.avatar.y+dy*d;if(canMove(x,this.avatar.y))this.avatar.x=Math.round(x);if(canMove(this.avatar.x,y))this.avatar.y=Math.round(y);this.step+=delta;this.avatar.list[0].setData('walking',true);(this.avatar.list[0] as import('phaser').GameObjects.Graphics).y=Math.sin(this.step/85)>0?-1:0;}else{(this.avatar.list[0] as import('phaser').GameObjects.Graphics).y=0;}
     const station=nearStation(this.avatar.x,this.avatar.y);const next=station?`E · ${station.name}`:'Click a desk to open it · WASD / arrows to explore';setStatus(prev=>prev===next?prev:next);
    }
   }
   game=new P.Game({type:P.CANVAS,parent:host.current,width:host.current.clientWidth,height:510,backgroundColor:'#253e36',pixelArt:true,roundPixels:true,scene:OfficeScene,scale:{mode:P.Scale.RESIZE,autoCenter:P.Scale.CENTER_BOTH},audio:{noAudio:true},banner:false});
  }).catch(()=>{if(!disposed){setFailed(true);setStatus('The office could not load. Use the station links below, or try again.')}});
  return()=>{disposed=true;input.current={x:0,y:0};action.current=()=>{};game?.destroy(true)};
 },[room,color,retry,onNavigate,onRoom,demoClock]);
 return <><div className="nw-game-top"><span><i className="nw-dot"/> {rooms.find(r=>r.id===room)?.name}</span><span>LOCAL DEMO · 1 PLAYER</span></div><div className="nw-game" ref={host}/><div className="nw-game-bottom"><span role="status" aria-live="polite">{status}</span>{failed?<button className="nw-btn small" onClick={()=>setRetry(n=>n+1)}>Retry office</button>:<button className="nw-btn small" disabled={!status.startsWith('E ·')} title="Walk near a station to interact" onClick={()=>action.current()}>Interact ↵</button>}</div><div className="nw-touch" aria-label="Touch movement controls">{[['←',-1,0],['↑',0,-1],['↓',0,1],['→',1,0]].map(([label,x,y])=><button key={label} aria-label={`Move ${label}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);input.current={x:Number(x),y:Number(y)}}} onPointerUp={()=>input.current={x:0,y:0}} onPointerCancel={()=>input.current={x:0,y:0}}>{label}</button>)}</div>{!compact&&<><p className="nw-muted nw-small">Prefer a list? Every station is also accessible below. Room capacities are design targets; multiplayer is not connected.</p><div className="nw-stations">{stations.map(s=><button key={s.id} onClick={()=>s.route.startsWith('room:')?onRoom(s.route.slice(5)):onNavigate(s.route)}><strong>{s.name} ↗</strong><span>{s.description}</span></button>)}</div></>}</>;
}
