// ═══════════════════════════════════════════════════════
// PROPBOT AI — Vercel Serverless Webhook
// ✅ Fetches EACH agent's real properties from Supabase
// ✅ AI suggests correct listings per agent
// ═══════════════════════════════════════════════════════

const twilio = require('twilio');

// ── CREDENTIALS ──────────────────────────────────────
const TWILIO_SID       = process.env.TWILIO_SID;
const TWILIO_AUTH      = process.env.TWILIO_AUTH;
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const SUPABASE_KEY     = process.env.SUPABASE_KEY;
const TWILIO_WA_NUMBER = 'whatsapp:+14155238886';
const SUPABASE_URL     = 'https://zejcequtmrmetogbxudz.supabase.co';

const GEMINI_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=' + GEMINI_API_KEY;
const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

const EXTRACT_PROMPT = `Extract lead info from this WhatsApp message. Return ONLY valid JSON no markdown:
{"bhk":null,"budget_max":null,"location":null,"score":"warm"}
score: hot=clear budget+wants to visit, warm=interested, cold=browsing. budget_max in lakhs as number.`;

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {

  if (req.method !== 'POST') {
  return res.status(405).send('Method Not Allowed');
}

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const incomingMsg = req.body.Body || '';
  const fromNumber  = req.body.From || '';
  const profileName = req.body.ProfileName || 'Buyer';
  const toNumber    = req.body.To || TWILIO_WA_NUMBER; // which agent number received the msg

  console.log(`📩 FROM: ${fromNumber} | TO: ${toNumber} | MSG: ${incomingMsg}`);

  try {
    // 1. Find which agent owns this WhatsApp number
    const agent = await getAgent(toNumber);
    console.log("Agent object:", agent);
    console.log(`🔎 Agent: ${agent ? agent.id + ' — ' + agent.name : 'NOT FOUND — using default'}`);

    // 2. Fetch that agent's properties from Supabase
    const agentProperties = await getAgentProperties(agent?.id);
    console.log(`🏠 Properties found: ${agentProperties.length}`);

    // 3. Build dynamic AI prompt with agent's real listings
    const agentPrompt = buildAgentPrompt(agent, agentProperties);

    // 4. Get conversation history
    const history = await getHistory(fromNumber, agent?.id);
    console.log(`📚 History: ${history.length} messages`);

    // 5. Add buyer message to history
    history.push({ role: 'user', parts: [{ text: incomingMsg }] });

    // 6. Get AI reply using agent's real properties
    console.log('🤖 Calling Gemini with agent properties...');
    const aiReply = await getGeminiReply(agentPrompt, history);
    console.log(`✅ Reply: ${aiReply.slice(0, 80)}`);

    // 7. Send WhatsApp reply
    const twilioMsg = await twilioClient.messages.create({
      body: aiReply,
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });
    console.log(`📤 Sent! SID: ${twilioMsg.sid}`);

    // 8. Save lead + conversation to Supabase
    saveToSupabase(incomingMsg, aiReply, fromNumber, profileName, agent?.id)
      .then(() => console.log('💾 Saved to Supabase'))
      .catch(e => console.error('Save error:', e.message));

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');

  } catch (err) {
    console.error('❌ Error:', err.message);

    try {
      await twilioClient.messages.create({
        body: 'Namaste! Thodi technical problem hai. Kripya 2 minute mein dobara try karein. 🙏',
        from: TWILIO_WA_NUMBER,
        to: fromNumber
      });
    } catch(e) { console.error('Fallback failed:', e.message); }

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }
}

// ── GET AGENT BY WHATSAPP NUMBER ──────────────────────
async function getAgent(toNumber) {
  try {
    // Clean the number — remove whatsapp: prefix
    const phone = toNumber.replace('whatsapp:', '').trim();
    console.log(`🔍 Looking for agent with WA number: ${phone}`);
    console.log("DEPLOY TEST v2");

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/agents?whatsapp_number=ilike.${phone}&select=*&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const agents = await res.json();

    if (agents?.length > 0) return agents[0];

    // Fallback — return first active agent (for sandbox testing with shared number)
    console.log('⚠️ No agent found for this number — using first active agent');
    const fallbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/agents?status=eq.active&select=*&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const fallback = await fallbackRes.json();
    return fallback?.[0] || null;

  } catch(e) {
    console.error('getAgent error:', e.message);
    return null;
  }
}

// ── GET AGENT'S PROPERTIES FROM SUPABASE ─────────────
async function getAgentProperties(agentId) {
  if (!agentId) return [];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?agent_id=eq.${agentId}&status=eq.available&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();
    return data || [];
  } catch(e) {
    console.error('getAgentProperties error:', e.message);
    return [];
  }
}

