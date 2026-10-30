const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const {parseGitHubItems,loadPublicGitHubSnapshot,GitHubReadError}=loadTs('src/renderer/src/community/coolRepository.ts');
const {canMove}=loadTs('src/renderer/src/community/world.ts');
const {findDemoPath,getDemoMembers,demoStages,demoStageIndex,DEMO_STAGE_MS}=loadTs('src/renderer/src/community/roomDemo.ts');
const item=(number=1)=>({id:100+number,number,title:'A real API title',html_url:`https://github.com/Northwind-Cipher/cool-sdk/issues/${number}`,state:'open',user:{login:'contributor'},labels:[{name:'documentation'}]});
test('public issue parser excludes pull requests and preserves actual issue labels',()=>{
 const parsed=parseGitHubItems([item(),{...item(2),pull_request:{url:'https://api.github.com/example'}}],'issues');
 assert.equal(parsed.length,1);assert.deepEqual(parsed[0].labels,['documentation']);assert.equal(parsed[0].author,'contributor');
});
test('public data rejects external links, malformed titles and invalid list shapes',()=>{
 assert.throws(()=>parseGitHubItems([{...item(),html_url:'https://evil.example/issues/1'}],'issues'),GitHubReadError);
 assert.throws(()=>parseGitHubItems([{...item(),title:{html:'unsafe'}}],'issues'),GitHubReadError);
 assert.throws(()=>parseGitHubItems({items:[]},'issues'),GitHubReadError);
});
test('public provider reads only the configured repository without sending credentials',async()=>{
 const urls=[];
 const fake=async(url,options)=>{urls.push(url);assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);return new Response(JSON.stringify(url.includes('/pulls?')?[{...item(4),html_url:'https://github.com/Northwind-Cipher/cool-sdk/pull/4'}]:[item()]),{status:200})};
 const snapshot=await loadPublicGitHubSnapshot(fake);assert.equal(snapshot.source,'github-public-api');assert.equal(snapshot.issues.length,1);assert.equal(snapshot.pullRequests.length,1);assert.equal(urls.length,2);assert.ok(urls.every(u=>u.startsWith('https://api.github.com/repos/Northwind-Cipher/cool-sdk/')));
});
test('rate limiting and oversized responses fail without fabricated fallback data',async()=>{
 await assert.rejects(loadPublicGitHubSnapshot(async()=>new Response('{}',{status:429})),error=>error.kind==='rate-limit');
 await assert.rejects(loadPublicGitHubSnapshot(async()=>new Response('x'.repeat(750001),{status:200})),error=>error.kind==='invalid-data');
});
test('demo routes navigate around furniture rather than passing through it',()=>{
 const route=findDemoPath({x:160,y:210},{x:740,y:380});assert.ok(route.length>50);
 for(let i=0;i<route.length;i++){assert.ok(canMove(route[i].x,route[i].y));if(i)assert.equal(Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].y-route[i-1].y),10)}
});
test('demo animation is deterministic, stays walkable and cannot claim live presence',()=>{
 for(let t=0;t<=120000;t+=431){const a=getDemoMembers(t);assert.deepEqual(a,getDemoMembers(t));for(const m of a){assert.equal(m.source,'demo');assert.ok(canMove(m.x,m.y))}}
 assert.equal(getDemoMembers(0).length,3);
});
test('sample stages wrap predictably without creating contribution records',()=>{
 assert.equal(demoStageIndex(0),0);assert.equal(demoStageIndex(DEMO_STAGE_MS),1);assert.equal(demoStageIndex(DEMO_STAGE_MS*demoStages.length),0);
});
