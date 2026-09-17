const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = {};
for (const modulePath of ['../src/config/database', '../src/middleware/auth']) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports: { prisma } };
}

test('AI rejects provider credentials, quota, empty responses and timeout with useful errors',async t=>{
  Object.assign(require('../src/config/env').ai, { apiKey: 'fixture-key', baseUrl: 'https://ai.example.invalid/v1', model: 'fixture-model' });
  const ai = require('../src/services/ai.service');
  const messages = [{ role: 'user', content: 'How many interns are registered?' }];
  const fetchMock=t.mock.method(global,'fetch',async()=>({ok:false,status:401}));
  await assert.rejects(ai.chat(messages),{statusCode:503,message:/credentials/});
  fetchMock.mock.mockImplementation(async()=>({ok:false,status:429}));
  await assert.rejects(ai.chat(messages),{statusCode:429});
  fetchMock.mock.mockImplementation(async()=>({ok:true,json:async()=>({choices:[]})}));
  await assert.rejects(ai.chat(messages),{statusCode:502});
  fetchMock.mock.mockImplementation(async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});});
  await assert.rejects(ai.chat(messages),{statusCode:504});
});

test('logbook validates before upload and removes uploaded file if database save fails',async t=>{
  const storage=require('../src/services/storage.service');
  const logbook=require('../src/services/logbook.service');
  const controller=require('../src/controllers/logbook.controller');
  let uploads=0,deletes=0;
  t.mock.method(storage,'uploadFile',async()=>{uploads++;return 'fixture://file';});
  t.mock.method(storage,'deleteFile',async url=>{assert.equal(url,'fixture://file');deletes++;});
  t.mock.method(logbook,'addTask',async()=>{throw new Error('database failure');});
  const req={body:{timeStart:'11:00',timeEnd:'10:00',activity:'Fixture'},params:{entryId:'a'},file:{}};
  let failure;
  await controller.addTask(req,{},err=>{failure=err;});
  assert.equal(failure.statusCode,400);assert.equal(uploads,0);
  req.body.timeEnd='12:00';
  await controller.addTask(req,{},err=>{failure=err;});
  assert.equal(failure.message,'database failure');assert.equal(uploads,1);assert.equal(deletes,1);
});

test('upload signature rejects disguised files and accepts supported headers',()=>{
  const {matchesSignature}=require('../src/middleware/upload');
  assert.equal(matchesSignature({mimetype:'image/png',buffer:Buffer.from('<script>bad</script>')}),false);
  assert.equal(matchesSignature({mimetype:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])}),true);
  assert.equal(matchesSignature({mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7')}),true);
  assert.equal(matchesSignature({mimetype:'image/jpeg',buffer:Buffer.from('%PDF-1.7')}),false);
});
