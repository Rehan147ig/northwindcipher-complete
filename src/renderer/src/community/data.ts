import {coolRepository} from './coolRepository';
export type Project = { slug: string; name: string; icon: string; color: string; description: string; language: string; topic: string; type: string; level: string; issues: number; maintainer: string; tags: string[]; source?:'repository'|'demo'; repositoryUrl?:string; contributionUrl?:string };
export const demoProjects: Project[] = [
  { slug:'windkit', name:'Windkit', icon:'⌘', color:'mint', description:'Thoughtful, accessible React components. Build interfaces that welcome everyone.', language:'TypeScript', topic:'Design systems', type:'Code', level:'Beginner', issues:8, maintainer:'maya', tags:['React','Accessibility','UI'] },
  { slug:'cipher-cli', name:'Cipher CLI', icon:'>_', color:'lavender', description:'A little less setup. A lot more building. Your open-source developer toolkit.', language:'Rust', topic:'Developer tools', type:'Code', level:'Intermediate', issues:5, maintainer:'arjun', tags:['CLI','Automation','Tooling'] },
  { slug:'open-atlas', name:'Open Atlas', icon:'◎', color:'peach', description:'An open map of knowledge, built by curious people, for curious people.', language:'Python', topic:'Education', type:'Documentation', level:'Beginner', issues:6, maintainer:'lena', tags:['Python','Education','Data'] },
  { slug:'northstar', name:'Northstar', icon:'✳', color:'lemon', description:'Find your next contribution with a friendly guide to the open-source universe.', language:'TypeScript', topic:'Developer tools', type:'Design', level:'Beginner', issues:4, maintainer:'maya', tags:['Next.js','Community','Design'] },
  { slug:'leaf-db', name:'Leaf DB', icon:'♧', color:'mint', description:'A tiny local-first document store that keeps your ideas close to home.', language:'Rust', topic:'Data', type:'Testing', level:'Intermediate', issues:3, maintainer:'arjun', tags:['Database','Local-first','Testing'] },
  { slug:'field-notes', name:'Field Notes', icon:'≡', color:'lavender', description:'Practical guides that make a first open-source contribution feel possible.', language:'Markdown', topic:'Education', type:'Documentation', level:'Beginner', issues:7, maintainer:'lena', tags:['Writing','Guides','Community'] },
];
export const coolProject:Project={slug:'cool-sdk',name:'CooL SDK',icon:'C',color:'mint',description:coolRepository.description,language:'TypeScript',topic:'Developer tools',type:'Code',level:'Intermediate',issues:0,maintainer:'northwind-cipher',tags:['SDK','CLI','Verifiable evidence'],source:'repository',repositoryUrl:coolRepository.url,contributionUrl:coolRepository.guideUrl};
export const projects:Project[]=[coolProject,...demoProjects];
export const contributors = [
  {handle:'maya', name:'Maya Chen', initials:'MC', role:'Frontend & accessibility', bio:'Making the web a little more welcoming, one component at a time. Happy to help with your first pull request.', skills:['React','TypeScript','Accessibility'], color:'mint'},
  {handle:'arjun', name:'Arjun Patel', initials:'AP', role:'Systems & developer tools', bio:'I build small tools for big ideas. Usually thinking about Rust, thoughtful APIs, and a good cup of coffee.', skills:['Rust','Testing','Tooling'], color:'lavender'},
  {handle:'lena', name:'Lena Brooks', initials:'LB', role:'Documentation & education', bio:'Turning complicated things into clear explanations. Code is a team sport, and writing is part of the game.', skills:['Python','Documentation','Design'], color:'peach'},
];
export const issues = [
  {id:'wk-12', project:'windkit', number:12, title:'Add keyboard navigation to the tabs component', language:'TypeScript', type:'Code', reason:'A small, well-scoped React task with a maintainer-written walkthrough.'},
  {id:'oa-24', project:'open-atlas', number:24, title:'Write a friendly guide to your first dataset', language:'Python', type:'Documentation', reason:'No code required. A clear outline and example dataset are included.'},
  {id:'ns-18', project:'northstar', number:18, title:'Design the empty state for saved projects', language:'TypeScript', type:'Design', reason:'A contained design task with existing tokens and a visual reference.'},
  {id:'fn-7', project:'field-notes', number:7, title:'Improve the first pull request checklist', language:'Markdown', type:'Documentation', reason:'Great for new contributors: share what would have helped you get started.'},
];
export const events = [
  {id:'welcome', day:'07', month:'NOV', date:'2026-11-07T10:30:00Z', name:'Your first contribution', category:'WORKSHOP', description:'Bring your questions. We will walk through an issue, a branch, and your very first pull request.', organizer:'Maya Chen', room:'Learning lounge'},
  {id:'build', day:'14', month:'NOV', date:'2026-11-14T12:00:00Z', name:'Saturday build together', category:'CO-WORKING', description:'A relaxed afternoon to work on a project, compare notes, and get unstuck together.', organizer:'Arjun Patel', room:'Meeting room'},
  {id:'show', day:'21', month:'NOV', date:'2026-11-21T11:00:00Z', name:'Small wins, open doors', category:'SHOW & TELL', description:'Five minutes, one thing you made or learned. Every contribution deserves a little spotlight.', organizer:'Lena Brooks', room:'Event space'},
];
// Demo fixtures are the only configured source. No fabricated repository URLs.
export interface CommunityProvider { listProjects(): Promise<Project[]>; getProject(slug:string): Promise<Project | undefined>; }
export const demoProvider: CommunityProvider = { listProjects:async()=>demoProjects, getProject:async(slug)=>demoProjects.find(p=>p.slug===slug) };
export const communityProvider:CommunityProvider={listProjects:async()=>[coolProject],getProject:async(slug)=>slug==='cool-sdk'?coolProject:undefined};
export function filterProjects(items:Project[], query:string, language:string, level:string, topic:string, type:string, sort:string) {
  const result = items.filter(p=>(!query || `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())) && (!language||p.language===language) && (!level||p.level===level) && (!topic||p.topic===topic) && (!type||p.type===type));
  return result.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):b.issues-a.issues);
}
