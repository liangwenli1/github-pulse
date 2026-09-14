import { db } from './db.js';

export const boards = {
  hot: { zh:'近期热门', en:'Trending now', metric:'score' },
  rising: { zh:'升星最快', en:'Fastest rising', metric:'gain' },
  new: { zh:'新秀项目', en:'Newcomers', metric:'gain' },
  ai: { zh:'AI 热门', en:'AI & agents', metric:'score' },
  topics: { zh:'语言 / 主题', en:'Language & topics', metric:'score' },
  stars: { zh:'总星数', en:'All-time stars', metric:'stars' },
  forks: { zh:'Fork 最多', en:'Most forked', metric:'forks' }
};
const DAYS={day:1,week:7,month:30};
const aiTerms=['ai','llm','agent','agents','inference','rag','machine-learning','model','mcp'];

// GitHub's 2026 star-history API returns weekly buckets and seven day counts.
// Bucket dates are derived from its week timestamp; GitHub does not guarantee UTC boundaries.
export function getStarSeries(repoId, endpoint, days, createdAt) {
  const rows=db.prepare('SELECT week_start,days_json,sampled_at FROM star_history WHERE repo_id=? ORDER BY week_start DESC LIMIT 12').all(repoId);
  if(!rows.length) return {complete:false,points:[]};
  if(new Date(rows[0].sampled_at).getTime()<endpoint.getTime()-6*3600000) return {complete:false,points:[]};
  const byDate=new Map();
  for(const row of rows) {
    const counts=JSON.parse(row.days_json);
    counts.forEach((count,i)=>byDate.set(new Date((row.week_start+i*86400)*1000).toISOString().slice(0,10),Number(count)||0));
  }
  const endDate=new Date(Date.UTC(endpoint.getUTCFullYear(),endpoint.getUTCMonth(),endpoint.getUTCDate()));
  const startDate=new Date(endDate.getTime()-(days-1)*86400000);
  const points=Array.from({length:days},(_,i)=>{
    const date=new Date(startDate.getTime()+i*86400000).toISOString().slice(0,10);
    return {date,count:byDate.get(date)??null};
  });
  const created=createdAt?new Date(createdAt).toISOString().slice(0,10):null;
  const complete=points.every(p=>p.count!==null || (created&&p.date<created));
  return {complete,points:points.map(p=>({...p,count:p.count??(created&&p.date<created?0:null)}))};
}

