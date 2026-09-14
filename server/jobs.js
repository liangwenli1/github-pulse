import 'dotenv/config';
import crypto from 'node:crypto';
import { db } from './db.js';
import { sendMail, buildDigest } from './mail.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const token=()=>crypto.randomBytes(24).toString('hex');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');

async function github(url,version='2022-11-28') {
  const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':version,'User-Agent':'github-pulse'};
  if(process.env.GITHUB_TOKEN) headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  for(let attempt=0;attempt<3;attempt++) {
    const response=await fetch(url,{headers});
    if(response.ok) return response.json();
    if(response.status===403||response.status===429) {
      const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
      if(reset>Date.now()+60000) throw new Error('GitHub rate limit reached; retry after reset');
    }
    if(![403,429,500,502,503,504].includes(response.status)||attempt===2) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
    await sleep(1000*2**attempt);
  }
}

export async function syncStarHistory(repositories) {
  if((process.env.DATA_MODE||'demo')!=='live') throw new Error('Set DATA_MODE=live to collect GitHub history');
  const repos=repositories||db.prepare("SELECT id,full_name FROM repos WHERE source='github' AND deleted=0 AND archived=0 ORDER BY stars DESC").all();
  const save=db.prepare('INSERT OR REPLACE INTO star_history (repo_id,week_start,total,days_json,sampled_at) VALUES (?,?,?,?,?)');
  let sampled=0,failed=0,consecutiveFailures=0;
  const at=new Date().toISOString();
  for(const repo of repos) {
    try {
      const weeks=await github(`https://api.github.com/repos/${repo.full_name}/stargazers/history?per_page=12`,'2026-03-10');
      if(!Array.isArray(weeks)||!weeks.length) throw new Error('Empty star history');
      db.exec('BEGIN');
      try {
        for(const week of weeks) {
          if(!Number.isInteger(week.week)||!Array.isArray(week.days)||week.days.length!==7) continue;
          save.run(repo.id,week.week,Number(week.total)||0,JSON.stringify(week.days),at);
        }
        db.exec('COMMIT');
      } catch(e) {db.exec('ROLLBACK');throw e;}
      sampled++;consecutiveFailures=0;
    } catch(e) {
      failed++;consecutiveFailures++;
      if(consecutiveFailures>=5) throw new Error(`Star history stopped after 5 consecutive failures: ${e}`);
    }
    await sleep(180);
  }
  return {sampled,failed};
}

