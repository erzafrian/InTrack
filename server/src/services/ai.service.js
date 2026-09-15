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

  const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
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
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[AI Service] API error:', res.status, text);
    throw Object.assign(new Error('AI API request failed'), { statusCode: 502 });
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response from the AI service.";
}

module.exports = { chat };
