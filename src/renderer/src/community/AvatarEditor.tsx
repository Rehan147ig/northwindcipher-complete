import {useEffect,useRef,useState} from 'react';
import {
  BROW_OPTIONS,CLOTH_COLORS,CLOTH_OPTIONS,DEFAULT_AVATAR,FACIAL_OPTIONS,HAIR_COLORS,HAIR_OPTIONS,MOUTH_OPTIONS,SKIN_OPTIONS,
  randomAvatar,renderAvatarPortrait,renderAvatarScene,sanitizeAvatar,type AvatarSpec,
} from '../scene/office/avatar';

// Draw each art pixel as an exact block of WHOLE device pixels, and size the element so the browser never rescales it.
// (A plain 8x canvas shown on a 125% screen gets stretched by 1.25 and every pixel edge goes soft.)
function paint(canvas:HTMLCanvasElement|null,w:number,h:number,pixels:Uint8ClampedArray,k:number){
 if(!canvas)return;
 const dpr=window.devicePixelRatio||1;
 const K=Math.max(1,Math.round(k*dpr));
 canvas.width=w*K;canvas.height=h*K;
 canvas.style.width=`${w*K/dpr}px`;canvas.style.height=`${h*K/dpr}px`;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.clearRect(0,0,w*K,h*K);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;const a=pixels[i+3];if(!a)continue;
  ctx.fillStyle=`rgba(${pixels[i]},${pixels[i+1]},${pixels[i+2]},${a/255})`;
  ctx.fillRect(x*K,y*K,K,K);
 }
}

function Swatches({label,colors,value,onPick}:{label:string;colors:string[];value:string;onPick:(c:string)=>void}){
 return <div className="nw-av-group" role="group" aria-label={label}>
  <span className="nw-av-label">{label}</span>
  <div className="nw-av-swatches">
   {colors.map(c=><button type="button" key={c} className={`nw-av-swatch${c===value?' on':''}`} style={{background:c}} aria-label={`${label} ${c}`} aria-pressed={c===value} onClick={()=>onPick(c)}/>)}
   <label className="nw-av-custom" title="Pick any colour"><input type="color" value={value} onChange={e=>onPick(e.target.value)} aria-label={`${label}: custom colour`}/></label>
  </div>
 </div>;
}
function Chips({label,options,value,onPick}:{label:string;options:{id:string;label:string}[];value:string;onPick:(id:string)=>void}){
 return <div className="nw-av-group" role="group" aria-label={label}>
  <span className="nw-av-label">{label}</span>
  <div className="nw-av-chips">{options.map(o=><button type="button" key={o.id||'none'} className={`nw-av-chip${o.id===value?' on':''}`} aria-pressed={o.id===value} onClick={()=>onPick(o.id)}>{o.label}</button>)}</div>
 </div>;
}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){
 return <label className="nw-check"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/> {label}</label>;
}

type Props={current:AvatarSpec|null;onSave:(spec:AvatarSpec)=>Promise<boolean>;signedIn:boolean;onNavigate:(p:string)=>void};

