/// <reference types="vite/client" />
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const authConfigured=Boolean(url&&key);
export const supabase:SupabaseClient|null=authConfigured?createClient(url!,key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export type ContributorProfile={id:string;display_name:string;skills:string[];color:string;github_login:string|null;verified_at:string|null;saved_issues:string[];presence_mode?:string;idle_detection?:boolean;show_contributions?:boolean};

export type AuthSettings={github:boolean;email:boolean;autoconfirm:boolean};
let settingsPromise:Promise<AuthSettings|null>|null=null;
/** Which sign-in methods the Supabase project has actually enabled (public endpoint, anon key only). */
export function fetchAuthSettings():Promise<AuthSettings|null>{
 if(!authConfigured)return Promise.resolve(null);
 settingsPromise??=(async()=>{
  try{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);
   const res=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key!},signal:controller.signal});
   clearTimeout(timer);
   if(!res.ok)return null;
   const body=await res.json();
   return {github:Boolean(body?.external?.github),email:body?.external?.email!==false,autoconfirm:Boolean(body?.mailer_autoconfirm)};
  }catch{return null}
 })();
 return settingsPromise;
}
