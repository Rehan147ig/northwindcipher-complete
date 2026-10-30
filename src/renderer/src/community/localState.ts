export type Profile={name:string;skills:string[];presence:boolean;notifications:boolean;color:string};
export type Report={id:string;category:string;description:string;status:'Open'|'Appeal requested';created:string};
export type LocalData={profile:Profile|null;saved:string[];attendance:string[];read:string[];reports:Report[];messages:{text:string;at:string;room:string}[];blocked:boolean};
export const empty:LocalData={profile:null,saved:[],attendance:[],read:[],reports:[],messages:[],blocked:false};
export const KEY='northwind.community.demo.v1';
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=100&&v.every(s=>typeof s==='string'&&s.length<=100);
export function parseLocal(raw:string|null):LocalData {
 try{const d=JSON.parse(raw||'null');
  if(!d||!strings(d.saved)||!strings(d.attendance)||!strings(d.read)||!Array.isArray(d.reports)||d.reports.length>100||!Array.isArray(d.messages)||d.messages.length>100||typeof d.blocked!=='boolean')return empty;
  if(d.profile&&(typeof d.profile.name!=='string'||d.profile.name.length>40||!strings(d.profile.skills)||typeof d.profile.presence!=='boolean'||typeof d.profile.notifications!=='boolean'||!/^#[0-9a-f]{6}$/i.test(d.profile.color)))return empty;
  if(!d.messages.every((m:Record<string,unknown>)=>m&&typeof m.text==='string'&&m.text.length<=500&&typeof m.room==='string'&&typeof m.at==='string'&&Number.isFinite(Date.parse(m.at))))return empty;
  if(!d.reports.every((r:Record<string,unknown>)=>r&&typeof r.id==='string'&&typeof r.category==='string'&&r.category.length<=100&&typeof r.description==='string'&&r.description.length<=2000&&['Open','Appeal requested'].includes(String(r.status))&&typeof r.created==='string'&&Number.isFinite(Date.parse(r.created))))return empty;
  return {profile:d.profile||null,saved:d.saved,attendance:d.attendance,read:d.read,reports:d.reports,messages:d.messages,blocked:d.blocked};
 }catch{return empty}
}
export function readLocal():LocalData{try{return parseLocal(localStorage.getItem(KEY))}catch{return empty}}
