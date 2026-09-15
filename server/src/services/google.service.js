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

function getAuthUrl(userId) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId,
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
        ? { date: event.startDate.toISOString().split('T')[0], timeZone }
        : { dateTime: event.startDate.toISOString(), timeZone },
      end: event.allDay
        ? { date: event.endDate.toISOString().split('T')[0], timeZone }
        : { dateTime: event.endDate.toISOString(), timeZone },
    };

    const res = await calendar.events.insert({
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
