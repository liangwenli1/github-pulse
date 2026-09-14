import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { getRankings, getStarSeries, boards, aiEvidence } from './rankings.js';
import { mailReady, sendVerification } from './mail.js';
import { collect, digest, encryptManageToken, decryptManageToken, token, hash } from './jobs.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'20kb'}));
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const demo=(process.env.DATA_MODE||'demo')==='demo';
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validZone=z=>{try{new Intl.DateTimeFormat('en',{timeZone:z});return true;}catch{return false;}};
const fail=(res,status,message)=>res.status(status).json({error:message});
const bursts=new Map();
function rate(req,res,next) {
  const key=req.ip||'local',now=Date.now(),value=bursts.get(key)||[];
  const recent=value.filter(t=>now-t<3600000);
  if(recent.length>=12) return fail(res,429,'Too many requests. Try again later.');
  recent.push(now);bursts.set(key,recent);next();
}
function manageSub(raw) {
  if(typeof raw!=='string'||!raw.includes('.')) return null;
  const id=raw.split('.')[0];
  const sub=db.prepare('SELECT * FROM subscriptions WHERE id=?').get(id);
  if(!sub) return null;
  try {
    const stored=decryptManageToken(sub.manage_hash);
    return stored.length===raw.length&&crypto.timingSafeEqual(Buffer.from(stored),Buffer.from(raw))?sub:null;
  }catch{return null;}
}

