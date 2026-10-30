import {coolRepository} from './coolRepository';
export function SavedCoolWork({saved,onSave}:{saved:string[];onSave:(key:string)=>void}){
 const work=saved.map(key=>{const match=/^cool-sdk:(issue|pull):([1-9]\d{0,8})$/.exec(key);return match?{key,type:match[1],number:match[2]}:null}).filter((v):v is {key:string;type:string;number:string}=>!!v);
 if(!work.length)return null;
 return <section className="nw-saved-cool-work"><div className="nw-eyebrow">SAVED FROM PUBLIC GITHUB</div><h3>Your CooL work</h3><p className="nw-small nw-muted">Saved locally. The current state and discussion are on GitHub.</p>{work.map(w=><div key={w.key}><a href={`${coolRepository.url}/${w.type==='pull'?'pull':'issues'}/${w.number}`} target="_blank" rel="noopener noreferrer">CooL SDK {w.type==='pull'?'pull request':'issue'} #{w.number} ↗</a><button className="nw-save is-saved" aria-label={`Unsave CooL ${w.type} ${w.number}`} onClick={()=>onSave(w.key)}>Saved ✓</button></div>)}</section>;
}
