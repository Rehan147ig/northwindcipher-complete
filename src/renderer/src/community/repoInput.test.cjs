const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const {parseRepo}=loadTs('src/renderer/src/community/repoInput.ts');

test('accepts owner/repo and github.com URLs',()=>{
 for(const input of ['Northwind-Cipher/cool-sdk','https://github.com/Northwind-Cipher/cool-sdk','https://github.com/Northwind-Cipher/cool-sdk/','https://www.github.com/Northwind-Cipher/cool-sdk.git','https://github.com/Northwind-Cipher/cool-sdk?tab=readme#top','  Northwind-Cipher/cool-sdk  '])
  assert.equal(parseRepo(input).fullName,'Northwind-Cipher/cool-sdk',input);
});

test('rejects anything that is not a plain repository reference',()=>{
 for(const input of ['','cool-sdk','a/b/c','http://github.com/a/b','https://evil.example/a/b','-bad/repo','a/..','a/.','a b/c','javascript:alert(1)','../x/y','a/b'+'c'.repeat(150)])
  assert.equal(parseRepo(input),null,input);
});
