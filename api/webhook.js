// ═══════════════════════════════════════════════════════
// PROPBOT AI — FINAL (OpenRouter + Twilio + Supabase)
// No Gemini, No quota issues, Production-ready
// ═══════════════════════════════════════════════════════
const twilio = require("twilio");

// ENV VARIABLES
const {
  TWILIO_SID,
  TWILIO_AUTH,
  TWILIO_WA_NUMBER,
  OPENROUTER_API_KEY,
  SUPABASE_URL,
  SUPABASE_KEY
} = process.env;

const client = twilio(TWILIO_SID, TWILIO_AUTH);

// MAIN HANDLER
module.exports = async function handler(req, res) {

  if (req.method === "GET") {
    return res.status(200).send("Webhook live");
  }

  const incomingMsg = req.body.Body || "";
  const fromNumber  = req.body.From || "";
  const toNumber    = req.body.To || "";

  console.log("OPENROUTER:", process.env.OPENROUTER_API_KEY);

  try {

    // 1. GET AGENT ID (based on Twilio number)
    const agentId = await getAgentId(toNumber);

    // 2. GET AGENT PROPERTIES
    const properties = await getAgentProperties(agentId);

    // 3. CREATE AI PROMPT
    const prompt = buildPrompt(incomingMsg, properties);

    // 4. CALL OPENROUTER
    const aiReply = await getAIReply(prompt);

    // 5. SEND WHATSAPP MESSAGE
    await client.messages.create({
      body: aiReply,
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });

    // 6. SAVE LEAD + CHAT
    await saveConversation(agentId, fromNumber, incomingMsg, aiReply);

    return res.status(200).send("<Response></Response>");

  } catch (err) {
    console.error("❌ ERROR:", err.message);

    await client.messages.create({
      body: "Thoda issue aa raha hai, please try again 🙏",
      from: TWILIO_WA_NUMBER,
      to: fromNumber
    });

    return res.status(200).send("<Response></Response>");
  }
};



// ─────────────────────────────────────────────
// 🔹 GET AGENT ID FROM TWILIO NUMBER
// ─────────────────────────────────────────────
async function getAgentId(toNumber) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agents?whatsapp_number=eq.${encodeURIComponent(toNumber)}&select=id`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const data = await res.json();
  return data?.[0]?.id;
}



// ─────────────────────────────────────────────
// 🔹 GET PROPERTIES FOR THAT AGENT
// ─────────────────────────────────────────────
async function getAgentProperties(agentId) {

  console.log("🔎 Agent ID:", agentId);

  // ❌ If agent not found
  if (!agentId) {
    console.error("❌ agentId is undefined");
    return "No properties available";
  }

  const url = `${SUPABASE_URL}/rest/v1/properties?agent_id=eq.${agentId}`;
  console.log("🌐 Fetching:", url);

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  const data = await res.json();

  console.log("📦 SUPABASE RESPONSE:", data);

  // ❌ If not array (THIS is your crash)
  if (!Array.isArray(data)) {
    console.error("❌ Not array:", data);
    return "No properties available";
  }

  // ❌ No properties
  if (data.length === 0) {
    console.warn("⚠️ No properties found");
    return "No properties available";
  }

  // ✅ Format for AI
  return data.map(p =>
    `- ${p.bhk}BHK in ${p.location} for ₹${p.price}L (${p.details})`
  ).join("\n");
}



// ─────────────────────────────────────────────
// 🔹 BUILD AI PROMPT
// ─────────────────────────────────────────────
function buildPrompt(userMsg, properties) {
  return `
You are a real estate assistant.

User message:
${userMsg}

Available properties:
${properties}

Rules:
- Reply in Hinglish
- Keep it short (3-4 lines)
- Suggest best matching property
- Ask for site visit

Reply:
`;
}



// ─────────────────────────────────────────────
// 🔹 OPENROUTER CALL
// ─────────────────────────────────────────────
async function getAIReply(prompt) {

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await res.json();

  if (data.error) {
    console.error("AI ERROR:", data);
    throw new Error(data.error.message);
  }

  return data.choices[0].message.content;
}



// ─────────────────────────────────────────────
// 🔹 SAVE CONVERSATION
// ─────────────────────────────────────────────
async function saveConversation(agentId, phone, userMsg, aiReply) {

  await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify([
      { agent_id: agentId, phone, role: "user", message: userMsg },
      { agent_id: agentId, phone, role: "assistant", message: aiReply }
    ])
  });

}
