const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const {projects,filterProjects,demoProvider}=loadTs('src/renderer/src/community/data.ts');
const {WORLD,obstacles,canMove,nearStation,rooms,validMovement}=loadTs('src/renderer/src/community/world.ts');
test('directory combines filters and sorts without changing fixtures',()=>{
 const original=projects.map(p=>p.slug);
 assert.equal(filterProjects(projects,'accessible','TypeScript','Beginner','Design systems','Code','name')[0].slug,'windkit');
 assert.equal(filterProjects(projects,'no such project','','','','','issues').length,0);
 assert.equal(filterProjects(projects,'','Rust','Intermediate','','Testing','issues')[0].slug,'leaf-db');
 assert.deepEqual(projects.map(p=>p.slug),original);
});
test('demo provider supports known and missing project detail',async()=>{
 assert.equal((await demoProvider.listProjects()).length,6);
 assert.equal((await demoProvider.getProject('windkit')).maintainer,'maya');
 assert.equal(await demoProvider.getProject('missing'),undefined);
});
test('spawn is traversable and world boundaries reject invalid movement',()=>{
 assert.ok(canMove(WORLD.spawn.x,WORLD.spawn.y));
 for(const [x,y] of [[0,300],[960,300],[470,60],[470,640],[-1,200]])assert.equal(canMove(x,y),false);
});
test('every workstation obstacle blocks the avatar',()=>{
 for(const o of obstacles)assert.equal(canMove(o.x+o.w/2,o.y+o.h/2),false);
 assert.ok(canMove(300,230));
});
test('interaction requires proximity to a station',()=>{
 assert.equal(nearStation(160,205).id,'projects');
 assert.equal(nearStation(600,600),undefined);
});
test('room contracts have unique identity, spawn, and bounded design capacity',()=>{
 assert.equal(new Set(rooms.map(r=>r.id)).size,rooms.length);
 for(const r of rooms){assert.ok(r.capacity>=25&&r.capacity<=50);assert.ok(canMove(r.spawn.x,r.spawn.y));}
});
test('movement envelope rejects malformed, unknown-room and collision payloads',()=>{
 const e={version:1,roomId:'hq',seq:1,type:'move',payload:WORLD.spawn};
 assert.ok(validMovement(e));
 for(const bad of [null,{}, {...e,seq:-1},{...e,roomId:'private'},{...e,payload:{x:NaN,y:0}},{...e,payload:{x:100,y:150}},{...e,payload:{x:0,y:0}}])assert.equal(validMovement(bad),false);
});

const {parseLocal,empty}=loadTs('src/renderer/src/community/localState.ts');
test('local state safely rejects corrupt or oversized persisted data',()=>{
 assert.deepEqual(parseLocal('{bad json'),empty);
 assert.deepEqual(parseLocal(JSON.stringify({...empty,messages:[{text:{unsafe:true}}]})),empty);
 assert.deepEqual(parseLocal(JSON.stringify({...empty,saved:Array(101).fill('x')})),empty);
 assert.deepEqual(parseLocal(JSON.stringify({...empty,profile:{name:'a',skills:[],presence:false,notifications:false,color:'url(javascript:bad)'}})),empty);
});
test('local state round trips legitimate opt-in preferences and saved work',()=>{
 const data={...empty,profile:{name:'Rehan',skills:['React'],presence:false,notifications:false,color:'#6e1423'},saved:['wk-12']};
 assert.deepEqual(parseLocal(JSON.stringify(data)),data);
});