app.get('/api/health',(_req,res)=>res.json({ok:true,mode:demo?'demo':'live'}));
app.get('/api/boards',(_req,res)=>res.json({boards,mode:demo?'demo':'live'}));
app.get('/api/rankings',(req,res)=>res.json({...getRankings(req.query),mailReady:demo||mailReady()}));
app.get('/api/chart',(req,res)=>{
  const ranking=getRankings({...req.query,limit:5,page:1});
  const sample=getRankings({...req.query,limit:50,page:1});
  const languageCounts=new Map();
  for(const item of sample.items) {
    const language=item.language||'Other';
    languageCounts.set(language,(languageCounts.get(language)||0)+1);
  }
  const sortedLanguages=[...languageCounts].sort((a,b)=>b[1]-a[1]);
  const languages=sortedLanguages.slice(0,5).map(([name,count])=>({name,count}));
  const remainder=sortedLanguages.slice(5).reduce((sum,[,count])=>sum+count,0);
  if(remainder) languages.push({name:'Other',count:remainder});
  const source=demo?'demo':'github';
  const start=new Date(ranking.windowStart).getTime();
  const end=ranking.updatedAt?new Date(ranking.updatedAt).getTime():Date.now();
  let metric='gain';
  let bars=ranking.items.filter(r=>r.gain!==null&&!r.anomaly).map(r=>({id:r.id,name:r.full_name,value:r.gain,rank:r.rank}));
  if(!bars.length && (ranking.board==='stars'||ranking.board==='forks')) {
    metric=ranking.board;
    bars=ranking.items.map(r=>({id:r.id,name:r.full_name,value:r[metric],rank:r.rank}));
  }
  const leader=metric==='gain'?bars[0]||null:null;
  let points=[];
  if(leader) {
    const days={day:1,week:7,month:30}[ranking.period];
    if(ranking.growthBasis==='star_created') {
      const repo=db.prepare('SELECT created_at FROM repos WHERE id=?').get(leader.id);
      const series=getStarSeries(leader.id,new Date(ranking.updatedAt),days,repo?.created_at);
      if(series.complete) {
        let cumulative=0;
        points=[{date:new Date(Date.parse(series.points[0].date+'T00:00:00Z')-86400000).toISOString().slice(0,10),gain:0},...series.points.map(p=>({date:p.date,gain:cumulative+=p.count}))];
      }
    } else {
      const first=db.prepare("SELECT stars,sampled_at FROM snapshots WHERE repo_id=? AND source=? ORDER BY ABS(strftime('%s',sampled_at)-strftime('%s',?)) LIMIT 1").get(leader.id,source,ranking.windowStart);
      if(first&&Math.abs(new Date(first.sampled_at).getTime()-start)<=6*3600000) {
        const snapshots=db.prepare('SELECT sampled_at,stars FROM snapshots WHERE repo_id=? AND source=? AND sampled_at>=? AND sampled_at<=? ORDER BY sampled_at').all(leader.id,source,new Date(start-6*3600000).toISOString(),new Date(end+6*3600000).toISOString());
        points=Array.from({length:days+1},(_,i)=>{
          const date=new Date(start+i*86400000).toISOString().slice(0,10);
          const snapshot=snapshots.find(x=>x.sampled_at.slice(0,10)===date);
          return {date,gain:snapshot?snapshot.stars-first.stars:null};
        });
      }
    }
  }
  res.json({board:ranking.board,period:ranking.period,source:ranking.source,growthBasis:ranking.growthBasis,updatedAt:ranking.updatedAt,leader:leader?.name||null,metric,bars,points,languages,languageSampleCount:sample.items.length,insufficient:points.filter(x=>x.gain!==null).length<2});
});
app.get('/api/repos/:id',(req,res)=>{
  const repo=db.prepare('SELECT * FROM repos WHERE id=? OR full_name=?').get(Number(req.params.id)||-1,req.params.id);
  if(!repo) return fail(res,404,'Repository not found');
  const snapshots=db.prepare('SELECT sampled_at,stars,forks FROM snapshots WHERE repo_id=? ORDER BY sampled_at DESC LIMIT 31').all(repo.id).reverse();
  res.json({...repo,topics:JSON.parse(repo.topics),aiEvidence:aiEvidence(repo),snapshots,url:`https://github.com/${repo.full_name}`,mode:demo?'demo':'live'});
});
app.post('/api/ai-report',rate,(req,res)=>{
  const id=Number(req.body.repoId),reason=String(req.body.reason||'misclassified').slice(0,300);
  if(!db.prepare('SELECT id FROM repos WHERE id=?').get(id)) return fail(res,404,'Repository not found');
  db.prepare('INSERT INTO classification_reports (repo_id,reason,created_at) VALUES (?,?,?)').run(id,reason,new Date().toISOString());
  res.json({ok:true});
});
app.post('/api/subscriptions',rate,async(req,res)=>{
  const b=req.body||{},email=String(b.email||'').trim().toLowerCase(),locale=b.locale==='en'?'en':'zh';
  const selected=Array.isArray(b.boards)?[...new Set(b.boards.filter(x=>boards[x]))]:[];
  const hour=Number(b.sendHour),zone=String(b.timezone||'');
  if(!emailRe.test(email)||email.length>254) return fail(res,400,'Invalid email address');
  if(!selected.length) return fail(res,400,'Select at least one board');
  if(!Number.isInteger(hour)||hour<0||hour>23||!validZone(zone)) return fail(res,400,'Invalid time or timezone');
  const id=crypto.randomUUID(),verify=token(),manage=`${id}.${token()}`;
  const existing=db.prepare('SELECT id FROM subscriptions WHERE email=?').get(email);
  if(existing) return fail(res,409,'This email already has a subscription. Use your management link.');
  const sub={id,email,locale,boards:JSON.stringify(selected),language:String(b.language||'').slice(0,50),topic:String(b.topic||'').slice(0,50),send_hour:hour,timezone:zone,status:'pending'};
  db.prepare('INSERT INTO subscriptions (id,email,locale,boards,language,topic,send_hour,timezone,status,verify_hash,manage_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,email,locale,sub.boards,sub.language,sub.topic,hour,zone,'pending',hash(verify),encryptManageToken(manage),new Date().toISOString());
  try {await sendVerification(sub,`${id}.${verify}`);res.status(201).json({ok:true,message:'Verification email sent'});} catch(e) {db.prepare('DELETE FROM subscriptions WHERE id=?').run(id);fail(res,503,'Mail delivery failed. Check email provider configuration.');}
});
app.post('/api/verify',(req,res)=>{
  const value=String(req.body.token||''),[id,secret]=value.split('.');
  const sub=db.prepare('SELECT * FROM subscriptions WHERE id=?').get(id);
  if(!sub||!secret||sub.verify_hash!==hash(secret)) return fail(res,400,'Invalid verification link');
  db.prepare("UPDATE subscriptions SET status='active',verify_hash=NULL,verified_at=? WHERE id=?").run(new Date().toISOString(),id);
  res.json({ok:true,locale:sub.locale});
});
app.get('/api/manage',(req,res)=>{
  const sub=manageSub(req.query.token);
  if(!sub) return fail(res,403,'Invalid management link');
  res.json({email:sub.email,locale:sub.locale,boards:JSON.parse(sub.boards),language:sub.language,topic:sub.topic,sendHour:sub.send_hour,timezone:sub.timezone,status:sub.status});
});
app.patch('/api/manage',(req,res)=>{
  const sub=manageSub(req.body.token);
  if(!sub) return fail(res,403,'Invalid management link');
  const b=req.body,selected=Array.isArray(b.boards)?[...new Set(b.boards.filter(x=>boards[x]))]:JSON.parse(sub.boards);
  const hour=b.sendHour===undefined?sub.send_hour:Number(b.sendHour),zone=b.timezone===undefined?sub.timezone:String(b.timezone);
  if(!selected.length||!Number.isInteger(hour)||hour<0||hour>23||!validZone(zone)) return fail(res,400,'Invalid settings');
  const status=['active','paused','cancelled'].includes(b.status)?b.status:sub.status;
  if(sub.status==='cancelled'&&status!=='cancelled') return fail(res,409,'Cancelled subscription cannot be resumed');
  db.prepare('UPDATE subscriptions SET locale=?,boards=?,language=?,topic=?,send_hour=?,timezone=?,status=? WHERE id=?').run(b.locale==='en'?'en':b.locale==='zh'?'zh':sub.locale,JSON.stringify(selected),String(b.language??sub.language).slice(0,50),String(b.topic??sub.topic).slice(0,50),hour,zone,status,sub.id);
  res.json({ok:true,status});
});
app.post('/api/unsubscribe',(req,res)=>{
  const sub=manageSub(req.body.token);
  if(!sub) return fail(res,403,'Invalid unsubscribe link');
  db.prepare("UPDATE subscriptions SET status='cancelled' WHERE id=?").run(sub.id);
  res.json({ok:true});
});
app.post('/api/one-click',(req,res)=>{
  const sub=manageSub(req.query.token);
  if(!sub) return fail(res,403,'Invalid unsubscribe link');
  db.prepare("UPDATE subscriptions SET status='cancelled' WHERE id=?").run(sub.id);
  res.type('text/plain').send('Unsubscribed');
});
if(demo) app.get('/api/demo-outbox',(_req,res)=>res.json(db.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 30').all()));
function admin(req,res,next) {
  if(!process.env.ADMIN_TOKEN||req.get('authorization')!==`Bearer ${process.env.ADMIN_TOKEN}`) return fail(res,403,'Admin token required');
  next();
}
app.get('/api/admin',admin,(_req,res)=>res.json({runs:db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 30').all(),deliveries:db.prepare('SELECT * FROM deliveries ORDER BY id DESC LIMIT 30').all(),reports:db.prepare('SELECT * FROM classification_reports ORDER BY id DESC LIMIT 30').all()}));
app.post('/api/admin/collect',admin,async(_req,res)=>{try{res.json(await collect());}catch(e){fail(res,503,String(e));}});
app.post('/api/admin/digest',admin,async(_req,res)=>{try{res.json(await digest());}catch(e){fail(res,503,String(e));}});

const here=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(here,'../dist');
app.use(express.static(dist));
app.get('/{*path}',(req,res)=>{
  const htmlPath=path.join(dist,'index.html');
  if(!fs.existsSync(htmlPath)) return fail(res,503,'Frontend build missing. Run npm run build or use npm run dev.');
  const locale=req.path.startsWith('/zh')?'zh':'en';
  const title=locale==='zh'?'GitHub Pulse · 开源项目发现':'GitHub Pulse · Open-source discovery';
  const description=locale==='zh'?'用透明的数据口径，发现增长、热度与值得追踪的开源项目。':'Discover open-source momentum, classics and newcomers through transparent signals.';
  const root=(process.env.PUBLIC_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
  const suffix=req.path.replace(/^\/(zh|en)/,'');
  let html=fs.readFileSync(htmlPath,'utf8').replace('<html>','<html lang="'+locale+'">').replace('<title>GitHub Pulse</title>',`<title>${title}</title><meta name="description" content="${description}"/><link rel="alternate" hreflang="zh" href="${root}/zh${suffix}"/><link rel="alternate" hreflang="en" href="${root}/en${suffix}"/><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'GitHub Pulse',url:root,inLanguage:['zh-CN','en']})}</script>`);
  res.type('html').send(html);
});
const port=Number(process.env.PORT||3001);
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) app.listen(port,()=>console.log(`GitHub Pulse API at http://localhost:${port} (${demo?'DEMO':'LIVE'})`));
export {app};
