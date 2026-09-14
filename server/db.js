import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.env.DB_PATH || './data/pulse.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS repos (id INTEGER PRIMARY KEY, full_name TEXT NOT NULL UNIQUE, description TEXT, language TEXT, topics TEXT NOT NULL DEFAULT '[]', stars INTEGER NOT NULL, forks INTEGER NOT NULL, created_at TEXT, pushed_at TEXT, updated_at TEXT, archived INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'github');
CREATE TABLE IF NOT EXISTS snapshots (repo_id INTEGER NOT NULL, sampled_at TEXT NOT NULL, stars INTEGER NOT NULL, forks INTEGER NOT NULL, source TEXT NOT NULL, PRIMARY KEY(repo_id,sampled_at));
CREATE TABLE IF NOT EXISTS star_history (repo_id INTEGER NOT NULL, week_start INTEGER NOT NULL, total INTEGER NOT NULL, days_json TEXT NOT NULL, sampled_at TEXT NOT NULL, PRIMARY KEY(repo_id,week_start));
CREATE TABLE IF NOT EXISTS sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, found INTEGER NOT NULL DEFAULT 0, sampled INTEGER NOT NULL DEFAULT 0, error TEXT);
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, locale TEXT NOT NULL, boards TEXT NOT NULL, language TEXT, topic TEXT, send_hour INTEGER NOT NULL, timezone TEXT NOT NULL, status TEXT NOT NULL, verify_hash TEXT, manage_hash TEXT NOT NULL, created_at TEXT NOT NULL, verified_at TEXT);
CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, subscription_id TEXT NOT NULL, local_date TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, sent_at TEXT, UNIQUE(subscription_id,local_date));
CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, to_email TEXT NOT NULL, subject TEXT NOT NULL, text TEXT NOT NULL, html TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classification_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, repo_id INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);`);

const samples = [
  ['vercel/next.js','The React framework for the web.','TypeScript',['nextjs','react','web'],132400,29500,1500,230,'2023-10-23',false],
  ['microsoft/vscode','Visual Studio Code.','TypeScript',['editor','developer-tools'],178900,34900,1130,180,'2015-09-03',false],
  ['langchain-ai/langchain','Build context-aware reasoning applications.','Python',['llm','agents','ai'],104800,17200,2460,390,'2022-10-16',true],
  ['ollama/ollama','Get up and running with large language models.','Go',['llm','inference','ai'],156700,12900,3840,540,'2023-06-26',true],
  ['openai/codex','Lightweight coding agent that runs in your terminal.','Rust',['agent','coding-agent','ai'],49600,5700,3150,460,'2025-04-13',true],
  ['anthropics/claude-code','An agentic coding tool that lives in your terminal.','Shell',['agent','developer-tools','ai'],43800,3200,2700,270,'2025-02-24',true],
  ['astral-sh/uv','An extremely fast Python package and project manager.','Rust',['python','developer-tools'],74300,2200,1910,88,'2024-02-15',false],
  ['shadcn-ui/ui','Beautifully designed components that you can copy and paste.','TypeScript',['components','react','design-system'],96200,7100,2100,175,'2023-01-04',false],
  ['modelcontextprotocol/servers','Model Context Protocol servers.','TypeScript',['mcp','agents','ai'],73500,8500,3300,560,'2024-11-25',true],
  ['turborepo/turborepo','The build system optimized for JavaScript and TypeScript.','TypeScript',['monorepo','build'],29200,2100,380,60,'2021-04-18',false],
  ['browser-use/browser-use','Make websites accessible for AI agents.','Python',['agents','browser-automation','ai'],70100,8200,3660,480,'2024-10-20',true],
  ['a2a-project/A2A','An open protocol for agent-to-agent communication.','Python',['agents','protocol','ai'],18300,1900,1550,180,'2026-07-03',true]
];

export function seedDemo() {
  if (db.prepare('SELECT COUNT(*) n FROM repos').get().n) return;
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),2));
  if (base > now) base.setUTCDate(base.getUTCDate()-1);
  const addRepo = db.prepare('INSERT INTO repos (id,full_name,description,language,topics,stars,forks,created_at,pushed_at,updated_at,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const addSnap = db.prepare('INSERT INTO snapshots (repo_id,sampled_at,stars,forks,source) VALUES (?,?,?,?,?)');
  db.exec('BEGIN');
  try {
    samples.forEach((s,i) => {
      const id = i+1;
      const [name,description,language,topics,stars,forks,daily,forkDaily,created] = s;
      addRepo.run(id,name,description,language,JSON.stringify(topics),stars,forks,created+'T00:00:00Z',new Date(now.getTime()-(i%4)*86400000).toISOString(),base.toISOString(),'demo');
      const starBack=[0],forkBack=[0];
      for(let age=1;age<=32;age++) {
        const factor=0.78+0.26*Math.sin((age+i)*0.83)**2+0.15*Math.cos((age+i)*0.47);
        starBack[age]=starBack[age-1]+Math.round(daily*factor);
        forkBack[age]=forkBack[age-1]+Math.round(forkDaily*(0.8+0.2*Math.sin((age+i)*0.62)**2));
      }
      for (let age=32; age>=0; age--) {
        const at = new Date(base.getTime()-age*86400000).toISOString();
        addSnap.run(id,at,Math.max(0,stars-starBack[age]),Math.max(0,forks-forkBack[age]), 'demo');
      }
    });
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}

if ((process.env.DATA_MODE || 'demo') === 'demo') seedDemo();
