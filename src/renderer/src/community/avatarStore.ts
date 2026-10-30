import {useCallback,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';
import {sanitizeAvatar,type AvatarSpec} from '../scene/office/avatar';

const KEY='nw.avatar.v1';
function readLocal():AvatarSpec|null{
 try{const raw=localStorage.getItem(KEY);return raw?sanitizeAvatar(JSON.parse(raw)):null}catch{return null}
}
function writeLocal(spec:AvatarSpec){try{localStorage.setItem(KEY,JSON.stringify(spec))}catch{/* storage unavailable */}}

// The character lives on this device, and follows the account once signed in (profiles.avatar).
export function useAvatar(session:Session|null){
 const [avatar,setAvatar]=useState<AvatarSpec|null>(readLocal);
 const uid=session?.user.id;
 useEffect(()=>{
  if(!supabase||!uid)return;
  let alive=true;
  supabase.from('profiles').select('avatar').eq('id',uid).maybeSingle().then(({data,error})=>{
   if(!alive||error)return; // column not installed yet: keep the local character
   const remote=(data as {avatar?:unknown}|null)?.avatar;
   if(remote){const spec=sanitizeAvatar(remote);setAvatar(spec);writeLocal(spec)}
   else{const local=readLocal();if(local)supabase!.from('profiles').update({avatar:local}).eq('id',uid).then(()=>undefined)}
  });
  return()=>{alive=false};
 },[uid]);
 /** Returns true when the character was also saved to the account. */
 const save=useCallback(async(next:AvatarSpec):Promise<boolean>=>{
  const clean=sanitizeAvatar(next);
  setAvatar(clean);writeLocal(clean);
  if(!supabase||!uid)return false;
  const {error}=await supabase.from('profiles').update({avatar:clean}).eq('id',uid);
  return !error;
 },[uid]);
 return {avatar,save};
}
