import {useCallback,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';

// visitor = signed out; none = signed in but has not asked; applied = request under review;
// rejected = last request declined; approved = contributor (staff always count as approved).
export type AccessState='loading'|'visitor'|'none'|'applied'|'approved'|'rejected';
export type Access={state:AccessState;staff:boolean;note:string|null;refresh:()=>void};

export function useAccess(session:Session|null):Access{
 const [state,setState]=useState<AccessState>('loading');
 const [staff,setStaff]=useState(false);
 const [note,setNote]=useState<string|null>(null);
 const [tick,setTick]=useState(0);
 const refresh=useCallback(()=>setTick(t=>t+1),[]);
 const uid=session?.user.id;
 useEffect(()=>{
  if(!supabase||!uid){setStaff(false);setNote(null);setState(supabase&&!session?'visitor':'loading');return}
  let alive=true;
  (async()=>{
   const [roles,profile,apps]=await Promise.all([
    supabase.from('app_roles').select('role').eq('user_id',uid),
    supabase.from('profiles').select('membership_status').eq('id',uid).maybeSingle(),
    supabase.from('invitation_requests').select('status,review_note').order('created_at',{ascending:false}).limit(1),
   ]);
   if(!alive)return;
   const isStaff=Boolean(roles.data?.some((r:{role:string})=>r.role==='moderator'||r.role==='owner'));
   setStaff(isStaff);
   const latest=(apps.data?.[0]||null) as {status:string;review_note:string|null}|null;
   setNote(latest?.review_note||null);
   // If the gateway migration has not been applied yet the column does not exist: do not lock everyone out.
   if(profile.error){setState('approved');return}
   const membership=(profile.data as {membership_status?:string}|null)?.membership_status;
   if(isStaff||membership==='approved')setState('approved');
   else if(latest?.status==='pending')setState('applied');
   else if(latest?.status==='rejected'||membership==='rejected')setState('rejected');
   else setState('none');
  })();
  return()=>{alive=false};
 },[uid,tick,session]);
 return {state,staff,note,refresh};
}