// ── BUILD DYNAMIC AI PROMPT WITH AGENT'S PROPERTIES ──
function buildAgentPrompt(agent, properties) {

  // Format properties into a readable list for the AI
  let listingsText = '';

  if (properties.length === 0) {
    listingsText = 'No specific listings available right now. Ask the buyer for their requirements and tell them the agent will get back with options.';
  } else {
    listingsText = properties.map((p, i) => {
      const parts = [
        `${i + 1}. ${p.bhk || '?'} in ${p.location || '?'}${p.city ? ', ' + p.city : ''}`,
        `   Price: Rs${p.price}L`,
        p.area     ? `   Area: ${p.area} sqft`         : '',
        p.floor    ? `   Floor: ${p.floor}`             : '',
        p.facing   ? `   Facing: ${p.facing}`           : '',
        p.possession ? `   Possession: ${p.possession}` : '',
        p.amenities  ? `   Amenities: ${p.amenities}`   : '',
        p.description ? `   Details: ${p.description}`  : ''
      ].filter(Boolean).join('\n');
      return parts;
    }).join('\n\n');
  }

  const agentCity = agent?.city || 'your city';
  const agentName = agent?.name || 'the agent';

  return `You are an expert AI real estate assistant working for ${agentName}, a property agent in ${agentCity}, India.

PERSONALITY:
- Warm, professional, helpful — like a knowledgeable friend
- Speak naturally in BOTH Hindi and English (Hinglish is perfect)
- Concise — never more than 4-5 lines per reply
- Use emojis sparingly to feel friendly

YOUR JOB:
1. Greet buyer warmly on first message
2. Understand their requirement: BHK type, location, budget, timeline
3. Suggest the BEST matching property from the listings below
4. If they are interested — offer to book a site visit
5. If not ready — nurture them gently, ask follow up questions

AVAILABLE PROPERTY LISTINGS:
${listingsText}

MATCHING RULES:
- Match buyer's BHK requirement to listings
- Match their budget to listing price
- If exact match not available — suggest closest option
- Never suggest a property not in the list above
- If no match at all — say agent will find options and follow up

LANGUAGE RULE:
- Buyer writes Hindi → reply mostly Hindi with some English
- Buyer writes English → reply English with warm Hindi greeting
- Hinglish is always welcome — keep it natural like WhatsApp

IMPORTANT:
- Keep replies SHORT — 3-5 lines max
- This is WhatsApp — never write long paragraphs
- NEVER mention you are an AI unless directly asked`;
}

// ── GET CONVERSATION HISTORY ──────────────────────────
async function getHistory(fromNumber, agentId) {
  try {
    const phone = fromNumber.replace('whatsapp:', '');

    // Find lead by phone + agent
    let url = `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`;
    if (agentId) url += `&agent_id=eq.${agentId}`;
    url += '&limit=1';

    const leadRes = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
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

  } catch(e) {
    console.error('History error:', e.message);
    return [];
  }
}

// ── GEMINI AI REPLY ───────────────────────────────────
async function getGeminiReply(systemPrompt, history) {

  // Inject system prompt as first turn (v1beta compatible)
  const contents = [
    { role: 'user',  parts: [{ text: 'Follow these instructions:\n' + systemPrompt + '\n\nReady?' }] },
    { role: 'model', parts: [{ text: 'Ready! I will help buyers find the right property.' }] },
    ...history
  ];

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 250, temperature: 0.7 }
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

// ── SAVE LEAD + CONVERSATION TO SUPABASE ─────────────
async function saveToSupabase(userMsg, aiReply, fromNumber, profileName, agentId) {
  const phone = fromNumber.replace('whatsapp:', '');

  // Extract lead info with Gemini
  let lead = { score: 'warm', bhk: null, budget_max: null, location: null };
  try {
    const extractRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: EXTRACT_PROMPT + '\n\nMessage: ' + userMsg }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0 }
      })
    });
    const extractData = await extractRes.json();
    const raw = (extractData.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
      .replace(/```json|```/g, '').trim();
    lead = { ...lead, ...JSON.parse(raw) };
  } catch(e) { console.error('Extract error:', e.message); }

  // Check if lead already exists
  let checkUrl = `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`;
  if (agentId) checkUrl += `&agent_id=eq.${agentId}`;

  const checkRes = await fetch(checkUrl, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const existing = await checkRes.json();
  let leadId;

  if (existing?.length > 0) {
    // Update existing lead score
    leadId = existing[0].id;
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ score: lead.score, bhk: lead.bhk, budget_max: lead.budget_max })
    });

  } else {
    // Create new lead linked to agent
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        agent_id: agentId || null,
        name: profileName || 'WhatsApp Buyer',
        phone,
        bhk: lead.bhk,
        budget_max: lead.budget_max,
        location: lead.location || 'Unknown',
        score: lead.score,
        status: 'new'
      })
    });
    const saved = await saveRes.json();
    leadId = saved?.[0]?.id;
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
        { lead_id: leadId, role: 'assistant', message: aiReply  }
      ])
    });
  }

  console.log(`💾 Lead saved — ${phone}, ${lead.bhk || '?'}, ₹${lead.budget_max || '?'}L, ${lead.score}, agent: ${agentId || 'none'}`);
}
