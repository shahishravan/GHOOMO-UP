/**
 * GhoomoUP — Serverless Groq Compound AI Gateway
 * 
 * Secure Netlify serverless function proxying requests to Groq API.
 * Uses Groq's 'groq/compound' model with built-in real-time web search capabilities.
 * Zero GROQ_API_KEY leakage to frontend client.
 */

const https = require('https');

exports.handler = async function (event, context) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Preflight OK' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'GROQ_API_KEY is not configured on the server.',
        fallbackRequired: true
      })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const userMessage = payload.message || '';
    const chatHistory = payload.history || [];

    if (!userMessage.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message cannot be empty.' })
      };
    }

    const systemPrompt = `You are GhoomoUP's warm, concise travel guide for Uttar Pradesh, India.
The active destination foundation covers:
1. Varanasi — Ganga riverfront, historic lanes, temples, music, craft and local food.
2. Ayodhya — pilgrimage heritage, sacred places and the Saryu riverfront.
3. Prayagraj — the Sangam region, riverfront, historic landmarks and cultural life.

Guidelines:
- Give concise, useful advice without inventing schedules, distances, prices, access rules, credentials or provider availability.
- Encourage visitors to check current official and local guidance for changing schedules, safety, access and crowd conditions.
- Mention only active GhoomoUP destinations; other locations may be added after review.
- Do not imply that a listing is approved or available unless it is shown in the app.
- Encourage direct WhatsApp or phone contact where appropriate. GhoomoUP does not process payments or confirm bookings.
- Keep responses warm and easy to scan, with bullets where helpful.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: userMessage }
    ];

    const postData = JSON.stringify({
      model: 'groq/compound', // Groq compound AI with built-in real-time web search
      messages: messages,
      temperature: 0.7,
      max_tokens: 600
    });

    const responseText = await new Promise((resolve, reject) => {
      const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 12000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Groq API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Groq API request timed out.'));
      });

      req.write(postData);
      req.end();
    });

    const groqResponse = JSON.parse(responseText);
    const replyContent = groqResponse.choices?.[0]?.message?.content || 'I apologize, I could not generate a response. Please try again.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: replyContent,
        model: 'groq/compound',
        mode: 'live-groq-ai'
      })
    };

  } catch (error) {
    console.error('Error in chat.js:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        fallbackRequired: true
      })
    };
  }
};
