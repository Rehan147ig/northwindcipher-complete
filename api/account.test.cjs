const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../test/load-ts.cjs');
const {handleAccount,MAX_ACCOUNT_BODY_BYTES}=loadTs('api/_lib/account.ts');

const TOKEN='a'.repeat(40);
function fake({owned=0,validToken=TOKEN}={}){
 const calls=[];
 return {calls,store:{
  async getUser(t){return t===validToken?{id:'u1',email:'a@example.com',created_at:'2026-10-30T00:00:00Z'}:null},
  async exportData(id){calls.push(['export',id]);return {profile:[{id}]}},
  async ownedProjectCount(){return owned},
  async recordDeletion(id){calls.push(['audit',id])},
  async deleteUser(id){calls.push(['delete',id])},
 }};
}
const req=(method,{token=TOKEN,body='',headers}={})=>({method,rawBody:Buffer.from(body),headers:headers??(token?{authorization:'Bearer '+token}:{})});

test('requires a well-formed, valid bearer token',async()=>{
 const {store,calls}=fake();
 for(const r of [req('GET',{token:null}),req('GET',{headers:{authorization:'Basic abc'}}),req('GET',{token:'short'}),req('GET',{token:'b'.repeat(40)})])
  assert.equal((await handleAccount(r,store)).status,401);
 assert.equal(calls.length,0);
});

test('rejects unsupported methods and oversize bodies',async()=>{
 const {store}=fake();
 assert.equal((await handleAccount(req('POST'),store)).status,405);
 assert.equal((await handleAccount(req('DELETE',{body:'x'.repeat(MAX_ACCOUNT_BODY_BYTES+1)}),store)).status,413);
});

test('GET exports only the signed-in user\'s data',async()=>{
 const {store,calls}=fake();
 const res=await handleAccount(req('GET'),store);
 assert.equal(res.status,200);assert.equal(res.body.user.id,'u1');
 assert.deepEqual(calls,[['export','u1']]);
});

test('DELETE needs explicit confirmation',async()=>{
 const {store,calls}=fake();
 for(const body of ['','{}','{"confirm":"delete"}','not json'])assert.equal((await handleAccount(req('DELETE',{body}),store)).status,400);
 assert.equal(calls.length,0);
});

test('DELETE is blocked while the user owns projects',async()=>{
 const {store,calls}=fake({owned:2});
 const res=await handleAccount(req('DELETE',{body:'{"confirm":"DELETE"}'}),store);
 assert.deepEqual([res.status,res.body.error],[409,'owns_projects']);
 assert.equal(calls.length,0);
});

test('DELETE audits first, then removes the account',async()=>{
 const {store,calls}=fake();
 const res=await handleAccount(req('DELETE',{body:'{"confirm":"DELETE"}'}),store);
 assert.equal(res.status,200);
 assert.deepEqual(calls,[['audit','u1'],['delete','u1']]);
});
