const config = require('../config/env');
const { prisma } = require('../middleware/auth');

function getAuthUrl(userId) {
  const params = new URLSearchParams({
    client_id: config.notion.clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: config.notion.redirectUri,
    state: userId || '',
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const credentials = Buffer.from(`${config.notion.clientId}:${config.notion.clientSecret}`).toString('base64');

  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.notion.redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Notion] Token exchange failed:', res.status, text);
    throw new Error('Notion OAuth token exchange failed');
  }

  return res.json();
}

async function syncAttendanceToNotion(userId, attendance, userName) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notionAccessToken: true, notionDatabaseId: true },
  });

  if (!user?.notionAccessToken) {
    console.warn('[Notion] User has no Notion token, skipping sync');
    return null;
  }

  // If user has no database ID, try to find the first database they have access to
  let databaseId = user.notionDatabaseId;
  if (!databaseId) {
    try {
      const searchRes = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.notionAccessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({ filter: { value: 'database', property: 'object' }, page_size: 1 }),
      });
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.results?.[0]) {
          databaseId = data.results[0].id;
          await prisma.user.update({ where: { id: userId }, data: { notionDatabaseId: databaseId } });
        }
      }
    } catch {}
  }

  if (!databaseId) {
    console.warn('[Notion] No database found for user');
    return null;
  }

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.notionAccessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [{ text: { content: `${userName} — ${attendance.date.toISOString().split('T')[0]}` } }],
          },
          ...(attendance.status ? { Status: { select: { name: attendance.status } } } : {}),
          ...(attendance.date ? { Date: { date: { start: attendance.date.toISOString().split('T')[0] } } } : {}),
          ...(attendance.distanceKm != null ? { Distance: { number: attendance.distanceKm } } : {}),
          ...(attendance.reason ? { Reason: { rich_text: [{ text: { content: attendance.reason } }] } } : {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Notion] Sync error:', res.status, text);
      return null;
    }

    const data = await res.json();
    console.log('[Notion] Synced attendance:', data.id);
    return data.id;
  } catch (err) {
    console.error('[Notion] Sync failed:', err.message);
    return null;
  }
}

module.exports = { getAuthUrl, exchangeCode, syncAttendanceToNotion };
