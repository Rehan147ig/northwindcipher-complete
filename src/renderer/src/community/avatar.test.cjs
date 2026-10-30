const test=require('node:test');
const assert=require('node:assert/strict');
const loadTs=require('../../../../test/load-ts.cjs');
const A=loadTs('src/renderer/src/scene/office/avatar.ts');

const opaque=(px)=>{let n=0;for(let i=3;i<px.length;i+=4)if(px[i]>0)n++;return n};

test('sanitize keeps valid values and replaces everything else with safe defaults',()=>{
 const good=A.sanitizeAvatar({skin:'ebony',hair:'afro',hairColor:'#AABBCC',cloth:'hoodie',facial:'goatee',glasses:true,heavy:true});
 assert.equal(good.skin,'ebony');assert.equal(good.hair,'afro');assert.equal(good.hairColor,'#aabbcc');assert.equal(good.glasses,true);assert.equal(good.facial,'goatee');
 const bad=A.sanitizeAvatar({skin:'<script>',hair:{x:1},hairColor:'red',cloth:'../../etc',facial:'beard',glasses:'yes',pants:'#12'});
 assert.deepEqual(bad,A.DEFAULT_AVATAR);
 for(const junk of [null,undefined,42,'text',[],true])assert.deepEqual(A.sanitizeAvatar(junk),A.DEFAULT_AVATAR);
});

test('sanitize drops unknown keys so nothing extra can be stored',()=>{
 const out=A.sanitizeAvatar({skin:'tan',evil:'x'.repeat(5000),__proto__:{polluted:true}});
 assert.deepEqual(Object.keys(out).sort(),Object.keys(A.DEFAULT_AVATAR).sort());
 assert.ok(JSON.stringify(out).length<400);
});

test('every skin, hair style and outfit renders to a non-empty, correctly sized sprite',()=>{
 for(const skin of A.SKIN_OPTIONS)for(const hair of A.HAIR_OPTIONS){
  const p=A.renderAvatarPortrait({skin:skin.id,hair:hair.id});
  assert.equal(p.pixels.length,p.w*p.h*4);assert.ok(opaque(p.pixels)>150,skin.id+'/'+hair.id);
 }
 for(const cloth of A.CLOTH_OPTIONS){
  const p=A.renderAvatarPortrait({cloth:cloth.id});assert.ok(opaque(p.pixels)>200,cloth.id);
  const s=A.renderAvatarScene({cloth:cloth.id});
  assert.equal(s.front.length,3);assert.equal(s.back.length,3);assert.equal(s.front[0].length,s.w*s.h*4);assert.ok(opaque(s.front[0])>250);
 }
});

test('different choices produce visibly different pixels, and the same spec is always identical',()=>{
 const a=A.renderAvatarPortrait({hair:'afro',skin:'ebony'}).pixels;
 const b=A.renderAvatarPortrait({hair:'mohawk',skin:'fair'}).pixels;
 const c=A.renderAvatarPortrait({hair:'afro',skin:'ebony'}).pixels;
 assert.notDeepEqual(Array.from(a),Array.from(b));
 assert.deepEqual(Array.from(a),Array.from(c));
 const glasses=A.renderAvatarPortrait({glasses:true}).pixels,none=A.renderAvatarPortrait({glasses:false}).pixels;
 assert.notDeepEqual(Array.from(glasses),Array.from(none));
 const red=A.renderAvatarPortrait({cloth:'tee',clothColor:'#c0392b'}).pixels,blue=A.renderAvatarPortrait({cloth:'tee',clothColor:'#3d6fb5'}).pixels;
 assert.notDeepEqual(Array.from(red),Array.from(blue));
});

test('random characters are always valid and reproducible from a seed',()=>{
 let seed=12345;const rng=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
 const seen=new Set();
 for(let i=0;i<200;i++){const spec=A.randomAvatar(rng);assert.deepEqual(A.sanitizeAvatar(spec),spec);seen.add(JSON.stringify(spec));assert.ok(opaque(A.renderAvatarPortrait(spec).pixels)>150)}
 assert.ok(seen.size>195,'200 random characters should almost all be different');
 const mk=()=>{let s=7;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296}};
 assert.deepEqual(A.randomAvatar(mk()),A.randomAvatar(mk()));
});

test('there is a wide variety on offer',()=>{
 assert.ok(A.SKIN_OPTIONS.length>=8);assert.ok(A.HAIR_OPTIONS.length>=18);assert.ok(A.CLOTH_OPTIONS.length>=8);
 const combos=A.SKIN_OPTIONS.length*A.HAIR_OPTIONS.length*A.HAIR_COLORS.length*A.CLOTH_OPTIONS.length*A.CLOTH_COLORS.length*A.FACIAL_OPTIONS.length*2*A.BROW_OPTIONS.length*A.MOUTH_OPTIONS.length;
 assert.ok(combos>1000000,'preset combinations: '+combos);
});
