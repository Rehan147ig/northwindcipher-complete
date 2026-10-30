// Explainable beginner-issue matching (spec §15–17). No opaque scoring: every point comes with a reason shown to the user.
import type {Project} from './data';

export type IssueLike={id:string;project:string;number:number;title:string;language:string;type:string;reason:string};
export type Recommendation={issue:IssueLike;project?:Project;score:number;reasons:string[]};

// Skills a contributor might list that indicate comfort with a type of work.
const TYPE_HINTS:Record<string,string[]>={
 Documentation:['documentation','docs','writing','markdown','technical writing','education'],
 Design:['design','ui','ux','figma','accessibility'],
 Testing:['testing','tests','qa','quality'],
 Code:['code','coding','programming'],
};

const norm=(s:string)=>s.trim().toLowerCase();

export function recommendIssues(skills:string[],saved:string[],issues:IssueLike[],projects:Project[],limit=4):Recommendation[]{
 const have=new Set(skills.map(norm).filter(Boolean));
 const savedSet=new Set(saved);
 const ranked=issues.filter(i=>!savedSet.has(i.id)).map(issue=>{
  const project=projects.find(p=>p.slug===issue.project);
  const reasons:string[]=[];let score=0;
  if(have.has(norm(issue.language))){score+=3;reasons.push(`Matches your ${issue.language} skill`)}
  const hints=TYPE_HINTS[issue.type]||[];
  const hint=hints.find(h=>have.has(h));
  if(hint){score+=2;reasons.push(`Fits your ${hint} skills`)}
  if(project?.level==='Beginner'){score+=1;reasons.push('Beginner-friendly project')}
  score+=1;reasons.push('Labelled good first issue');
  return {issue,project,score,reasons};
 });
 // Highest score first; ties keep a stable, predictable order.
 ranked.sort((a,b)=>b.score-a.score||a.issue.id.localeCompare(b.issue.id));
 return ranked.slice(0,limit);
}

export type StepId='email'|'profile'|'access'|'github'|'first';
export type Step={id:StepId;title:string;hint:string;done:boolean};

export function onboardingSteps(i:{emailConfirmed:boolean;displayName:string;skills:string[];approved:boolean;githubLinked:boolean;saved:number;events:number}):Step[]{
 return [
  {id:'email',title:'Confirm your email',hint:'Open the message we sent and click the link.',done:i.emailConfirmed},
  {id:'profile',title:'Complete your profile',hint:'Add your name and at least one skill so we can suggest the right work.',done:i.displayName.trim().length>0&&i.skills.some(s=>s.trim().length>0)},
  {id:'access',title:'Request contributor access',hint:'Tell the team what you want to build. They review every request before you can contribute.',done:i.approved},
  {id:'github',title:'Link GitHub to get verified',hint:'Verified contributors can enroll repositories and are recognised on projects.',done:i.githubLinked},
  {id:'first',title:'Pick your first issue or event',hint:'Save a beginner issue or mark an event you are interested in.',done:i.saved>0||i.events>0},
 ];
}

export function nextStep(steps:Step[]):Step|undefined{return steps.find(s=>!s.done)}
