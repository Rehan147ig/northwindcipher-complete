import {canMove} from './world';
export type Point={x:number;y:number};
export type DemoClock={elapsedMs:number;running:boolean};
export const DEMO_STAGE_MS=14000;
export const demoStages=[
 {id:'issue',name:'Choose an issue',description:'A sample contributor reads an issue and checks the contribution guide.'},
 {id:'pull-request',name:'Open a pull request',description:'A sample change is prepared with tests and a clear explanation.'},
 {id:'review',name:'Review together',description:'A sample maintainer reviews the change and the contributor responds.'},
 {id:'merge',name:'Merge & recognize',description:'A simulated merge completes the example. No real contribution is recorded.'},
] as const;
// Fixed waypoints avoid randomness and make demo behavior reproducible and testable.
const key=(p:Point)=>`${p.x},${p.y}`;
export function findDemoPath(from:Point,to:Point):Point[]{
 const snap=(p:Point)=>({x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10});const start=snap(from),end=snap(to);
 if(!canMove(start.x,start.y)||!canMove(end.x,end.y))throw new Error('Demo route endpoint is blocked');
 const queue:Point[]=[start];const parent=new Map<string,Point|null>([[key(start),null]]);let cursor=0;
 while(cursor<queue.length){const current=queue[cursor++];if(key(current)===key(end)){const path:Point[]=[];let p:Point|null=current;while(p){path.push(p);p=parent.get(key(p))||null}return path.reverse()}
  for(const [dx,dy] of [[10,0],[0,10],[-10,0],[0,-10]]){const next={x:current.x+dx,y:current.y+dy};if(!parent.has(key(next))&&canMove(next.x,next.y)){parent.set(key(next),current);queue.push(next)}}
 }
 throw new Error('No walkable route between demo stations');
}
const route=(points:Point[])=>points.slice(1).flatMap((p,i)=>findDemoPath(points[i],p).slice(i?1:0));
const participants=[
 {id:'demo-maya',name:'Maya',handle:'maya',tone:0x6e1423,offset:0,actions:['Reading an issue','Preparing an example','Reviewing together','Celebrating a sample merge'],path:route([{x:160,y:210},{x:440,y:380},{x:740,y:380},{x:160,y:210}])},
 {id:'demo-arjun',name:'Arjun',handle:'arjun',tone:0x3e7155,offset:23,actions:['Checking the guide','Adding sample tests','Reviewing a change','Returning to the project desk'],path:route([{x:440,y:210},{x:160,y:380},{x:740,y:210},{x:440,y:210}])},
 {id:'demo-lena',name:'Lena',handle:'lena',tone:0x8572ac,offset:47,actions:['Exploring documentation','Writing an explanation','Discussing feedback','Updating sample notes'],path:route([{x:740,y:380},{x:160,y:210},{x:440,y:210},{x:740,y:380}])},
];
export type DemoMember={id:string;name:string;handle:string;tone:number;x:number;y:number;walking:boolean;action:string;source:'demo'};
export function demoStageIndex(elapsedMs:number){return Math.floor(Math.max(0,elapsedMs)/DEMO_STAGE_MS)%demoStages.length}
export function getDemoMembers(elapsedMs:number):DemoMember[]{
 const stage=demoStageIndex(elapsedMs);
 return participants.map(p=>{const cycle=(Math.max(0,elapsedMs)/120+p.offset)%(p.path.length+24);const at=Math.min(Math.floor(cycle),p.path.length-1);const a=p.path[at],b=p.path[Math.min(at+1,p.path.length-1)];const fraction=cycle-at;return {id:p.id,name:p.name,handle:p.handle,tone:p.tone,x:a.x+(b.x-a.x)*Math.min(fraction,1),y:a.y+(b.y-a.y)*Math.min(fraction,1),walking:at<p.path.length-1,action:p.actions[stage],source:'demo'}});
}
export interface RoomDemoProvider {source:'demo';members:(elapsedMs:number)=>DemoMember[];stage:(elapsedMs:number)=>typeof demoStages[number]}
export const demoRoomProvider:RoomDemoProvider={source:'demo',members:getDemoMembers,stage:t=>demoStages[demoStageIndex(t)]};
