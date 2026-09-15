// Explicitly invoked live audit. Creates disposable users/data and removes them.
// Requires AUDIT_ADMIN_EMAIL/PASSWORD. Never prints credentials or user content.
require('../server/src/config/env');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PrismaClient } = require('../server/node_modules/@prisma/client');
const { S3Client, DeleteObjectCommand } = require('../server/node_modules/@aws-sdk/client-s3');
const config = require('../server/src/config/env');
const db = new PrismaClient();
const base = 'http://localhost:5173/api';
const tag = `audit-${crypto.randomUUID()}`;
const password = crypto.randomBytes(24).toString('hex');
const results = [], users = [], objectKeys = [], settingKeys = [];
let admin = '';
function record(check, passed, detail) { results.push({ check, passed, detail }); }
async function request(url, cookie = '', method = 'GET', body) {
  const headers = cookie ? { Cookie: cookie } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + url, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data: data.data, cookie: r.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
}
function status(check, response, expected = 200) { record(check, response.status === expected, { status: response.status, expected }); }
async function createUser(suffix, role) {
  const email = `${tag}-${suffix}@example.invalid`;
  const r = await request('/users', admin, 'POST', { email, password, role, name: `Temporary audit ${suffix}` });
  status(`Create ${suffix}`, r, 201);
  if (!r.data?.id) throw new Error('Test user creation failed');
  users.push(r.data.id);
  const login = await request('/auth/login', '', 'POST', { email, password });
  status(`Login ${suffix}`, login);
  return { id: r.data.id, cookie: login.cookie, email };
}
async function main() {
  if (!process.env.AUDIT_ADMIN_EMAIL || !process.env.AUDIT_ADMIN_PASSWORD) throw new Error('Audit login environment is required');
  const login = await request('/auth/login', '', 'POST', { email: process.env.AUDIT_ADMIN_EMAIL, password: process.env.AUDIT_ADMIN_PASSWORD });
  status('Admin login', login); admin = login.cookie;
  if (login.status !== 200) throw new Error('Admin login failed');
  for (const route of ['/auth/me', '/users', '/admin/settings', '/attendance', '/logbook', '/planner/events', '/admin/mentor/chat-rooms']) status(`Admin read ${route}`, await request(route, admin));
  const a = await createUser('intern-a', 'INTERN');
  const b = await createUser('intern-b', 'INTERN');
  const mentor = await createUser('mentor', 'MENTOR');
  status('Update test user', await request(`/users/${a.id}`, admin, 'PUT', { department: 'Audit department' }));
  status('Update own profile', await request('/auth/profile', a.cookie, 'PUT', { name: 'Temporary audit updated' }));
  const refreshed = await request('/auth/refresh', a.cookie, 'POST'); status('Refresh session', refreshed);
  status('Old refresh token is rejected after rotation', await request('/auth/refresh', a.cookie, 'POST'), 401);
  a.cookie = refreshed.cookie;
  const accessCookie = a.cookie.split('; ').find(v => v.startsWith('accessToken='));
  status('Access JWT must not work as refresh JWT', await request('/auth/refresh', `refreshToken=${accessCookie.slice('accessToken='.length)}`, 'POST'), 401);
  status('Intern admin access denied', await request('/admin/settings', a.cookie), 403);
  status('Mentor admin settings denied', await request('/admin/settings', mentor.cookie), 403);
  status('Unknown settings key denied', await request('/admin/settings', admin, 'PUT', {notion_token:'not-allowed'}),400);
  status('Invalid attendance time range denied', await request('/admin/settings', admin, 'PUT', {absen_start_time:'18:00',absen_end_time:'10:00'}),400);
  status('Invalid attendance filter date denied',await request('/attendance?startDate=2026-02-30',a.cookie),400);
  const entry = await request('/logbook', a.cookie, 'POST', { date: '2098-09-15' });
  status('Create logbook', entry, 201);
  record('Logbook date retained', entry.data?.date?.startsWith('2098-09-15'), {});
  const filtered = await request('/logbook?startDate=2098-09-15&endDate=2098-09-15', a.cookie);
  record('Logbook exact-date filter', filtered.data?.some(e => e.id === entry.data.id) === true, { status: filtered.status });
  const missingEvidence = await request(`/logbook/${entry.data.id}/tasks`, a.cookie, 'POST', { timeStart: '10:00', timeEnd: '11:00', quantitativeActivity: 'Synthetic audit task' });
  status('Logbook requires evidence on server', missingEvidence, 400);
  const taskForm = new FormData();
  for (const [key,value] of Object.entries({ timeStart:'10:00',timeEnd:'11:00',quantitativeActivity:'Synthetic audit task' })) taskForm.append(key,value);
  taskForm.append('evidence', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ioAAAAASUVORK5CYII=', 'base64')], {type:'image/png'}), 'audit.png');
  const task = await request(`/logbook/${entry.data.id}/tasks`, a.cookie, 'POST', taskForm);
  status('Create logbook task with evidence',task,201);
  const fakeAvatar = new FormData(); fakeAvatar.append('avatar',new Blob(['%PDF-1.7'],{type:'application/pdf'}),'fake.pdf');
  status('Avatar rejects PDF',await request('/auth/profile',a.cookie,'PUT',fakeAvatar),400);
  const fakeImage = new FormData(); fakeImage.append('avatar',new Blob(['not a png'],{type:'image/png'}),'fake.png');
  status('Avatar rejects disguised image',await request('/auth/profile',a.cookie,'PUT',fakeImage),400);
  if (task.data?.id) {
    status('Edit own task', await request(`/logbook/tasks/${task.data.id}`, a.cookie, 'PUT', { output: 'Synthetic output' }));
    status('Foreign task update denied', await request(`/logbook/tasks/${task.data.id}`, b.cookie, 'PUT', { output: 'Foreign change' }),404);
    status('Foreign task create denied', await request(`/logbook/${entry.data.id}/tasks`, b.cookie, 'POST', taskForm),404);
    const foreign = await request(`/logbook/tasks/${task.data.id}`, b.cookie, 'DELETE');
    record('Foreign task deletion denied (live)', [403,404].includes(foreign.status), { status: foreign.status });
    const retained = await db.logbookTask.findUnique({where:{id:task.data.id}});
    record('Foreign requests leave task unchanged',retained?.output==='Synthetic output'&&retained.entryId===entry.data.id,{});
  }
  const event = await request('/planner/events', a.cookie, 'POST', { title: tag, startDate: '2098-09-15T10:00:00+07:00', endDate: '2098-09-15T11:00:00+07:00', allDay: false });
  status('Create planner event', event, 201);
  const range = await request('/planner/events?startDate=2098-09-15&endDate=2098-09-15', a.cookie);
  record('Planner includes events during end date', range.data?.some(e => e.id === event.data.id) === true, { status: range.status });
  status('Foreign planner deletion denied (live)', await request(`/planner/events/${event.data.id}`, b.cookie, 'DELETE'), 404);
  status('Update planner event', await request(`/planner/events/${event.data.id}`, a.cookie, 'PUT', { title: tag + '-updated' }));
  status('Delete own planner event', await request(`/planner/events/${event.data.id}`, a.cookie, 'DELETE'));
  const invalid = await request('/planner/events', a.cookie, 'POST', { title: tag, startDate: '2098-09-16T10:00:00Z', endDate: '2098-09-15T10:00:00Z' });
  record('Planner rejects reversed date range', invalid.status >= 400 && invalid.status < 500, { status: invalid.status });
  status('Planner rejects impossible dates',await request('/planner/events',a.cookie,'POST',{title:tag,startDate:'2026-02-30T10:00',endDate:'2026-03-01T10:00'}),400);
  const room = await request('/admin/mentor/chat-rooms', mentor.cookie, 'POST', { name: tag });
  status('Create chat room', room, 201);
  status('Rename chat room', await request(`/admin/mentor/chat-rooms/${room.data.id}`, mentor.cookie, 'PUT', { name: tag + '-renamed' }));
  status('Read own chat history', await request(`/admin/mentor/chat-rooms/${room.data.id}/messages`, mentor.cookie));
  status('Other account chat history denied', await request(`/admin/mentor/chat-rooms/${room.data.id}/messages`, admin), 404);
  status('Delete chat room', await request(`/admin/mentor/chat-rooms/${room.data.id}`, mentor.cookie, 'DELETE'));
  const date = '2001-09-15'; const reopenKey = `reopen_${date}`;
  if (await db.appSetting.findUnique({ where: { key: reopenKey } })) throw new Error('Audit date already configured; refusing to overwrite');
  settingKeys.push(reopenKey);
  status('Reopen date', await request('/admin/attendance/reopen', admin, 'POST', { date }));
  const form = new FormData();
  for (const [key,value] of Object.entries({ date, status: 'HADIR', latitude: '-6.2', longitude: '106.8' })) form.append(key,value);
  form.append('evidence', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ioAAAAASUVORK5CYII=', 'base64')], {type:'image/png'}), 'audit.png');
  const unverified = await request('/attendance', a.cookie, 'POST', form);
  status('Attendance without face proof denied (live)', unverified,401);
  // Issue a fixture internally to test submission independently of a physical camera.
  const tokenService = require('../server/src/services/token.service');
  const proof = await tokenService.issue(a.id,'face',date,120000);
  const expiredProof = await tokenService.issue(a.id,'face',date,-1000);
  form.set('faceProof',expiredProof);
  status('Expired attendance proof denied',await request('/attendance',a.cookie,'POST',form),401);
  const wrongDateProof = await tokenService.issue(a.id,'face','2001-09-16',120000);
  form.set('faceProof',wrongDateProof);
  status('Proof for another date denied',await request('/attendance',a.cookie,'POST',form),401);
  form.delete('faceProof');
  form.append('faceProof',proof);
  status('Proof cannot be used by another intern',await request('/attendance', b.cookie, 'POST', form),401);
  const attendance = await request('/attendance', a.cookie, 'POST', form);
  status('Attendance accepts valid single-use proof fixture',attendance,201);
  status('Attendance proof replay denied',await request('/attendance', a.cookie, 'POST', form),401);
  if (attendance.data?.id) {
    record('Attendance date retained', attendance.data.date.startsWith(date), {});
    const own = await request(`/attendance?startDate=${date}&endDate=${date}`, a.cookie);
    record('Attendance exact-date filter', own.data?.some(e=>e.id===attendance.data.id) === true, { status: own.status });
    const foreign = await request(`/attendance/${attendance.data.id}`, b.cookie);
    record('Foreign attendance denied (live)', [403,404].includes(foreign.status), { status: foreign.status });
    status('Mentor can read unassigned intern attendance',await request(`/attendance/${attendance.data.id}`, mentor.cookie));
    const foreignEvidence = new FormData(); foreignEvidence.append('evidence', taskForm.get('evidence'), 'audit.png');
    status('Foreign attendance evidence denied',await request(`/attendance/${attendance.data.id}/evidence`,b.cookie,'POST',foreignEvidence),404);
    for (const evidence of attendance.data.evidences || []) {
      const prefix = config.s3.publicUrl.replace(/\/$/,'') + '/';
      if (evidence.fileUrl.startsWith(prefix)) objectKeys.push(evidence.fileUrl.slice(prefix.length));
      const r = await fetch(evidence.fileUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      record('Supabase uploaded evidence is readable', r.ok, { status:r.status });
    }
  }
  status('Close date', await request('/admin/attendance/reopen', admin, 'DELETE', { date }));
  const face = await request('/face/status', a.cookie); status('Face status', face);
  record('Face required count is 15', face.data?.required===15, { required: face.data?.required });
  const invalidFace = new FormData(); invalidFace.append('file', new Blob(['invalid']), 'invalid.png');
  const rejected = await fetch(config.faceService.baseUrl+'/enroll', { method:'POST', body:invalidFace, signal:AbortSignal.timeout(15000) });
  record('Face rejects invalid image', rejected.status===400, {status:rejected.status});
  for(const route of ['/google/status','/auth/notion/status']) status(`Integration status ${route}`, await request(route,a.cookie));
  for(const [route,expectedPath] of [['/google/auth-url','/api/google/callback'],['/auth/notion','/api/auth/notion/callback']]) {
    const r=await request(route,route==='/auth/notion'?admin:a.cookie);status(`Generate OAuth URL ${route}`,r);
    if(r.data?.url) { const u=new URL(r.data.url); record(`OAuth callback path ${route}`,new URL(u.searchParams.get('redirect_uri')).pathname===expectedPath,{});record(`OAuth state is not plain user ID ${route}`,u.searchParams.get('state')!==a.id,{}); }
  }
  status('Intern cannot manage shared Notion connection',await request('/auth/notion',a.cookie),403);
  status('Mentor cannot change shared Notion database',await request('/auth/notion/database',mentor.cookie,'PUT',{dataSourceId:'invalid'}),403);
  // Provider health only: no real intern context or stored conversations are sent.
  try {
    const r=await fetch(config.ai.baseUrl+'/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${config.ai.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.ai.model,messages:[{role:'user',content:'Reply with OK only.'}],max_tokens:32}),signal:AbortSignal.timeout(30000)});
    const data=await r.json();record('AI provider minimal completion',r.ok&&typeof data.choices?.[0]?.message?.content==='string',{status:r.status});
  }catch(e){record('AI provider minimal completion',false,{error:e.name});}
  status('Logout', await request('/auth/logout', a.cookie, 'POST'));
  status('Access rejected after logout',await request('/auth/me',a.cookie),401);
  status('Refresh rejected after logout',await request('/auth/refresh',a.cookie,'POST'),401);
}
async function cleanup() {
  // Capture uploads even if response handling failed after a successful storage write.
  for (const id of users) {
    const evidence = await db.attendanceEvidence.findMany({ where: { attendance: { userId: id } }, select:{fileUrl:true} });
    const taskFiles = await db.logbookTask.findMany({where:{entry:{userId:id}},select:{evidenceUrl:true}});
    evidence.push(...taskFiles.filter(t=>t.evidenceUrl).map(t=>({fileUrl:t.evidenceUrl})));
    const prefix = config.s3.publicUrl.replace(/\/$/,'')+'/';
    for (const item of evidence) if(item.fileUrl.startsWith(prefix))objectKeys.push(item.fileUrl.slice(prefix.length));
  }
  const s3=new S3Client({endpoint:config.s3.endpoint,region:config.s3.region,credentials:{accessKeyId:config.s3.accessKeyId,secretAccessKey:config.s3.secretAccessKey},forcePathStyle:true});
  try { for(const key of new Set(objectKeys))await s3.send(new DeleteObjectCommand({Bucket:config.s3.bucketName,Key:key})); } finally {s3.destroy();}
  for (const id of users) status('Delete disposable user',await request(`/users/${id}`,admin,'DELETE'));
  await db.appSetting.deleteMany({where:{key:{in:settingKeys}}});
  record('No disposable users remain',await db.user.count({where:{id:{in:users}}})===0,{});
}
(async()=>{
  try{await main();}catch(e){record('Audit execution',false,{error:e.name,code:e.code||null});}
  finally{try{await cleanup();}catch(e){record('Cleanup',false,{error:e.name,code:e.code||null});}await db.$disconnect();await require('../server/src/config/database').prisma.$disconnect();}
  const report={date:new Date().toISOString(),mode:'live API/database/storage with disposable data; minimal AI prompt; no OAuth consent or physical face test',results};
  fs.writeFileSync(path.join(__dirname,'live-function-audit-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
})();
