import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
process.env.DATA_MODE='demo';
process.env.DB_PATH=path.resolve('../../work/pulse-test-'+process.pid+'.sqlite');
const {db}=await import('./db.js');
const {getRankings,getStarSeries}=await import('./rankings.js');
const {digest,encryptManageToken}=await import('./jobs.js');

test('rankings use boundary snapshots and expose demo provenance',()=>{
  const week=getRankings({board:'rising',period:'week'});
  assert.equal(week.source,'demo');
  assert.equal(week.sample,true);
  assert.ok(week.items.length>0);
  assert.ok(week.items[0].gain>0);
  assert.ok(week.items[0].gain>=week.items[1].gain);
  assert.equal(getRankings({board:'ai'}).items.every(x=>x.aiEvidence.length>0),true);
  assert.equal(getRankings({board:'new'}).items.every(x=>x.ageDays<=90),true);
});

test('missing snapshot pair never becomes a fabricated gain',()=>{
  db.prepare('DELETE FROM snapshots WHERE repo_id=?').run(1);
  const item=getRankings({board:'stars',limit:50}).items.find(x=>x.id===1);
  assert.equal(item.gain,null);
  assert.equal(item.score,null);
  assert.equal(getRankings({board:'rising',limit:50}).items.some(x=>x.id===1),false);
});

test('official Star history buckets require complete day coverage',()=>{
  const week=Date.parse('2026-09-06T00:00:00Z')/1000;
  db.prepare('INSERT INTO star_history (repo_id,week_start,total,days_json,sampled_at) VALUES (?,?,?,?,?)').run(999999,week,28,'[1,2,3,4,5,6,7]',new Date().toISOString());
  const end=new Date('2026-09-12T17:00:00Z');
  const complete=getStarSeries(999999,end,7,'2020-01-01T00:00:00Z');
  assert.equal(complete.complete,true);
  assert.deepEqual(complete.points.map(x=>x.count),[1,2,3,4,5,6,7]);
  assert.equal(getStarSeries(999999,end,8,'2020-01-01T00:00:00Z').complete,false);
});

test('daily digest is one combined message and is idempotent',async()=>{
  const id=crypto.randomUUID(),raw=`${id}.test-secret`;
  db.prepare('INSERT INTO subscriptions (id,email,locale,boards,language,topic,send_hour,timezone,status,manage_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,'test@example.com','en','["hot","rising"]','','',9,'UTC','active',encryptManageToken(raw),new Date().toISOString());
  const first=await digest({force:true});
  const second=await digest({force:true});
  assert.equal(first.sent,1);
  assert.equal(second.sent,0);
  const out=db.prepare('SELECT * FROM outbox WHERE to_email=?').all('test@example.com');
  assert.equal(out.length,1);
  assert.match(out[0].text,/Trending now/);
  assert.match(out[0].text,/Fastest rising/);
  assert.match(out[0].text,/unsubscribe/i);
  assert.equal(db.prepare('SELECT status FROM deliveries WHERE subscription_id=?').get(id).status,'sent');
});
