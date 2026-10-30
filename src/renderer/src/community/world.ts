export const WORLD = { width:960, height:640, spawn:{x:470,y:550} };
export const rooms = [
  {id:'hq',name:'Headquarters',visibility:'public',capacity:35,mapVersion:1,spawn:WORLD.spawn,access:'demo',interactions:['projects','contributors','events','settings']},
  {id:'cool-sdk',name:'CooL SDK room',visibility:'public',capacity:25,mapVersion:1,spawn:WORLD.spawn,access:'demo',interactions:['projects','settings']},
  {id:'meeting',name:'Meeting room',visibility:'public',capacity:25,mapVersion:1,spawn:WORLD.spawn,access:'demo',interactions:['events','settings']},
];
export const obstacles = [
  {x:70,y:125,w:180,h:62},{x:350,y:125,w:180,h:62},{x:650,y:125,w:180,h:62},
  {x:70,y:300,w:180,h:62},{x:350,y:300,w:180,h:62},{x:650,y:300,w:180,h:62},
  {x:90,y:475,w:180,h:65},{x:690,y:470,w:130,h:70},
];
export const stations = [
 {id:'projects',name:'Project terminal',x:160,y:205,route:'/community/projects',description:'Discover projects and open issues'},
 {id:'contributors',name:'Contributor directory',x:440,y:205,route:'/community/contributors',description:'Meet the people behind the projects'},
 {id:'events',name:'Community noticeboard',x:740,y:205,route:'/community/events',description:'Workshops and community gatherings'},
 {id:'issues',name:'First contribution board',x:160,y:380,route:'/community/projects?beginner=1',description:'Find an approachable first issue'},
 {id:'studio',name:'CooL SDK room entrance',x:440,y:380,route:'room:cool-sdk',description:'Visit the project studio'},
 {id:'meeting',name:'Meeting table',x:740,y:380,route:'room:meeting',description:'Visit the meeting room'},
 {id:'desk',name:'Personal desk',x:180,y:555,route:'/community/settings',description:'Your saved work and preferences'},
 {id:'hq',name:'Headquarters entrance',x:755,y:555,route:'room:hq',description:'Return to headquarters'},
];
export function canMove(x:number,y:number) { return x>=35&&y>=95&&x<=925&&y<=603&&!obstacles.some(o=>x>o.x-12&&x<o.x+o.w+12&&y>o.y-10&&y<o.y+o.h+12); }
export function nearStation(x:number,y:number) { return stations.find(s=>Math.hypot(s.x-x,s.y-y)<68); }
export type RoomEnvelope = {version:1; roomId:string; seq:number; type:'move'; payload:{x:number;y:number}};
export function validMovement(value:unknown):value is RoomEnvelope {
 if(!value||typeof value!=='object')return false;
 const e=value as Partial<RoomEnvelope>; return e.version===1&&typeof e.roomId==='string'&&rooms.some(r=>r.id===e.roomId)&&Number.isSafeInteger(e.seq)&&Number(e.seq)>=0&&e.type==='move'&&!!e.payload&&Number.isFinite(e.payload.x)&&Number.isFinite(e.payload.y)&&canMove(e.payload.x,e.payload.y);
}
// All office artwork is original procedural geometry, created for Northwind Cipher.
export function drawOffice(c:CanvasRenderingContext2D,room='hq') {
 const r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 r(0,0,960,640,'#253e36');r(24,72,912,546,'#dec8a4');
 for(let y=80;y<620;y+=24)for(let x=24;x<936;x+=48){r(x,y,47,23,(x/48+y/24)%2?'#e3d0af':'#ddc6a1');r(x,y+22,47,1,'#c9b38f');}
 r(24,38,912,40,'#668675');r(24,72,912,14,'#334b40');r(20,78,8,540,'#668675');r(932,78,8,540,'#668675');r(24,613,912,10,'#1d382e');
 // Windows and wall panels.
 for(const x of [85,295,600,805]){r(x,15,76,53,'#273f36');r(x+5,19,66,43,'#d6e9d2');r(x+36,19,4,43,'#668675');r(x+5,40,66,4,'#668675');r(x+9,23,19,12,'#f7f4ce');}
 r(372,18,216,46,'#eedeb8');c.fillStyle='#345144';c.font='bold 19px monospace';c.textBaseline='alphabetic';c.textAlign='center';c.fillText(room==='hq'?'NORTHWIND HQ':room==='cool-sdk'?'COOL SDK STUDIO':'MEETING ROOM',480,47);
 // Woven rugs with inset borders.
 r(308,240,270,202,'#76917a');r(315,247,256,188,'#8ca18a');r(324,256,238,170,'#76917a');
 r(620,420,235,150,'#b68670');r(628,428,219,134,'#cfa68b');
 const plant=(x:number,y:number)=>{r(x+4,y+22,22,20,'#ae7660');r(x+1,y+20,28,7,'#d3a081');r(x+12,y+4,7,20,'#486d45');r(x,y+5,15,13,'#4b7a50');r(x+16,y,16,15,'#60915b');r(x+8,y-5,13,15,'#789f67');r(x+2,y+6,6,5,'#89ae73');};
 for(const [x,y] of [[40,95],[880,95],[40,560],[880,560],[290,105],[585,105],[290,440],[585,440]])plant(x,y);
 const desk=(x:number,y:number,w:number)=>{r(x+5,y+10,w,62,'#b69d7e');r(x,y,w,55,'#72533c');r(x+4,y+3,w-8,45,'#b98d60');r(x+5,y+3,w-10,5,'#d1aa7c');r(x+12,y+56,10,12,'#634b37');r(x+w-20,y+56,10,12,'#634b37');
 for(const sx of [x+22,x+w-65]){r(sx,y-23,45,34,'#334a43');r(sx+4,y-19,37,25,'#83b7a3');r(sx+7,y-16,20,3,'#d9e7bb');r(sx+7,y-9,30,2,'#b7d4b5');r(sx+19,y+10,6,10,'#334a43');r(sx+9,y+18,28,4,'#40534b');r(sx+3,y+29,42,12,'#ddc5a2');r(sx+8,y+32,30,2,'#b49b78');
 r(sx+5,y+74,34,24,'#3e6350');r(sx+10,y+96,24,7,'#2c463b');r(sx+18,y+100,7,10,'#534d3e');}
 r(x+w/2-4,y+14,12,15,'#f0dfbf');r(x+w/2+8,y+18,5,7,'#eee1ca');};
 obstacles.slice(0,6).forEach(o=>desk(o.x,o.y,o.w));
 r(90,475,180,60,'#a77750');r(95,480,170,50,'#c89e70');r(103,487,154,34,'#dfc398');c.fillStyle='#4b654d';c.font='bold 12px monospace';c.fillText('MAKE YOURSELF AT HOME',180,509);
 r(690,470,130,70,'#71543d');r(694,474,122,60,'#d0ab7b');for(const [x,y] of [[700,450],[770,450],[700,545],[770,545]]){r(x,y,30,18,'#486c54');r(x+4,y+4,22,10,'#739477');}
 // Coffee corner and bookshelf.
 r(44,230,24,45,'#7e6046');r(47,231,18,19,'#d9c6a1');r(49,233,14,10,'#354c42');r(50,252,12,12,'#f1e1be');
 r(866,255,44,150,'#7b5c42');for(let y=262;y<400;y+=35){r(870,y,36,27,'#a68158');for(let j=0;j<5;j++)r(872+j*6,y+4,4,20,['#4d715b','#bf8166','#ead5a4','#899d9a','#8a798f'][j]);}
 // Wayfinding labels are part of the office, not an inaccessible interaction layer.
 c.font='bold 13px monospace';c.textAlign='center';c.fillStyle='#46614b';
 c.fillText('PROJECTS',160,97);c.fillText('CONTRIBUTORS',440,97);c.fillText('NOTICEBOARD',740,97);
 c.fillText('FIRST ISSUES',160,270);c.fillText('COOL SDK ROOM',440,270);c.fillText('MEET & BUILD',740,270);
 // Sunlit floor highlights.
 c.globalAlpha=.12;r(90,87,64,30,'#fff8cb');r(300,87,64,30,'#fff8cb');r(810,87,64,30,'#fff8cb');c.globalAlpha=1;
}


// Keep legacy monochrome profile choices usable while restoring the original palette.
export function avatarColor(value:string):string {
 const original:Record<string,string>={'#222222':'#6e1423','#555555':'#3e7155','#999999':'#8572ac','#eeeeee':'#b67c52'};
 return original[value.toLowerCase()]||(/^#[0-9a-f]{6}$/i.test(value)?value:'#6e1423');
}
