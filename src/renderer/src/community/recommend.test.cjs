const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const {recommendIssues,onboardingSteps,nextStep}=loadTs('src/renderer/src/community/recommend.ts');
const {issues,projects}=loadTs('src/renderer/src/community/data.ts');

test('ranks issues by matching skills and explains each match',()=>{
 const recs=recommendIssues(['TypeScript','Accessibility'],[],issues,projects);
 // Both TypeScript issues lead; the design one also fits "Accessibility", so it ranks first.
 assert.deepEqual(recs.slice(0,2).map(r=>r.issue.id),['ns-18','wk-12']);
 assert.ok(recs[0].reasons.some(r=>/TypeScript/.test(r)));
 assert.ok(recs[0].reasons.some(r=>/accessibility/.test(r)));
 assert.ok(recs[0].score>recs[1].score);
 const docs=recommendIssues(['Documentation'],[],issues,projects);
 assert.ok(['oa-24','fn-7'].includes(docs[0].issue.id));
 assert.ok(docs[0].reasons.some(r=>/documentation/.test(r)));
});

test('skills are matched case-insensitively and ignore blanks',()=>{
 const recs=recommendIssues(['  typescript ','',' '],[],issues,projects);
 assert.equal(recs[0].issue.language,'TypeScript');
});

test('already-saved issues are never suggested again',()=>{
 const recs=recommendIssues(['TypeScript'],['wk-12'],issues,projects,10);
 assert.equal(recs.some(r=>r.issue.id==='wk-12'),false);
 assert.equal(recs.length,issues.length-1);
});

test('with no skills it still returns safe beginner suggestions with a reason',()=>{
 const recs=recommendIssues([],[],issues,projects,2);
 assert.equal(recs.length,2);
 for(const r of recs)assert.ok(r.reasons.length>=1);
});

test('limit is respected and ordering is stable',()=>{
 assert.equal(recommendIssues([],[],issues,projects,3).length,3);
 const a=recommendIssues(['Rust'],[],issues,projects).map(r=>r.issue.id);
 const b=recommendIssues(['Rust'],[],issues,projects).map(r=>r.issue.id);
 assert.deepEqual(a,b);
});

test('onboarding steps track real progress and point to the next one',()=>{
 const base={emailConfirmed:false,displayName:'',skills:[],approved:false,githubLinked:false,saved:0,events:0};
 const none=onboardingSteps(base);
 assert.deepEqual(none.map(s=>s.done),[false,false,false,false,false]);
 assert.equal(nextStep(none).id,'email');
 const waiting=onboardingSteps({...base,emailConfirmed:true,displayName:'Sam',skills:['Rust']});
 assert.deepEqual(waiting.map(s=>s.done),[true,true,false,false,false]);
 assert.equal(nextStep(waiting).id,'access');
 const approved=onboardingSteps({...base,emailConfirmed:true,displayName:'Sam',skills:['Rust'],approved:true,events:1});
 assert.deepEqual(approved.map(s=>s.done),[true,true,true,false,true]);
 assert.equal(nextStep(approved).id,'github');
 const all=onboardingSteps({...base,emailConfirmed:true,displayName:'Sam',skills:['Rust'],approved:true,githubLinked:true,saved:2});
 assert.equal(nextStep(all),undefined);
 assert.equal(onboardingSteps({...base,emailConfirmed:true,displayName:'Sam',skills:[' ']})[1].done,false);
});
