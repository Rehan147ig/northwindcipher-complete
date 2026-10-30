const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../test/load-ts.cjs');
const {handleAdmin}=loadTs('api/_lib/admin.ts');

const TOKEN='a'.repeat(40);
function fake({moderator=true}={}){
 const calls=[];
 return {calls,store:{
  async getUser(t){return t===TOKEN?{id:'u1'}:null},
  async isModerator(id){calls.push(['isModerator',id]);return moderator},
  async recentDeliveries(limit){calls.push(['deliveries',limit]);return [{delivery_id:'d1',status:'processed'}]},
 }};
}
const req=(o={})=>({method:'GET',url:'/api/admin?resource=deliveries',headers:{authorization:'Bearer '+TOKEN},...o});

test('requires a valid bearer token before anything else',async()=>{
 const {store,calls}=fake();
 for(const r of [req({headers:{}}),req({headers:{authorization:'Bearer short'}}),req({headers:{authorization:'Bearer '+'b'.repeat(40)}})])
  assert.equal((await handleAdmin(r,store)).status,401);
 assert.equal(calls.length,0);
});

test('rejects non-GET methods',async()=>{
 const {store}=fake();
 assert.equal((await handleAdmin(req({method:'POST'}),store)).status,405);
});

test('non-moderators are forbidden and never see data',async()=>{
 const {store,calls}=fake({moderator:false});
 const res=await handleAdmin(req(),store);
 assert.deepEqual([res.status,res.body.error],[403,'forbidden']);
 assert.equal(calls.some(c=>c[0]==='deliveries'),false);
});

test('moderators get recent webhook deliveries; unknown resources 404',async()=>{
 const {store,calls}=fake();
 const res=await handleAdmin(req(),store);
 assert.equal(res.status,200);assert.equal(res.body.deliveries[0].delivery_id,'d1');
 assert.deepEqual(calls.at(-1),['deliveries',50]);
 assert.equal((await handleAdmin(req({url:'/api/admin?resource=secrets'}),store)).status,404);
 assert.equal((await handleAdmin(req({url:'/api/admin'}),store)).status,404);
});
