const { todayKey, nextDate } = require('../utils/operationalTime');
const { google } = require('googleapis');
const config = require('../config/env');
const { prisma } = require('../middleware/auth');

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

    const res = await calendar.events[event.gcalEventId ? 'update' : 'insert']({
      ...(event.gcalEventId ? { eventId: event.gcalEventId } : {}),
      calendarId: 'primary',
      requestBody: eventBody,
    });

    return res.data.id;
  } catch (err) {
    console.error('[GoogleCalendar] Sync error:', err.message);
    return null;
  }
}

async function deleteCalendarEvent(userId, gcalEventId) {
  if (!gcalEventId) return;
  const auth = await getAuthenticatedClient(userId);
  if (!auth) return;

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: gcalEventId });
  } catch (err) {
    console.error('[GoogleCalendar] Delete error:', err.message);
  }
}

module.exports = {
  getAuthUrl,
  handleCallback,
  isConnected,
  disconnect,
  syncEventToCalendar,
  deleteCalendarEvent,
};