export function aiEvidence(repo) {
  const topics=JSON.parse(repo.topics||'[]');
  const topicEvidence=topics.filter(x=>aiTerms.some(y=>x.toLowerCase()===y||x.toLowerCase().includes(`${y}-`)||x.toLowerCase().includes(`-${y}`))).map(x=>`topic:${x}`);
  const description=String(repo.description||'');
  const match=description.match(/\b(ai|llm|agents?|inference|rag|machine learning|model|mcp)\b/i);
  return [...topicEvidence,...(match?[`description:${match[0]}`]:[])];
}
function snapshotNear(id, target, maxHours=6) {
  const source=(process.env.DATA_MODE||'demo')==='demo'?'demo':'github';
  const r=db.prepare('SELECT * FROM snapshots WHERE repo_id=? AND source=? ORDER BY ABS(strftime(\'%s\',sampled_at)-strftime(\'%s\',?)) LIMIT 1').get(id,source,target.toISOString());
  return r && Math.abs(new Date(r.sampled_at)-target)<=maxHours*3600000 ? r : null;
}
function percentile(values,v) {
  if (!values.length) return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return 100*(sorted.filter(x=>x<=v).length-1)/Math.max(1,sorted.length-1);
}
export function getRankings({board='hot',period='week',language='',topic='',age='',q='',page=1,limit=10}={}) {
  if (!boards[board]) board='hot';
  if (!DAYS[period]) period='week';
  const source=(process.env.DATA_MODE||'demo')==='demo'?'demo':'github';
  const all=db.prepare('SELECT * FROM repos WHERE deleted=0 AND archived=0 AND source=?').all(source);
  const latestTime=db.prepare('SELECT MAX(sampled_at) t FROM snapshots WHERE source=?').get(source).t;
  const endpoint=latestTime?new Date(latestTime):new Date();
  const live=source==='github';
  const currentDay=new Date(Date.UTC(endpoint.getUTCFullYear(),endpoint.getUTCMonth(),endpoint.getUTCDate()));
  const start=live?new Date(currentDay.getTime()-(DAYS[period]-1)*86400000):new Date(endpoint.getTime()-DAYS[period]*86400000);
  const snapshotStart=new Date(endpoint.getTime()-DAYS[period]*86400000);
  const previous=new Date(snapshotStart.getTime()-DAYS[period]*86400000);
  let rows=all.map(repo=>{
    const latest=snapshotNear(repo.id,endpoint);
    const first=snapshotNear(repo.id,snapshotStart);
    const prev=snapshotNear(repo.id,previous);
    const currentStars=live?getStarSeries(repo.id,endpoint,DAYS[period],repo.created_at):null;
    const previousStars=live?getStarSeries(repo.id,new Date(currentDay.getTime()-DAYS[period]*86400000),DAYS[period],repo.created_at):null;
    const gain=live?(currentStars.complete?currentStars.points.reduce((sum,p)=>sum+p.count,0):null):latest&&first?latest.stars-first.stars:null;
    const forkGain=latest&&first?latest.forks-first.forks:null;
    const prevGain=live?(previousStars.complete?previousStars.points.reduce((sum,p)=>sum+p.count,0):null):first&&prev?first.stars-prev.stars:null;
    const anomaly=gain!==null&&prevGain!==null&&gain>Math.max(100,prevGain*3);
    const ageDays=Math.max(0,(endpoint-new Date(repo.created_at))/86400000);
    const pushDays=Math.max(0,(endpoint-new Date(repo.pushed_at))/86400000);
    return {...repo,topics:JSON.parse(repo.topics||'[]'),sampledAt:latest?.sampled_at||null,gain,forkGain,prevGain,anomaly,ageDays,pushDays,aiEvidence:aiEvidence(repo)};
  });
  rows=rows.filter(r=>!language||r.language?.toLowerCase()===language.toLowerCase()).filter(r=>!topic||r.topics.some(t=>t.toLowerCase().includes(topic.toLowerCase()))).filter(r=>!q||`${r.full_name} ${r.description} ${r.topics.join(' ')}`.toLowerCase().includes(q.toLowerCase())).filter(r=>!age||r.ageDays<=Number(age));
  if(board==='new') rows=rows.filter(r=>r.ageDays<=90&&r.stars>=20);
  if(board==='ai') rows=rows.filter(r=>r.aiEvidence.length>0);
  const valid=rows.filter(r=>r.gain!==null&&!r.anomaly);
  const starVals=valid.map(r=>Math.log1p(Math.max(0,r.gain)));
  const rateVals=valid.map(r=>Math.max(0,r.gain)/(Math.max(0,r.stars-r.gain)+100));
  const forkReady=valid.length>0&&valid.every(r=>r.forkGain!==null);
  const forkVals=forkReady?valid.map(r=>Math.log1p(Math.max(0,r.forkGain))):[];
  rows=rows.map(r=>{
    if(r.gain===null||r.anomaly) return {...r,score:null};
    const star=percentile(starVals,Math.log1p(Math.max(0,r.gain)));
    const rate=percentile(rateVals,Math.max(0,r.gain)/(Math.max(0,r.stars-r.gain)+100));
    const fork=forkReady?percentile(forkVals,Math.log1p(Math.max(0,r.forkGain))):0;
    const push=Math.max(0,100-r.pushDays*8);
    return {...r,score:Math.round((0.45*star+0.2*rate+(forkReady?0.15*fork:0)+0.2*push)/(forkReady?1:0.85))};
  });
  const key=boards[board].metric;
  const candidateCount=rows.length;
  if(key==='score') rows=rows.filter(r=>r.score!==null);
  if(key==='gain') rows=rows.filter(r=>r.gain!==null&&!r.anomaly);
  rows.sort((a,b)=>(b[key]??-1)-(a[key]??-1)||b.stars-a.stars);
  const count=rows.length;
  const safePage=Math.max(1,Math.min(1000,Number(page)||1));
  const safeLimit=Math.max(1,Math.min(50,Number(limit)||10));
  rows=rows.slice((safePage-1)*safeLimit,safePage*safeLimit).map((r,i)=>({...r,rank:(safePage-1)*safeLimit+i+1,url:`https://github.com/${r.full_name}`}));
  return {board,period,items:rows,total:count,page:safePage,limit:safeLimit,dataInsufficient:candidateCount>0&&count===0,updatedAt:latestTime,stale:!latestTime||Date.now()-new Date(latestTime).getTime()>36*3600000,windowStart:start.toISOString(),timezone:live?'GitHub calendar days':'UTC',source:source==='demo'?'demo':'GitHub REST API',sample:!live,growthBasis:live?'star_created':'snapshot_net',forkComponent:forkReady,coverage:all.length?Math.round(100*valid.length/all.length):0};
}
