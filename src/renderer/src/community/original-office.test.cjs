const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loadTs=require('../../../../test/load-ts.cjs');
const {findPath}=loadTs('src/renderer/src/scene/office/pathfinding.ts');
const map=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/maps/office.tmj'),'utf8'));
const collision=map.layers.find(l=>l.name==='collision').data;
const spawns=new Map(map.layers.find(l=>l.name==='spawn-points').objects.map(o=>[o.name,{x:Math.floor(o.x/16),y:Math.floor(o.y/16)}]));
const seats=new Set([...spawns].filter(([name])=>['desk-','pc-','warroom-','entrance'].some(prefix=>name.startsWith(prefix))).map(([,p])=>`${p.x},${p.y}`));
const walkable={width:map.width,height:map.height,isWalkable(x,y){return x>=0&&y>=0&&x<map.width&&y<map.height&&(seats.has(`${x},${y}`)||(collision[y*map.width+x]&0x1fffffff)===0)}};
test('every original office desk and cafe spawn is reachable from the entrance',()=>{
 for(const [name,point]of spawns){assert.ok(findPath(walkable,spawns.get('entrance'),point),`${name} must be reachable`)}
});
test('the original pathfinder keeps community movement on adjacent walkable map tiles',()=>{
 const start=spawns.get('entrance');const route=findPath(walkable,start,spawns.get('desk-chief-architect'));assert.ok(route.length>10);let previous=start;
 for(const tile of route){assert.ok(walkable.isWalkable(tile.x,tile.y));assert.equal(Math.abs(tile.x-previous.x)+Math.abs(tile.y-previous.y),1);previous=tile}
 assert.equal(findPath(walkable,start,{x:-1,y:-1}),null);
 assert.equal(findPath(walkable,start,{x:0,y:0}),null);
});