export async function collect() {
  if((process.env.DATA_MODE||'demo')!=='live') throw new Error('Set DATA_MODE=live to collect GitHub data');
  const started=new Date().toISOString();
  const run=db.prepare('INSERT INTO sync_runs (started_at,status) VALUES (?,?)').run(started,'running');
  let found=0,sampled=0;
  try {
    const dateBefore=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
    const queries=[`stars:>200 pushed:>${dateBefore(180)} archived:false`,'topic:ai stars:>100 archived:false',`created:>${dateBefore(90)} stars:>20 archived:false`];
    const unique=new Map();
    for(const q of queries) {
      const body=await github(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=50`);
      for(const repo of body.items||[]) unique.set(repo.id,repo);
      await sleep(1200);
    }
    // Refresh known repositories even when they have fallen out of discovery searches.
    // Immutable IDs retain history through renames; 404s mark removed/private repos.
    const known=db.prepare("SELECT id,full_name FROM repos WHERE source='github' AND deleted=0 ORDER BY updated_at ASC LIMIT ?").all(process.env.GITHUB_TOKEN?150:40);
    for(const repo of known) {
      if(unique.has(repo.id)) continue;
      try {
        const fresh=await github(`https://api.github.com/repos/${repo.full_name}`);
        unique.set(fresh.id,fresh);
      } catch(e) {
        if(String(e).startsWith('Error: GitHub 404')) db.prepare('UPDATE repos SET deleted=1 WHERE id=?').run(repo.id);
        else throw e;
      }
      await sleep(150);
    }
    found=unique.size;
    const upsert=db.prepare(`INSERT INTO repos (id,full_name,description,language,topics,stars,forks,created_at,pushed_at,updated_at,archived,deleted,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,description=excluded.description,language=excluded.language,topics=excluded.topics,stars=excluded.stars,forks=excluded.forks,pushed_at=excluded.pushed_at,updated_at=excluded.updated_at,archived=excluded.archived,deleted=0,source='github'`);
    const snap=db.prepare('INSERT OR REPLACE INTO snapshots (repo_id,sampled_at,stars,forks,source) VALUES (?,?,?,?,?)');
    const at=new Date().toISOString();
    db.exec('BEGIN');
    try {
      for(const repo of unique.values()) {
        upsert.run(repo.id,repo.full_name,repo.description||'',repo.language||'',JSON.stringify(repo.topics||[]),repo.stargazers_count,repo.forks_count,repo.created_at,repo.pushed_at,repo.updated_at,repo.archived?1:0,0,'github');
        snap.run(repo.id,at,repo.stargazers_count,repo.forks_count,'github'); sampled++;
      }
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    const history=await syncStarHistory([...unique.values()].map(r=>({id:r.id,full_name:r.full_name})));
    db.prepare('UPDATE sync_runs SET finished_at=?,status=?,found=?,sampled=?,error=? WHERE id=?').run(new Date().toISOString(),'ok',found,sampled,history.failed?`${history.failed} star histories unavailable`:null,run.lastInsertRowid);
    return {found,sampled,history};
  } catch(e) {
    db.prepare('UPDATE sync_runs SET finished_at=?,status=?,found=?,sampled=?,error=? WHERE id=?').run(new Date().toISOString(),'failed',found,sampled,String(e),run.lastInsertRowid);
    throw e;
  }
}

function localParts(time,zone) {
  const f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
  const p=Object.fromEntries(f.formatToParts(time).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
}

export async function digest({force=false}={}) {
  const now=new Date();
  const last=db.prepare("SELECT MAX(sampled_at) t FROM snapshots WHERE source='github'").get().t;
  if((process.env.DATA_MODE||'demo')==='live' && (!last||now-new Date(last)>36*3600000)) throw new Error('Fresh ranking data unavailable; digest skipped');
  const subs=db.prepare("SELECT * FROM subscriptions WHERE status='active'").all();
  let sent=0,failed=0;
  for(const sub of subs) {
    const {date,hour}=localParts(now,sub.timezone);
    if(!force&&hour<sub.send_hour) continue;
    const existing=db.prepare('SELECT * FROM deliveries WHERE subscription_id=? AND local_date=?').get(sub.id,date);
    if(existing?.status==='sent'||existing?.status==='sending'||(existing?.status==='failed'&&existing.attempts>=3)) continue;
    if(!existing) db.prepare('INSERT INTO deliveries (subscription_id,local_date,status) VALUES (?,?,?)').run(sub.id,date,'pending');
    const delivery=db.prepare('SELECT * FROM deliveries WHERE subscription_id=? AND local_date=?').get(sub.id,date);
    const claim=db.prepare("UPDATE deliveries SET status='sending',attempts=attempts+1 WHERE id=? AND status IN ('pending','failed')").run(delivery.id);
    if(!claim.changes) continue;
    try {
      const manageToken=db.prepare('SELECT manage_hash FROM subscriptions WHERE id=?').get(sub.id).manage_hash;
      // The raw management token is encrypted at rest with the server-side ADMIN_TOKEN.
      const raw=decryptManageToken(manageToken);
      const mail=buildDigest(sub,raw);
      await sendMail(sub.email,mail.subject,mail.text,mail.html,{'List-Unsubscribe':`<${mail.oneClick}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},`digest/${delivery.id}`);
      db.prepare('UPDATE deliveries SET status=?,sent_at=?,last_error=NULL WHERE id=?').run('sent',now.toISOString(),delivery.id); sent++;
    } catch(e) {
      db.prepare('UPDATE deliveries SET status=?,last_error=? WHERE id=?').run('failed',String(e),delivery.id); failed++;
    }
  }
  return {sent,failed};
}

const key=crypto.createHash('sha256').update(process.env.ADMIN_TOKEN||'local-demo-only-key').digest();
export function encryptManageToken(raw) {
  const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([c.update(raw,'utf8'),c.final()]);
  return Buffer.concat([iv,c.getAuthTag(),encrypted]).toString('base64');
}
export function decryptManageToken(saved) {
  const b=Buffer.from(saved,'base64'),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));
  d.setAuthTag(b.subarray(12,28));
  return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');
}
export {token,hash};

if(process.argv[1]?.endsWith('jobs.js')) {
  const task=process.argv[2];
  (task==='collect'?collect():task==='history'?syncStarHistory():task==='digest'?digest({force:process.argv.includes('--force')}):Promise.reject(new Error('Use collect, history or digest'))).then(x=>console.log(x)).catch(e=>{console.error(e);process.exitCode=1;});
}
