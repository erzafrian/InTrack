// Isolated audit: synthetic credentials, in-memory DB/storage/integration stubs.
// No production database or provider requests. Run: node docs/function-audit.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const resolve = p => require.resolve(path.join(root, 'server/src', p));
const inject = (p, exports) => { require.cache[resolve(p)] = { id: resolve(p), filename: resolve(p), loaded: true, exports }; };
inject('config/env', {port:3001,clientUrl:'http://localhost:5173',jwt:{secret:'audit-only-not-a-real-secret',expiresIn:'15m',refreshExpiresIn:'7d'},s3:{},google:{},notion:{},office:{latitude:-6.2,longitude:106.8},ai:{},faceService:{baseUrl:'http://unused.invalid'}});
const auth = require(resolve('middleware/auth'));
const calls=[];
const model = name => Object.fromEntries(['findUnique','findFirst','findMany','create','update','upsert','delete','deleteMany','count'].map(method => [method,async args=>{
 calls.push({name,method,args});
 if(method==='findMany')return [];
 if(method==='count')return 0;
 if(name==='appSetting')return {key:'reopened',value:'true'};
 if(name==='user')return {id:'other-user',name:'Synthetic User',faceEnrolled:false};
 return {id:'other-record',userId:'other-user',date:new Date('2026-09-01T12:00:00Z'),status:'HADIR',...args?.data};
}]));
auth.prisma=Object.fromEntries(['user','attendance','attendanceEvidence','logbookEntry','logbookTask','plannerEvent','appSetting','faceEmbedding','chatRoom','chatMessage','externalSync'].map(n=>[n,model(n)]));
inject('services/r2.service',{uploadFile:async()=> 'https://files.example.test/evidence.png'});
inject('services/notion.service',{getAuthUrl:()=>'',exchangeCode:async()=>({}),syncAttendanceToNotion:async(...args)=>{calls.push({name:'notionSync',args});}});
const jwt=require(path.join(root,'server/node_modules/jsonwebtoken'));
const app=require(resolve('app'));
const results=[];
(async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(url,role,method='GET',body){
  const headers={};if(role)headers.Cookie='accessToken='+jwt.sign({id:'audit-user',role},'audit-only-not-a-real-secret');
  if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
  const res=await fetch(base+url,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,redirect:'manual'});
  let data;try{data=await res.json();}catch{data=null;}return {status:res.status,data};
 }
 try {
  for(const url of ['/api/auth/me','/api/attendance','/api/logbook','/api/planner/events','/api/users','/api/admin/settings','/api/face/status','/api/google/status']){
   const r=await request(url);results.push({check:'Unauthenticated '+url,expected:401,actual:r.status,passed:r.status===401});
  }
  for(const url of ['/api/admin/settings','/api/users','/api/admin/mentor/chat-rooms']){
   const r=await request(url,'INTERN');results.push({check:'Intern role denied '+url,expected:403,actual:r.status,passed:r.status===403});
  }
  const foreign=await request('/api/attendance/other-record','INTERN');
  results.push({check:'Foreign attendance must be denied',expected:'403 or 404',actual:foreign.status,passed:[403,404].includes(foreign.status)});
  const task=await request('/api/logbook/tasks/other-record','INTERN','DELETE');
  results.push({check:'Foreign logbook task deletion must be denied',expected:'403 or 404',actual:task.status,passed:[403,404].includes(task.status)});
  const planner=await request('/api/planner/events/other-record','INTERN','DELETE');
  results.push({check:'Foreign planner deletion denied',expected:404,actual:planner.status,passed:planner.status===404});
  const form=new FormData();for(const [k,v] of Object.entries({date:'2026-09-01',status:'HADIR',latitude:'-6.2',longitude:'106.8'}))form.append(k,v);
  form.append('evidence',new Blob(['synthetic'],{type:'image/png'}),'audit.png');
  const submit=await request('/api/attendance','INTERN','POST',form);
  results.push({check:'Attendance without face verification must be denied (reopened synthetic date)',expected:'4xx',actual:submit.status,passed:submit.status>=400&&submit.status<500});
  const face=await request('/api/face/status','INTERN');
  results.push({check:'Face photo requirement matches enrollment threshold',expected:15,actual:face.data?.data?.required,passed:face.data?.data?.required===15});
  const sync=calls.find(c=>c.name==='notionSync');
  results.push({check:'Notion receives user name on first-login access token',expected:'user name',actual:sync?.args[2]??null,passed:typeof sync?.args[2]==='string'});
  const health=await request('/api/health');results.push({check:'API health',expected:200,actual:health.status,passed:health.status===200});
 } finally {server.close();await auth.prisma.$disconnect?.();}
 const report={date:'2026-09-15',mode:'isolated synthetic HTTP audit; no live DB/provider calls',results};
 fs.writeFileSync(path.join(__dirname,'function-audit-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1});
