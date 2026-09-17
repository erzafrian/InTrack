process.env.JWT_SECRET = 'isolated-security-test-secret-not-for-deployment';
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sessions = new Map(), tokens = new Map();
const user = { id: 'intern-a', role: 'INTERN', name: 'Fixture', email: 'fixture@example.invalid', passwordHash: bcrypt.hashSync('fixture-password', 4) };
function matches(row, where) {
  return Object.entries(where).every(([key,value]) => value instanceof Object && !(value instanceof Date)
    ? (!value.gt || row[key] > value.gt) && (!value.lte || row[key] <= value.lte)
    : row[key] === value);
}
function table(rows) {
  return {
    async create({data}) { rows.set(data.id, {...data}); return data; },
    async findUnique({where}) { const row = rows.get(where.id); return row && {...row,user}; },
    async findFirst({where}) { return [...rows.values()].find(r=>matches(r,where)); },
    async deleteMany({where}) { let count=0; for(const [id,row] of rows) if(matches(row,where)) { rows.delete(id); count++; } return {count}; },
    async updateMany({where,data}) { let count=0; for(const row of rows.values()) if(matches(row,where)) {Object.assign(row,data);count++;} return {count}; },
  };
}
const prisma = { authSession: table(sessions), oneTimeToken: table(tokens), user: { async findUnique(){return user;}, async findFirst(){return user;} }, async $transaction(fn){ return fn(prisma); } };
const databasePath = require.resolve('../src/config/database');
require.cache[databasePath] = { id:databasePath, filename:databasePath, loaded:true, exports:{prisma} };
const auth = require('../src/services/auth.service');
const proof = require('../src/services/token.service');
const oauth = require('../src/services/oauth.service');
const config = require('../src/config/env');

test('access JWT cannot refresh; rotation permits only one concurrent refresh; logout revokes it', async()=>{
  const original = await auth.login(user.email,'fixture-password');
  assert.equal(original.user.passwordHash,undefined);
  await assert.rejects(auth.refresh(original.accessToken),{statusCode:401});
  const results = await Promise.allSettled([auth.refresh(original.refreshToken),auth.refresh(original.refreshToken)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(auth.refresh(original.refreshToken),{statusCode:401});
  const current = results.find(r=>r.status==='fulfilled').value;
  await auth.logout(jwt.decode(current.accessToken).sid);
  await assert.rejects(auth.refresh(current.refreshToken),{statusCode:401});
});

test('face proof rejects wrong user, date, purpose and expiry without consuming valid proof',async()=>{
  const token = await proof.issue(user.id,'face','2026-09-15',120000);
  assert.equal(tokens.has(token),false, 'raw token must not be stored');
  for(const args of [['face','2026-09-15','intern-b'],['face','2026-09-16',user.id],['oauth_google','2026-09-15',user.id]]) await assert.rejects(proof.consume(token,...args),{statusCode:401});
  assert.equal(await proof.consume(token,'face','2026-09-15',user.id),user.id);
  await assert.rejects(proof.consume(token,'face','2026-09-15',user.id),{statusCode:401});
  const expired = await proof.issue(user.id,'face','2026-09-15',-1000);
  await assert.rejects(proof.consume(expired,'face','2026-09-15',user.id),{statusCode:401});
});

test('a proof can be consumed by only one concurrent request',async()=>{
  const token = await proof.issue(user.id,'face','2026-09-15',120000);
  const results = await Promise.allSettled([proof.consume(token,'face','2026-09-15',user.id),proof.consume(token,'face','2026-09-15',user.id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});

test('OAuth state is bound to initiating browser and provider, and cannot replay',async()=>{
  const cookies = {};
  const res = { cookie(name,value){cookies[name]=value;},clearCookie(){} };
  const state = await oauth.begin({user,secure:false,headers:{}},res,'google');
  await assert.rejects(oauth.finish({headers:{},query:{state},cookies:{}},res,'google'),{statusCode:401});
  await assert.rejects(oauth.finish({headers:{},query:{state},cookies:{oauth_google:'wrong'}},res,'google'),{statusCode:401});
  await assert.rejects(oauth.finish({headers:{},query:{state},cookies:{oauth_other:cookies.oauth_google}},res,'other'),{statusCode:401});
  assert.equal(await oauth.finish({headers:{},query:{state},cookies},res,'google'),user.id);
  await assert.rejects(oauth.finish({headers:{},query:{state},cookies},res,'google'),{statusCode:401});
});

test('access middleware rejects refresh tokens and revoked sessions',async()=>{
  const {authenticate} = require('../src/middleware/auth');
  const original = await auth.login(user.email,'fixture-password');
  async function check(token) {let status;const res={status(value){status=value;return this;},json(){}};let advanced=false;await authenticate({cookies:{accessToken:token}},res,err=>{if(err)throw err;advanced=true;});return {status,advanced};}
  assert.equal((await check(original.refreshToken)).status,401);
  assert.equal((await check(original.accessToken)).advanced,true);
  await auth.logout(jwt.decode(original.accessToken).sid);
  assert.equal((await check(original.accessToken)).status,401);
  const oldToken = jwt.sign({id:user.id,role:user.role},config.jwt.secret);
  assert.equal((await check(oldToken)).status,401);
});
