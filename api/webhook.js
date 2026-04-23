```javascript
// ═══════════════════════════════════════════════════════
// PROPBOT AI — FINAL (OpenRouter + Twilio + Supabase)
// No Gemini, No quota issues, Production-ready
// ═══════════════════════════════════════════════════════

const twilio = require('twilio');

// ── ENV VARIABLES (SET IN VERCEL) ─────────────────────
const TWILIO_SID       = process.env.TWILIO_SID;
const TWILIO_AUTH      = process.env.TWILIO_AUTH;
const TWILIO_WA_NUMBER = process.env.TWILIO_WA_NUMBER;

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_KEY;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

// ── AI PROMPT ─────────────────────────────────────────
const AGENT_PROMPT = 'You are an expert AI real estate assistant for Nashik.

- Speak in Hinglish (Hindi + English)
- Keep replies short (3-4 lines)
- Be friendly, not robotic

Listings:
1BHK Panchavati ₹24L
2BHK Gangapur ₹48.5L
2BHK Ambad ₹40L
3BHK Satpur ₹75L
3BHK College Road ₹95L

Goal:
Understand user → suggest property → push for site visit.';

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {

  if (req.method === 'GET') {
    return res.status(200).json({ status: '✅ Live' });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const incomingMsg = req.body.Body || '';
  const fromNumber  = req.body.From || '';

  console.log("📩", incomingMsg);

  try {
    const history = await getHistory(fromNumber);

    history.push({
      role: 'user',
      parts: [{ text: incomingMsg }]
    });

    const aiReply = await getAIReply(history);

    await twilioClient.messages.create({
      body: aiReply || "Thoda issue hai, try again 🙏",
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });

    saveToSupabase(incomingMsg, aiReply, fromNumber)
      .catch(e => console.error("Supabase error:", e));

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');

  } catch (err) {
    console.error("❌ ERROR:", err);

    await twilioClient.messages.create({
      body: "Server busy, try again 🙏",
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });

    return res.status(200).send('<Response></Response>');
  }
}

// ── AI FUNCTION (OpenRouter) ──────────────────────────
async function getAIReply(history) {

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        { role: "system", content: AGENT_PROMPT },
        ...history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0].text
        }))
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  });

  const data = await response.json();

  if (!data.choices) {
    console.error("AI ERROR:", data);
    return "Thoda issue aa raha hai, please try again 🙏";
  }

  return data.choices[0].message.content;
}

// ── GET HISTORY ───────────────────────────────────────
async function getHistory(fromNumber) {
  try {
    const phone = fromNumber.replace('whatsapp:', '');

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?phone=eq.${phone}&limit=5`,
      { headers: { apikey: SUPABASE_KEY } }
    );

    const data = await res.json();

    return (data || []).map(c => ({
      role: c.role === 'user' ? 'user' : 'model',
      parts: [{ text: c.message }]
    }));

  } catch {
    return [];
  }
}

// ── SAVE DATA ─────────────────────────────────────────
async function saveToSupabase(userMsg, aiReply, fromNumber) {
  const phone = fromNumber.replace('whatsapp:', '');

  await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY
    },
    body: JSON.stringify({
      phone,
      user_msg: userMsg,
      ai_msg: aiReply
    })
  });
}
```
