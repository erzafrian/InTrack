const { todayKey, nextDate } = require('../utils/operationalTime');
const { google } = require('googleapis');
const config = require('../config/env');
const { prisma } = require('../middleware/auth');
const crypto = require('crypto');
const calendarError = () => Object.assign(new Error('Google Calendar could not be updated. Check the connection and try syncing again.'), { statusCode: 503 });
const eventKey = event => crypto.createHash('sha256').update('intrack:' + event.id).digest('hex');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

function getAuthUrl(state) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

async function handleCallback(code, userId) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  await prisma.user.update({
    where: { id: userId },
    data: { googleRefreshToken: tokens.refresh_token },
  });

  return tokens;
}

async function getAuthenticatedClient(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) return null;

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: user.googleRefreshToken });
  return client;
}

async function isConnected(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });
  return !!user?.googleRefreshToken;
}

async function disconnect(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { googleRefreshToken: null },
  });
}

async function syncEventToCalendar(userId, event) {
  const auth = await getAuthenticatedClient(userId);
  if (!auth) return null;

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const timeZone = 'Asia/Jakarta';

    const eventBody = {
      summary: event.title,
      description: event.description || '',
      start: event.allDay
        ? { date: todayKey(event.startDate), timeZone }
        : { dateTime: event.startDate.toISOString(), timeZone },
      end: event.allDay
        ? { date: nextDate(todayKey(event.endDate)), timeZone }
        : { dateTime: event.endDate.toISOString(), timeZone },
    };

    // Stable IDs make retry safe after a timeout or a failed local ID save.
    const id = event.gcalEventId || eventKey(event);
    let res;
    try {
      res = await calendar.events.update({ calendarId: 'primary', eventId: id, requestBody: eventBody }, { timeout: 15000 });
    } catch (err) {
      if (![404, 410].includes(Number(err.code || err.response?.status))) throw err;
      const insertId = eventKey(event);
      try {
        res = await calendar.events.insert({ calendarId: 'primary', requestBody: { ...eventBody, id: insertId } }, { timeout: 15000 });
      } catch (insertError) {
        if (Number(insertError.code || insertError.response?.status) !== 409) throw insertError;
        res = await calendar.events.update({ calendarId: 'primary', eventId: insertId, requestBody: eventBody }, { timeout: 15000 });
      }
    }
    return res.data.id;
  } catch (err) {
    console.error('[GoogleCalendar] Sync error:', err.message);
    throw calendarError();
  }
}

async function deleteCalendarEvent(userId, gcalEventId) {
  if (!gcalEventId) return;
  const auth = await getAuthenticatedClient(userId);
  if (!auth) throw Object.assign(new Error('Reconnect Google Calendar before deleting a linked event.'), { statusCode: 409 });

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: gcalEventId }, { timeout: 15000 });
  } catch (err) {
    if ([404, 410].includes(Number(err.code || err.response?.status))) return;
    console.error('[GoogleCalendar] Delete error:', err.message);
    throw calendarError();
  }
}

module.exports = {
  getAuthUrl,
  handleCallback,
  isConnected,
  disconnect,
  syncEventToCalendar,
  deleteCalendarEvent,
  eventKey,
};
