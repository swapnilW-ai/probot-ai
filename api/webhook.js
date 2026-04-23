// ═══════════════════════════════════════════════════════
// PROPBOT AI — Vercel Serverless Webhook (FIXED)
// Key fix: Process AI + send WhatsApp BEFORE responding to Twilio
// ═══════════════════════════════════════════════════════

const twilio = require('twilio');

// ── CREDENTIALS ──────────────────────────────────────
const TWILIO_SID       = 'ACc14b4a5b7ddb0ea49cf2414228edf4f7';
const TWILIO_AUTH      = 'ff2df03a4765a323ad52b2ba1265d6eb';
const TWILIO_WA_NUMBER = 'whatsapp:+14155238886';
const GEMINI_API_KEY   = 'AIzaSyBqdGK5fk9GGQKpcb2uInnWV1CvqUPi5nQ';
const SUPABASE_URL     = 'https://zejcequtmrmetogbxudz.supabase.co';
const SUPABASE_KEY     = 'sb_publishable_MDKa6Y4VCUoVA_UeBdaQ8w_93qDws5E';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
//const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

// ── AI PROMPTS ────────────────────────────────────────
const AGENT_PROMPT = `You are an expert AI real estate assistant for a property agent in Nashik, Maharashtra, India.

PERSONALITY:
- Warm, professional, helpful — like a knowledgeable friend
- Speak naturally in BOTH Hindi and English (Hinglish is perfect)
- Concise — never more than 4-5 lines per reply
- Use emojis sparingly

YOUR JOB:
1. Greet the buyer warmly on first message
2. Understand: BHK type, location, budget, timeline
3. Suggest a matching property from listings
4. Book a site visit if interested
5. Nurture gently if not ready

NASHIK LISTINGS:
- 1BHK Panchavati: Rs24L, 580sqft, ready to move, near temple
- 2BHK Gangapur Road: Rs48.5L, 950sqft, parking + lift
- 2BHK Ambad: Rs40L, 880sqft, near MIDC
- 3BHK Satpur: Rs75L, 1350sqft, gym + pool
- 3BHK College Road: Rs95L, 1480sqft, premium

RULES:
- Match buyer language (Hindi/English/Hinglish)
- Keep replies SHORT — 3-5 lines only
- WhatsApp style — never write essays
- NEVER say you are an AI`;

const EXTRACT_PROMPT = `Extract lead info from this message. Return ONLY valid JSON no markdown:
{"bhk":null,"budget_max":null,"location":null,"score":"warm"}
score: hot=wants to visit+clear budget, warm=interested, cold=browsing. budget_max in lakhs as number.`;

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {

  // Health check for GET requests
  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ PropBot AI Webhook Live',
      method: 'Send POST requests from Twilio'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const incomingMsg = req.body.Body || '';
  const fromNumber  = req.body.From || '';
  const profileName = req.body.ProfileName || 'Buyer';

  console.log(`📩 FROM: ${fromNumber} | MSG: ${incomingMsg}`);

  // ── CRITICAL FIX: Do everything BEFORE responding ──
  // Vercel kills function after res.send() so we must
  // get AI reply and send WhatsApp FIRST, then respond

  try {
    // 1. Get conversation history
    const history = await getHistory(fromNumber);
    console.log(`📚 History loaded: ${history.length} messages`);

    // 2. Add new message to history
    history.push({
      role: 'user',
      parts: [{ text: incomingMsg }]
    });

    // 3. Get Gemini AI reply
    console.log('🤖 Calling Gemini...');
    const aiReply = await getGeminiReply(history);
    console.log(`✅ Gemini reply: ${aiReply.slice(0, 60)}`);

    // 4. Send WhatsApp reply via Twilio
    console.log('📤 Sending WhatsApp reply...');
    const twilioMsg = await twilioClient.messages.create({
      body: aiReply,
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });
    console.log(`✅ WhatsApp sent! SID: ${twilioMsg.sid}`);

    // 5. Save to Supabase in background
    saveToSupabase(incomingMsg, aiReply, fromNumber, profileName)
      .then(() => console.log('💾 Saved to Supabase'))
      .catch(e => console.error('Supabase error:', e.message));

    // 6. NOW respond to Twilio (after everything is done)
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');

  } catch (err) {
    console.error('❌ Main error:', err.message);
    console.error('Stack:', err.stack);

    // Try to send fallback WhatsApp message
    try {
      await twilioClient.messages.create({
        body: 'Namaste! Ek second rukein, abhi connect ho raha hoon. 🙏',
        from: TWILIO_WA_NUMBER,
        to: fromNumber
      });
    } catch (e) {
      console.error('Fallback failed:', e.message);
    }

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }
}

// ── GET CONVERSATION HISTORY ──────────────────────────
async function getHistory(fromNumber) {
  try {
    const phone = fromNumber.replace('whatsapp:', '');

    const leadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const leads = await leadRes.json();
    if (!leads?.length) return [];

    const convRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?lead_id=eq.${leads[0].id}&order=created_at.asc&limit=8&select=role,message`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const convs = await convRes.json();
    if (!convs?.length) return [];

    return convs.map(c => ({
      role: c.role === 'user' ? 'user' : 'model',
      parts: [{ text: c.message }]
    }));

  } catch (e) {
    console.error('History error:', e.message);
    return [];
  }
}

// ── GEMINI AI REPLY ───────────────────────────────────
async function getGeminiReply(history) {

  // v1 API does not support system_instruction
  // Inject system prompt as first turn instead
  const contents = [
    {
      role: 'user',
      parts: [{ text: 'Follow these instructions:\n' + AGENT_PROMPT + '\n\nReady?' }]
    },
    {
      role: 'model',
      parts: [{ text: 'Ready! I will help buyers find properties in Nashik in Hindi and English.' }]
    },
    ...history
  ];

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: 250,
        temperature: 0.7
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('Gemini error:', JSON.stringify(data.error));
    throw new Error(data.error.message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  return text;
}

// ── SAVE TO SUPABASE ──────────────────────────────────
async function saveToSupabase(userMsg, aiReply, fromNumber, profileName) {
  const phone = fromNumber.replace('whatsapp:', '');

  // Extract lead info
  let lead = { score: 'warm', bhk: null, budget_max: null, location: null };
  try {
    const extractRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: EXTRACT_PROMPT + '\n\nMessage: ' + userMsg }] }
        ],
        generationConfig: { maxOutputTokens: 100, temperature: 0 }
      })
    });
    const extractData = await extractRes.json();
    const raw = (extractData.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
      .replace(/```json|```/g, '').trim();
    lead = { ...lead, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Extract error:', e.message);
  }

  // Check if lead exists
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const existing = await checkRes.json();
  let leadId;

  if (existing?.length > 0) {
    leadId = existing[0].id;
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ score: lead.score })
    });
  } else {
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: profileName || 'WhatsApp Buyer',
        phone,
        bhk: lead.bhk,
        budget_max: lead.budget_max,
        location: lead.location || 'Nashik',
        score: lead.score,
        status: 'new'
      })
    });
    const saved = await saveRes.json();
    leadId = saved?.[0]?.id;
  }

  // Save both messages
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
        { lead_id: leadId, role: 'assistant', message: aiReply  }
      ])
    });
  }
}