export function AvatarEditor({current,onSave,signedIn,onNavigate}:Props){
 const [spec,setSpec]=useState<AvatarSpec>(current??DEFAULT_AVATAR);
 const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
 const bust=useRef<HTMLCanvasElement>(null);const front=useRef<HTMLCanvasElement>(null);const back=useRef<HTMLCanvasElement>(null);
 const patch=(p:Partial<AvatarSpec>)=>{setMsg('');setSpec(s=>sanitizeAvatar({...s,...p}))};
 const first=useRef(true);
 useEffect(()=>{ // adopt the saved character once it has loaded (e.g. after sign-in), but never overwrite edits
  if(first.current&&current){setSpec(current)}first.current=false;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[current?JSON.stringify(current):'']);
 useEffect(()=>{
  const p=renderAvatarPortrait(spec);paint(bust.current,p.w,p.h,p.pixels,8);
  const s=renderAvatarScene(spec);paint(front.current,s.w,s.h,s.front[0],6);paint(back.current,s.w,s.h,s.back[0],6);
 },[spec]);
 const save=async()=>{
  setBusy(true);setMsg('');
  const synced=await onSave(spec);
  setBusy(false);
  setMsg(synced?'Saved to your account. You will appear like this in the office.':signedIn?'Saved on this device. We could not reach your account just now, so it will sync later.':'Saved on this device. Log in to keep it with your account.');
 };
 const download=(canvas:HTMLCanvasElement|null,name:string)=>{
  canvas?.toBlob(b=>{if(!b)return;const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)},'image/png');
 };
 return <section className="nw-dashboard nw-char-editor" aria-labelledby="av-title">
  <div className="nw-eyebrow">YOUR CHARACTER</div>
  <h1 id="av-title">Design how you look in the office.</h1>
  <p>Pick a look, then save. Your character walks the office floor and can be downloaded as a PNG.</p>
  <div className="nw-av-layout">
   <div className="nw-panel nw-av-preview" aria-label="Preview">
    <canvas ref={bust} role="img" aria-label="Portrait preview"/>
    <div className="nw-av-bodies"><canvas ref={front} role="img" aria-label="Full body, front"/><canvas ref={back} role="img" aria-label="Full body, back"/></div>
    <div className="nw-actions">
     <button type="button" className="nw-btn small secondary" onClick={()=>setSpec(randomAvatar())}>🎲 Randomize</button>
     <button type="button" className="nw-btn small secondary" onClick={()=>{setMsg('');setSpec(DEFAULT_AVATAR)}}>Reset</button>
    </div>
    <div className="nw-actions">
     <button type="button" className="nw-text-button" onClick={()=>download(bust.current,'my-character-portrait.png')}>Download portrait</button>
     <button type="button" className="nw-text-button" onClick={()=>download(front.current,'my-character-full.png')}>Download full body</button>
    </div>
   </div>
   <form className="nw-panel nw-av-controls" onSubmit={e=>{e.preventDefault();save()}}>
    <Swatches label="Skin" colors={SKIN_OPTIONS.map(s=>s.color)} value={SKIN_OPTIONS.find(s=>s.id===spec.skin)?.color||''} onPick={c=>patch({skin:SKIN_OPTIONS.find(s=>s.color===c)?.id||spec.skin})}/>
    <Chips label="Hairstyle" options={HAIR_OPTIONS} value={spec.hair} onPick={id=>patch({hair:id})}/>
    <Swatches label="Hair colour" colors={HAIR_COLORS} value={spec.hairColor} onPick={c=>patch({hairColor:c})}/>
    <Chips label="Outfit" options={CLOTH_OPTIONS} value={spec.cloth} onPick={id=>patch({cloth:id})}/>
    <Swatches label="Outfit colour" colors={CLOTH_COLORS} value={spec.clothColor} onPick={c=>patch({clothColor:c})}/>
    <Swatches label={spec.cloth==='suit'||spec.cloth==='dressshirt'?'Tie colour':'Trim / print colour'} colors={CLOTH_COLORS} value={spec.accent} onPick={c=>patch({accent:c})}/>
    <Swatches label="Trousers" colors={['#363846','#2a2a30','#4a4f66','#5c4a3a','#3d5a4a','#6b6f80','#8a7a5c','#2b3a5c']} value={spec.pants} onPick={c=>patch({pants:c})}/>
    <Chips label="Facial hair" options={FACIAL_OPTIONS} value={spec.facial} onPick={id=>patch({facial:id})}/>
    <Chips label="Eyebrows" options={BROW_OPTIONS} value={spec.brow} onPick={id=>patch({brow:id})}/>
    <Chips label="Expression" options={MOUTH_OPTIONS} value={spec.mouth} onPick={id=>patch({mouth:id})}/>
    <div className="nw-av-toggles">
     <Toggle label="Glasses" checked={spec.glasses} onChange={v=>patch({glasses:v})}/>
     <Toggle label="Rosy cheeks" checked={spec.blush} onChange={v=>patch({blush:v})}/>
     <Toggle label="Lashes" checked={spec.lashes} onChange={v=>patch({lashes:v})}/>
     <Toggle label="Fuller build" checked={spec.heavy} onChange={v=>patch({heavy:v})}/>
    </div>
    {msg&&<div role="status" className="nw-auth-notice">{msg}</div>}
    <div className="nw-actions"><button className="nw-btn" disabled={busy}>{busy?'Saving…':'Save character'}</button><a className="nw-btn secondary" href="/community/world" onClick={e=>{e.preventDefault();onNavigate('/community/world')}}>See it in the office ↗</a></div>
   </form>
  </div>
 </section>;
}
