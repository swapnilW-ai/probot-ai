// ═══════════════════════════════════════════════════════
// PROPBOT AI — Vercel Serverless Webhook
// ✅ Fetches EACH agent's real properties from Supabase
// ✅ AI suggests correct listings per agent
// ═══════════════════════════════════════════════════════

const twilio = require('twilio');

const TWILIO_SID       = process.env.TWILIO_SID;
const TWILIO_AUTH      = process.env.TWILIO_AUTH;
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const SUPABASE_KEY     = process.env.SUPABASE_KEY;
const TWILIO_WA_NUMBER = 'whatsapp:+14155238886';
const SUPABASE_URL     = 'https://zejcequtmrmetogbxudz.supabase.co';

const GEMINI_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=' + GEMINI_API_KEY;
const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const incomingMsg = req.body.Body || '';
  const fromNumber  = req.body.From || '';
  const profileName = req.body.ProfileName || 'Buyer';

  console.log(`📩 FROM: ${fromNumber} | MSG: ${incomingMsg}`);

  try {

    // ✅ NEW ROUTING LOGIC
    const agent = await getOrAssignAgent(fromNumber);

    console.log("Agent object:", agent);

    const agentProperties = await getAgentProperties(agent?.id);
    console.log(`🏠 Properties found: ${agentProperties.length}`);

    const agentPrompt = buildAgentPrompt(agent, agentProperties);

    const history = await getHistory(fromNumber, agent?.id);
    console.log(`📚 History: ${history.length}`);

    history.push({ role: 'user', parts: [{ text: incomingMsg }] });

    const aiReply = await getGeminiReply(agentPrompt, history);

    await twilioClient.messages.create({
      body: aiReply,
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });

    await saveToSupabase(incomingMsg, aiReply, fromNumber, profileName, agent?.id);

    return res.status(200).send('<Response></Response>');

  } catch (err) {
    console.error('❌ Error:', err.message);
    return res.status(200).send('<Response></Response>');
  }
}

// 🔥 ROUTING FUNCTION
async function getOrAssignAgent(fromNumber) {
  const phone = fromNumber.replace('whatsapp:', '');

  const leadRes = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=agent_id&id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  const leads = await leadRes.json();

  if (leads?.length > 0 && leads[0].agent_id) {
    console.log("🔁 Existing lead → reuse agent");

    const agentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/agents?id=eq.${leads[0].agent_id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const agentData = await agentRes.json();
    return agentData[0] || null;
  }

  console.log("🆕 New lead → assigning agent");

  const agentsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agents?select=*&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  console.log("📦 Agents from DB:", agents);
  return agents[0] || null;
}

async function getAgentProperties(agentId) {
  if (!agentId) return [];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?agent_id=eq.${agentId}&status=eq.available&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await res.json();
    return data || [];

  } catch (e) {
    console.error('getAgentProperties error:', e.message);
    return [];
  }
}
// agent Prompt
function buildAgentPrompt(agent, properties) {

  let listingsText = '';

  if (properties.length === 0) {
    listingsText = 'No listings available right now.';
  } else {
    listingsText = properties.map((p, i) => {
      return `${i + 1}. ${p.bhk} in ${p.location} - ₹${p.price}L`;
    }).join('\n');
  }

  const agentName = agent?.name || 'Agent';

  return `You are a real estate assistant for ${agentName}.

Available listings:
${listingsText}

Reply short, friendly, WhatsApp style.`;
}

//----History
async function getHistory(fromNumber, agentId) {
  try {
    const phone = fromNumber.replace('whatsapp:', '');

    let url = `${SUPABASE_URL}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}&select=id`;
    if (agentId) url += `&agent_id=eq.${agentId}`;
    url += '&limit=1';

    const leadRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    const leads = await leadRes.json();
    if (!leads?.length) return [];

    const convRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?lead_id=eq.${leads[0].id}&order=created_at.asc&limit=5&select=role,message`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const convs = await convRes.json();

    return (convs || []).map(c => ({
      role: c.role === 'user' ? 'user' : 'model',
      parts: [{ text: c.message }]
    }));

  } catch (e) {
    console.error('History error:', e.message);
    return [];
  }
}

// ── SAVE LEAD FIXED ──
async function saveToSupabase(userMsg, aiReply, fromNumber, profileName, agentId) {
  const phone = fromNumber.replace('whatsapp:', '');

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
      phone
    })
  });

  const saved = await saveRes.json();
  const leadId = saved?.[0]?.id;

  if (leadId) {
    await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify([
        { lead_id: leadId, role: 'user', message: userMsg },
        { lead_id: leadId, role: 'assistant', message: aiReply }
      ])
    });
  }
}

