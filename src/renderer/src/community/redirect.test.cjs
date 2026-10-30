const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const {safeReturnPath}=loadTs('src/renderer/src/community/redirect.ts');
test('keeps same-site community paths',()=>{
 for(const ok of ['/community','/community/world','/community/projects/cool-sdk#issues','/community/projects?beginner=1'])assert.equal(safeReturnPath(ok),ok);
});
test('rejects external, protocol-relative and malformed targets',()=>{
 const bad=['https://evil.example','//evil.example','/\\evil.example','javascript:alert(1)','/other','/community/../admin','/community\\..\\x','/community/\u0000','',null,undefined,'/community'+'a'.repeat(300),'/community/%2e%2e/x'.replace('%2e%2e','..')];
 for(const value of bad)assert.equal(safeReturnPath(value),'/community/dashboard',String(value).slice(0,40));
});
test('uses the supplied fallback',()=>assert.equal(safeReturnPath('//x','/community'),'/community'));
