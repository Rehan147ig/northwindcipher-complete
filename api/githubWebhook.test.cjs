const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const loadTs=require('../test/load-ts.cjs');
const {verifySignature,normalizeIssue,normalizePullRequest,handleWebhook,MAX_BODY_BYTES}=loadTs('api/_lib/githubWebhook.ts');

const SECRET='test-secret';
const sign=(body,secret=SECRET)=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
const issue={number:7,title:'Fix docs',state:'open',html_url:'https://github.com/o/r/issues/7',updated_at:'2026-10-29T10:00:00Z',user:{id:42},labels:[{name:'good first issue'},{name:'docs'}]};
const pr={number:9,title:'Add tests',state:'closed',merged_at:'2026-10-29T11:00:00Z',html_url:'https://github.com/o/r/pull/9',updated_at:'2026-10-29T11:00:00Z',user:{id:42}};

function fakeStore({enrolled=true,failUpsert=false}={}){
 const log={deliveries:new Map(),issues:[],prs:[],finished:[]};
 return {log,store:{
  async recordDelivery(d){if(log.deliveries.has(d.delivery_id))return false;log.deliveries.set(d.delivery_id,d);return true},
  async findRepository(id){return enrolled&&id===123?{id:'repo-uuid'}:null},
  async upsertIssue(repo,row){if(failUpsert)throw new Error('db down');log.issues.push([repo,row])},
  async upsertPullRequest(repo,row){if(failUpsert)throw new Error('db down');log.prs.push([repo,row])},
  async finishDelivery(id,status,error){log.finished.push([id,status,error])},
 }};
}
function request(event,payload,{delivery='d1',signature,method='POST',body}={}){
 const rawBody=Buffer.from(body??JSON.stringify(payload));
 return {method,rawBody,headers:{'x-github-event':event,'x-github-delivery':delivery,'x-hub-signature-256':signature??sign(rawBody)}};
}

test('signature: accepts the exact HMAC and rejects everything else',()=>{
 const body=Buffer.from('{"a":1}');
 assert.equal(verifySignature(SECRET,body,sign(body)),true);
 assert.equal(verifySignature(SECRET,body,sign(body,'other')),false);
 assert.equal(verifySignature(SECRET,Buffer.from('{"a":2}'),sign(body)),false);
 for(const bad of [undefined,'','sha256=','sha256=zz','sha1=abc',sign(body).slice(0,-2)])assert.equal(verifySignature(SECRET,body,bad),false);
 assert.equal(verifySignature('',body,sign(body,'')),false);
});

test('normalizers keep only bounded, safe fields',()=>{
 assert.deepEqual(normalizeIssue(issue),{issue_number:7,title:'Fix docs',state:'open',labels:['good first issue','docs'],author_provider_id:42,html_url:'https://github.com/o/r/issues/7',updated_at:'2026-10-29T10:00:00.000Z'});
 assert.equal(normalizeIssue({...issue,html_url:'javascript:alert(1)'}),null);
 assert.equal(normalizeIssue({...issue,html_url:'http://github.com/o/r/issues/7'}),null);
 assert.equal(normalizeIssue({...issue,number:'7'}),null);
 assert.equal(normalizeIssue({...issue,updated_at:'not a date'}),null);
 assert.equal(normalizeIssue({...issue,title:'x'.repeat(1000)}).title.length,300);
 assert.equal(normalizePullRequest(pr).state,'merged');
 assert.equal(normalizePullRequest({...pr,merged_at:null}).state,'closed');
 assert.equal(normalizePullRequest({...pr,merged_at:null,state:'open'}).state,'open');
});

test('rejects bad signatures before touching the store or parsing JSON',async()=>{
 const {store,log}=fakeStore();
 const res=await handleWebhook(request('issues',null,{signature:'sha256=00',body:'{not json'}),SECRET,store);
 assert.equal(res.status,401);assert.equal(log.deliveries.size,0);
});

test('rejects wrong methods, missing config, oversize bodies and missing headers',async()=>{
 const {store}=fakeStore();
 assert.equal((await handleWebhook(request('issues',{},{method:'GET'}),SECRET,store)).status,405);
 assert.equal((await handleWebhook(request('issues',{}),'',store)).status,500);
 assert.equal((await handleWebhook({method:'POST',headers:{},rawBody:Buffer.alloc(MAX_BODY_BYTES+1)},SECRET,store)).status,413);
 const body=Buffer.from('{}');
 assert.equal((await handleWebhook({method:'POST',headers:{'x-hub-signature-256':sign(body)},rawBody:body},SECRET,store)).status,400);
 assert.equal((await handleWebhook(request('issues',null,{body:'{not json'}),SECRET,store)).status,400);
});

test('syncs an enrolled repository issue and pull request',async()=>{
 const {store,log}=fakeStore();
 let res=await handleWebhook(request('issues',{action:'opened',repository:{id:123},issue},{delivery:'a'}),SECRET,store);
 assert.deepEqual([res.status,res.body.result],[200,'processed']);
 res=await handleWebhook(request('pull_request',{action:'closed',repository:{id:123},pull_request:pr},{delivery:'b'}),SECRET,store);
 assert.deepEqual([res.status,res.body.result],[200,'processed']);
 assert.equal(log.issues[0][0],'repo-uuid');assert.equal(log.issues[0][1].issue_number,7);
 assert.equal(log.prs[0][1].state,'merged');
 assert.deepEqual(log.finished.map(f=>f[1]),['processed','processed']);
});

test('replayed deliveries are acknowledged without repeating side effects',async()=>{
 const {store,log}=fakeStore();
 const req=request('issues',{repository:{id:123},issue},{delivery:'same'});
 await handleWebhook(req,SECRET,store);
 const again=await handleWebhook(req,SECRET,store);
 assert.deepEqual([again.status,again.body.result],[200,'duplicate']);
 assert.equal(log.issues.length,1);
});

test('ignores unknown events, ping, and repositories that are not enrolled',async()=>{
 const {store,log}=fakeStore({enrolled:false});
 assert.equal((await handleWebhook(request('ping',{zen:'x'},{delivery:'p'}),SECRET,store)).body.result,'ignored');
 assert.equal((await handleWebhook(request('star',{repository:{id:123}},{delivery:'s'}),SECRET,store)).body.result,'ignored');
 assert.equal((await handleWebhook(request('issues',{repository:{id:123},issue},{delivery:'i'}),SECRET,store)).body.result,'not_enrolled');
 assert.equal(log.issues.length,0);
});

test('processing failures are recorded as failed and reported as 500',async()=>{
 const {store,log}=fakeStore({failUpsert:true});
 const res=await handleWebhook(request('issues',{repository:{id:123},issue},{delivery:'f'}),SECRET,store);
 assert.equal(res.status,500);assert.equal(res.body.error,'processing_failed');
 assert.deepEqual(log.finished.at(-1).slice(0,2),['f','failed']);
 const bad=await handleWebhook(request('issues',{repository:{id:123},issue:{number:1}},{delivery:'g'}),SECRET,fakeStore().store);
 assert.equal(bad.status,500);
});
