import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

process.env.DATA_MODE='live';
process.env.DB_PATH=path.resolve('../../work/mail-test-'+process.pid+'.sqlite');
process.env.RESEND_API_KEY='re_test_local';
process.env.RESEND_FROM='GitHub Pulse <team@example.com>';
const {sendMail,mailReady}=await import('./mail.js');
const {db}=await import('./db.js');

test('Resend sends both message formats, unsubscribe headers, and a stable delivery key',async()=>{
  const originalFetch=globalThis.fetch;
  let request;
  globalThis.fetch=async(url,options)=>{
    request={url,options};
    return new Response(JSON.stringify({id:'email_123'}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    assert.equal(mailReady(),true);
    await sendMail('reader@example.com','Daily digest','Plain text','<p>HTML</p>',{'List-Unsubscribe':'<https://example.com/unsubscribe>'},'digest/42');
    assert.equal(request.url,'https://api.resend.com/emails');
    assert.equal(request.options.method,'POST');
    assert.equal(request.options.headers.Authorization,'Bearer re_test_local');
    assert.equal(request.options.headers['Idempotency-Key'],'digest/42');
    assert.equal(request.options.headers['User-Agent'],'GitHubPulse/0.1.0');
    assert.deepEqual(JSON.parse(request.options.body),{from:'GitHub Pulse <team@example.com>',to:['reader@example.com'],subject:'Daily digest',text:'Plain text',html:'<p>HTML</p>',headers:{'List-Unsubscribe':'<https://example.com/unsubscribe>'}});
  } finally {globalThis.fetch=originalFetch;}
});

test('Resend rejection does not count as delivered',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Sender domain is not verified'}),{status:403,headers:{'Content-Type':'application/json'}});
  try {await assert.rejects(sendMail('reader@example.com','Verify','Text','<p>HTML</p>'),/Resend delivery failed \(403\)/);}
  finally {globalThis.fetch=originalFetch;}
});

test('demo mode records messages locally even when Resend credentials are present',async()=>{
  const originalFetch=globalThis.fetch;
  process.env.DATA_MODE='demo';
  globalThis.fetch=async()=>{throw new Error('Demo mail must stay local');};
  try {
    const before=db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
    await sendMail('reader@example.com','Demo','Text','<p>HTML</p>');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n,before+1);
  } finally {globalThis.fetch=originalFetch;process.env.DATA_MODE='live';}
});
