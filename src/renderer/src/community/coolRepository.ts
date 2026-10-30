export const coolRepository = {
  owner:'Northwind-Cipher', name:'cool-sdk', fullName:'Northwind-Cipher/cool-sdk',
  url:'https://github.com/Northwind-Cipher/cool-sdk',
  guideUrl:'https://github.com/Northwind-Cipher/cool-sdk/blob/main/CONTRIBUTING.md',
  readmeUrl:'https://github.com/Northwind-Cipher/cool-sdk#readme',
  securityUrl:'https://github.com/Northwind-Cipher/cool-sdk/blob/main/SECURITY.md',
  docsUrl:'https://github.com/Northwind-Cipher/cool-sdk/tree/main/docs',
  license:'BUSL-1.1', language:'TypeScript', packageName:'cool-nwc',
  description:'A developer SDK and command line for tamper-evident, independently verifiable software execution evidence.',
  verifiedOn:'2026-10-30',
} as const;

export type GitHubItem={id:number;number:number;title:string;url:string;labels:string[];author:string;updatedAt:string;state:string};
export type PublicGitHubSnapshot={source:'github-public-api';fetchedAt:string;issues:GitHubItem[];pullRequests:GitHubItem[]};
export class GitHubReadError extends Error {
 constructor(message:string,public readonly kind:'network'|'rate-limit'|'invalid-data'|'unavailable',public readonly retryAt?:number){super(message);this.name='GitHubReadError'}
}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new GitHubReadError('GitHub returned an unexpected response.','invalid-data');return value as Record<string,unknown>}
export function parseGitHubItems(value:unknown,kind:'issues'|'pulls'):GitHubItem[]{
 if(!Array.isArray(value)||value.length>100)throw new GitHubReadError('GitHub returned an unexpected list.','invalid-data');
 return value.filter(v=>kind!=='issues'||!record(v).pull_request).map(v=>{
  const item=record(v);const n=item.number;const id=item.id;const title=item.title;const url=item.html_url;
  if(!Number.isSafeInteger(n)||Number(n)<1||!Number.isSafeInteger(id)||typeof title!=='string'||title.length>1000||typeof url!=='string')throw new GitHubReadError('A GitHub item could not be validated.','invalid-data');
  let parsed:URL;try{parsed=new URL(url)}catch{throw new GitHubReadError('A GitHub link was malformed.','invalid-data')}const prefix=`/${coolRepository.fullName}/${kind==='pulls'?'pull':'issues'}/${n}`;
  if(parsed.origin!=='https://github.com'||parsed.pathname!==prefix||parsed.search||parsed.hash)throw new GitHubReadError('A GitHub link did not match this repository.','invalid-data');
  const labels=Array.isArray(item.labels)?item.labels.slice(0,30).map(l=>typeof l==='string'?l:record(l).name).filter((l):l is string=>typeof l==='string'&&l.length<100):[];
  const author=item.user&&typeof item.user==='object'?record(item.user).login:undefined;
  return {id:Number(id),number:Number(n),title:title.slice(0,400),url,labels,author:typeof author==='string'?author.slice(0,100):'GitHub contributor',updatedAt:typeof item.updated_at==='string'?item.updated_at:'',state:item.state==='closed'?'closed':'open'};
 });
}
export async function loadPublicGitHubSnapshot(fetcher:typeof fetch=fetch):Promise<PublicGitHubSnapshot>{
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
 const request=async(kind:'issues'|'pulls')=>{
  const url=`https://api.github.com/repos/${coolRepository.fullName}/${kind}?state=open&per_page=30`;
  const response=await fetcher(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(response.status===403||response.status===429){const retrySeconds=Number(response.headers.get('retry-after'));const resetSeconds=Number(response.headers.get('x-ratelimit-reset'));const retryAt=Math.max(Date.now()+60_000,retrySeconds>0?Date.now()+retrySeconds*1000:resetSeconds>0?resetSeconds*1000:0);throw new GitHubReadError('GitHub is limiting public API requests. Try again later or browse the repository directly.','rate-limit',retryAt);}
  if(!response.ok)throw new GitHubReadError('GitHub could not load this repository’s work. The repository links still work.','unavailable');
  const body=await response.text();if(body.length>750_000)throw new GitHubReadError('GitHub returned more data than this view accepts.','invalid-data');
  let value:unknown;try{value=JSON.parse(body)}catch{throw new GitHubReadError('GitHub returned unreadable data.','invalid-data')}
  return parseGitHubItems(value,kind);
 };
 try{const [issues,pullRequests]=await Promise.all([request('issues'),request('pulls')]);return {source:'github-public-api',fetchedAt:new Date().toISOString(),issues,pullRequests};}
 catch(error){controller.abort();if(error instanceof GitHubReadError)throw error;throw new GitHubReadError('Could not reach GitHub within the time limit. Check your connection or open the repository.','network')}
 finally{clearTimeout(timeout)}
}
let cache:PublicGitHubSnapshot|undefined;let pending:Promise<PublicGitHubSnapshot>|undefined;let rateLimit:GitHubReadError|undefined;
export function getPublicGitHubSnapshot(refresh=false):Promise<PublicGitHubSnapshot>{
 if(!refresh&&cache&&Date.now()-Date.parse(cache.fetchedAt)<300_000)return Promise.resolve(cache);
 if(rateLimit&&Date.now()<(rateLimit.retryAt||0))return Promise.reject(rateLimit);
 if(pending)return pending;
 pending=loadPublicGitHubSnapshot().then(value=>{cache=value;rateLimit=undefined;return value}).catch(error=>{if(error instanceof GitHubReadError&&error.kind==='rate-limit')rateLimit=error;throw error}).finally(()=>{pending=undefined});return pending;
}
