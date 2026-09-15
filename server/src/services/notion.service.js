const config = require('../config/env');
const { prisma } = require('../config/database');
const crypto = require('crypto');
const { badRequest } = require('../utils/validation');
const VERSION = '2025-09-03';
async function read(key) { return (await prisma.appSetting.findUnique({ where: { key } }))?.value || ''; }
function write(key, value) { return prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } }); }
function getAuthUrl(state) {
  return 'https://api.notion.com/v1/oauth/authorize?' + new URLSearchParams({ client_id: config.notion.clientId, response_type: 'code', owner: 'user', redirect_uri: config.notion.redirectUri, state });
}
async function exchangeCode(code) {
  const res = await fetch('https://api.notion.com/v1/oauth/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(config.notion.clientId + ':' + config.notion.clientSecret).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: config.notion.redirectUri }), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw Object.assign(new Error('Notion authorization failed. Reconnect from Settings.'), { statusCode: 502 });
  return res.json();
}
async function saveConnection(data) {
  if (!data.access_token) throw badRequest('Notion did not return an access token');
  await prisma.$transaction([write('notion_token', data.access_token), write('notion_refresh', data.refresh_token || ''), write('notion_data_source', '')]);
}
async function disconnect() { await prisma.appSetting.deleteMany({ where: { key: { in: ['notion_token','notion_refresh','notion_data_source'] } } }); }
async function status() { return { connected: !!await read('notion_token'), hasDatabaseId: !!await read('notion_data_source'), dataSourceId: await read('notion_data_source') }; }
async function request(endpoint, method = 'GET', body, retry = true) {
  const token = await read('notion_token');
  if (!token) throw badRequest('Connect Notion in Settings first.');
  const res = await fetch('https://api.notion.com/v1' + endpoint, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Notion-Version': VERSION }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  if (res.status === 401 && retry) {
    const refresh = await read('notion_refresh');
    if (refresh) {
      const renewed = await fetch('https://api.notion.com/v1/oauth/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(config.notion.clientId + ':' + config.notion.clientSecret).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refresh }), signal: AbortSignal.timeout(20000) });
      if (renewed.ok) { const data = await renewed.json(); await prisma.$transaction([write('notion_token', data.access_token), write('notion_refresh', data.refresh_token || refresh)]); return request(endpoint, method, body, false); }
    }
  }
  if (!res.ok) throw Object.assign(new Error('Notion request failed (' + res.status + '). Check connection, database access and property types.'), { statusCode: 502 });
  return res.json();
}
async function databases() {
  const items = []; let cursor;
  do { const data = await request('/search', 'POST', { filter: { value: 'data_source', property: 'object' }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }); items.push(...data.results.map(d => ({ id: d.id, name: d.title?.map(t => t.plain_text || t.text?.content || '').join('') || 'Untitled database' }))); cursor = data.has_more ? data.next_cursor : null; } while (cursor);
  return items;
}
async function selectDatabase(id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{32,36}$/i.test(id)) throw badRequest('Choose a valid Notion database');
  const source = await request('/data_sources/' + id);
  for (const [name,type] of Object.entries({Name:'title',Status:'select',Date:'date',Distance:'number',Reason:'rich_text'})) if (source.properties?.[name]?.type !== type) throw badRequest('Notion property ' + name + ' must use type ' + type);
  await write('notion_data_source', id);
  return status();
}
async function syncAttendanceToNotion(userId, attendance) {
  const sourceId = await read('notion_data_source');
  if (!sourceId || !await read('notion_token')) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return null;
  const id = crypto.createHash('sha256').update('notion:' + sourceId + ':' + attendance.id).digest('hex');
  await prisma.externalSync.upsert({ where: { id }, create: { id, entityType: 'attendance', entityId: attendance.id, provider: 'notion', externalId: '', lastSynced: new Date(), status: 'pending' }, update: {} });
  const lock = await prisma.externalSync.updateMany({ where: { id, OR: [{ status: { not: 'syncing' } }, { lastSynced: { lt: new Date(Date.now()-60000) } }] }, data: { status: 'syncing', lastSynced: new Date() } });
  if (!lock.count) return null;
  try {
    const previous = await prisma.externalSync.findUnique({ where: { id } });
    const properties = {
      Name: { title: [{ text: { content: user.name + ' - ' + attendance.date.toISOString().slice(0,10) } }] },
      Status: { select: { name: attendance.status } }, Date: { date: { start: attendance.date.toISOString().slice(0,10) } },
      Distance: { number: attendance.distanceKm }, Reason: { rich_text: attendance.reason ? [{ text: { content: attendance.reason } }] : [] }
    };
    const page = await request(previous.externalId ? '/pages/' + previous.externalId : '/pages', previous.externalId ? 'PATCH' : 'POST', { ...(previous.externalId ? {} : { parent: { type: 'data_source_id', data_source_id: sourceId } }), properties });
    await prisma.externalSync.update({ where: { id }, data: { externalId: page.id, status: 'synced', lastSynced: new Date() } });
    return page.id;
  } catch (err) { await prisma.externalSync.update({ where: { id }, data: { status: 'failed', lastSynced: new Date() } }); throw err; }
}
module.exports = { getAuthUrl, exchangeCode, saveConnection, disconnect, status, databases, selectDatabase, syncAttendanceToNotion };
