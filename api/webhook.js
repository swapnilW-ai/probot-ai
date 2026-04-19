// ═══════════════════════════════════════════════════════
// PROPBOT AI — Vercel Serverless Webhook
// File location in your repo: /api/webhook.js
// Twilio URL: https://probot-ai.vercel.app/api/webhook
// ═══════════════════════════════════════════════════════

const twilio = require('twilio');

// ── CREDENTIALS ──────────────────────────────────────
const TWILIO_SID       = 'ACc14b4a5b7ddb0ea49cf2414228edf4f7';
const TWILIO_AUTH      = 'ff2df03a4765a323ad52b2ba1265d6eb';
const TWILIO_WA_NUMBER = 'whatsapp:+14155238886';
const GEMINI_API_KEY   = 'AIzaSyBqdGK5fk9GGQKpcb2uInnWV1CvqUPi5nQ';
const SUPABASE_URL     = 'https://zejcequtmrmetogbxudz.supabase.co';
const SUPABASE_KEY     = 'sb_publishable_MDKa6Y4VCUoVA_UeBdaQ8w_93qDws5E';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

// ── AI AGENT BRAIN ────────────────────────────────────
const AGENT_PROMPT = `You are an expert AI real estate assistant for a property agent in Nashik, Maharashtra, India.

PERSONALITY:
- Warm, professional, helpful — like a knowledgeable friend
- Speak naturally in BOTH Hindi and English (Hinglish is perfect)
- Concise — never more than 4-5 lines per reply
- Use emojis sparingly to feel friendly, not spammy

YOUR JOB:
1. Greet the buyer warmly on first message
2. Understand their requirement: BHK type, location, budget, timeline
3. Suggest a matching property from listings below
4. Book a site visit if they are interested
5. If not ready, nurture them gently

NASHIK PROPERTY LISTINGS:
- 1BHK Panchavati: ₹24L, 580 sqft, ready to move, near temple
- 2BHK Gangapur Road: ₹48.5L, 950 sqft, 2nd floor, parking + lift
- 2BHK Ambad: ₹40L, 880 sqft, near MIDC, family-friendly
- 3BHK Satpur: ₹75L, 1350 sqft, society with gym & pool
- 3BHK College Road: ₹95L, 1480 sqft, premium, near schools

LANGUAGE RULE:
- Buyer writes Hindi → reply mostly Hindi
- Buyer writes English → reply English with warm Hindi greeting
- Keep replies SHORT (3-5 lines). WhatsApp style only.
- NEVER say you are an AI unless directly asked.`;

const EXTRACT_PROMPT = `Extract lead info from this WhatsApp message. Return ONLY valid JSON, no markdown, no extra text:
{"name":null,"bhk":null,"budget_min":null,"budget_max":null,"location":null,"score":"warm"}
Rules: bhk = "1BHK"/"2BHK"/"3BHK"/null. budget in lakhs as number. score: hot=clear budget+wants visit, warm=interested, cold=browsing.`;

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {

  // Only accept POST requests from Twilio
  if (req.method !== 'POST') {
    return res.status(200).json({ status: '✅ PropBot AI Webhook Live', url: 'POST /api/webhook' });
  }

  const incomingMsg = req.body.Body || '';
  const fromNumber  = req.body.From || '';
  const profileName = req.body.ProfileName || 'Buyer';

  console.log(`📩 Message from ${fromNumber}: ${incomingMsg}`);

  // Respond to Twilio immediately (required within 15 seconds)
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send('<Response></Response>');

  try {
    // 1. Load conversation history from Supabase
    const history = await getConversationHistory(fromNumber);

    // 2. Add new buyer message
    history.push({
      role: 'user',
      parts: [{ text: incomingMsg }]
    });

    // 3. Get Gemini AI reply
    const aiReply = await getGeminiReply(history);
    console.log(`🤖 AI reply: ${aiReply.slice(0, 60)}...`);

    // 4. Send reply via Twilio WhatsApp
    await twilioClient.messages.create({
      body: aiReply,
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });
    console.log(`📤 Sent to ${fromNumber}`);

    // 5. Save everything to Supabase
    await saveToSupabase(incomingMsg, aiReply, fromNumber, profileName);

  } catch (err) {
    console.error('❌ Error:', err.message);

    // Fallback message so buyer isn't left hanging
    try {
      await twilioClient.messages.create({
        body: 'Namaste! Thodi technical problem aa gayi. Kripya 2 minute mein dobara message karein. 🙏',
        from: TWILIO_WA_NUMBER,
        to: fromNumber
      });
    } catch (e) {
      console.error('Fallback failed:', e.message);
    }
  }
}

// ── GET CONVERSATION HISTORY FROM SUPABASE ────────────
async function getConversationHistory(fromNumber) {
  try {
    const phone = fromNumber.replace('whatsapp:', '');

    // Find lead by phone
    const leadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const leads = await leadRes.json();
    if (!leads.length) return [];

    // Get last 8 messages
    const convRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?lead_id=eq.${leads[0].id}&order=created_at.asc&limit=8`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const convs = await convRes.json();

    // Format for Gemini
    return convs.map(c => ({
      role: c.role === 'user' ? 'user' : 'model',
      parts: [{ text: c.message }]
    }));

  } catch (e) {
    console.error('History fetch error:', e.message);
    return [];
  }
}

// ── GEMINI AI REPLY ───────────────────────────────────
async function getGeminiReply(history) {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: AGENT_PROMPT }]
      },
      contents: history,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.7
      }
    })
  });

  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  return data.candidates?.[0]?.content?.parts?.[0]?.text
    || 'Namaste! Abhi thodi problem hai. Kripya dobara try karein. 🙏';
}

// ── SAVE LEAD + CONVERSATION TO SUPABASE ─────────────
async function saveToSupabase(userMsg, aiReply, fromNumber, profileName) {
  try {
    const phone = fromNumber.replace('whatsapp:', '');

    // Extract lead info with Gemini
    const extractRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${EXTRACT_PROMPT}\n\nMessage: ${userMsg}` }]
        }],
        generationConfig: { maxOutputTokens: 150, temperature: 0 }
      })
    });

    const extractData = await extractRes.json();
    const raw  = (extractData.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
                  .replace(/```json|```/g, '').trim();
    const lead = JSON.parse(raw);

    // Check if lead exists
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const existing = await checkRes.json();

    let leadId;

    if (existing.length > 0) {
      // Update existing lead
      leadId = existing[0].id;
      await fetch(
        `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify({
            score: lead.score || 'warm',
            bhk: lead.bhk || undefined,
            budget_max: lead.budget_max || undefined,
            location: lead.location || undefined
          })
        }
      );

    } else {
      // Create new lead
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: profileName || lead.name || 'WhatsApp Buyer',
          phone: phone,
          bhk: lead.bhk,
          budget_min: lead.budget_min,
          budget_max: lead.budget_max,
          location: lead.location || 'Nashik',
          score: lead.score || 'warm',
          status: 'new'
        })
      });
      const saved = await saveRes.json();
      leadId = saved[0]?.id;
    }

    // Save both messages to conversations
    if (leadId) {
      await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify([
          { lead_id: leadId, role: 'user',      message: userMsg  },
          { lead_id: leadId, role: 'assistant',  message: aiReply  }
        ])
      });
    }

    console.log(`💾 Saved — ${phone}, ${lead.bhk || '?'}, ₹${lead.budget_max || '?'}L, ${lead.score}`);

  } catch (e) {
    console.error('Supabase save error:', e.message);
  }
}
