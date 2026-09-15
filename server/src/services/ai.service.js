const config = require('../config/env');

const SYSTEM_PROMPT = `You are the InTrack AI Assistant for intern attendance and progress.
Real-time database context is supplied below. Use it to answer mentor and administrator questions about intern progress, attendance, logbooks, and performance.
Provide reports, summaries, insights, and practical suggestions based on the supplied data. State when the data is insufficient; do not invent records.
Respond in friendly, professional English by default.
Use bold for key points, lists where useful, and headings for longer responses. Keep responses concise.
InTrack supports daily attendance (HADIR = Present, IZIN = On Leave, SAKIT = Sick), evidence uploads, geolocation, daily task logbooks, and a planner integrated with Google Calendar.
`;

async function chat(messages, dbContext) {
  if (!config.ai.apiKey) {
    throw Object.assign(new Error('AI API key not configured'), { statusCode: 501 });
  }

  let systemContent = SYSTEM_PROMPT;
  if (dbContext) {
    systemContent += '\n\n' + dbContext;
  }

  let res;
  try { res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: 'system', content: systemContent },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  }); } catch (err) {
    const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw Object.assign(new Error(timeout ? 'AI service timed out. Please try again.' : 'AI service is unavailable. Please try again later.'), { statusCode: timeout ? 504 : 503 });
  }

  if (!res.ok) {
    const message = [401,403].includes(res.status) ? 'AI credentials were rejected. Ask the administrator to check the AI configuration.' : res.status === 429 ? 'AI usage limit reached. Please try again later.' : 'AI service is unavailable. Please try again later.';
    throw Object.assign(new Error(message), { statusCode: res.status === 429 ? 429 : 503 });
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('AI service returned an empty response. Please try again.'), { statusCode: 502 });
  return content;
}

module.exports = { chat };
