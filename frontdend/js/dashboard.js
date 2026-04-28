// ─────────────────────────────────────────────
// INIT PAGE
// ─────────────────────────────────────────────
initApp().then(async () => {

  if (!currentAgent) return;

  // show user email in sidebar
  const agentEl = document.getElementById("agent");
  if (agentEl) agentEl.innerText = currentAgent.name || currentAgent.id;

  await loadLeads();
});


// ─────────────────────────────────────────────
// LOAD LEADS + STATS
// ─────────────────────────────────────────────
async function loadLeads() {

  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("agent_id", currentAgent.id);

  if (error) {
    console.error(error);
    return;
  }

  // render leads
  const leadsEl = document.getElementById("leads");

  leadsEl.innerHTML = data.map(l => `
    <div class="lead">
      ${l.name || "Buyer"} • ${l.bhk || "?"} • ₹${l.budget_max || "?"}
    </div>
  `).join("");

  // stats
  document.getElementById("total").innerText = data.length;
  document.getElementById("hot").innerText =
    data.filter(l => l.score === "hot").length;

  document.getElementById("today").innerText = data.length;
}


// ─────────────────────────────────────────────
// CHAT INTENT
// ─────────────────────────────────────────────
function extractIntent(text) {
  text = text.toLowerCase();

  return {
    bhk: text.includes("2") ? "2BHK" : null,
    budget_max: text.match(/\d+/)?.[0],
    location: text.includes("nashik") ? "Nashik" : null
  };
}


// ─────────────────────────────────────────────
// FETCH PROPERTIES
// ─────────────────────────────────────────────
async function getProps(filters) {

  let query = db
    .from("properties")
    .select("*")
    .eq("agent_id", currentAgent.id);

  if (filters.bhk) {
    query = query.eq("bhk", filters.bhk);
  }

  if (filters.budget_max) {
    query = query.lte("price", filters.budget_max);
  }

  const { data } = await query.limit(3);

  return data || [];
}


// ─────────────────────────────────────────────
// CHAT UI
// ─────────────────────────────────────────────
function addMsg(text, cls) {

  const div = document.createElement("div");
  div.className = "msg " + cls;
  div.innerText = text;

  const chat = document.getElementById("chat");

  chat.appendChild(div);
  chat.scrollTo({
    top: chat.scrollHeight,
    behavior: "smooth"
  });
}


// ─────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────
window.sendMsg = async function () {

  const input = document.getElementById("msg");
  const btn   = document.getElementById("btn");

  const text = input.value.trim();
  if (!text) return;

  addMsg(text, "user");
  input.value = "";

  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div>';

  // extract intent
  const intent = extractIntent(text);

  // fetch matching properties
  const props = await getProps(intent);

  let reply = "No match";

  if (props.length) {
    reply = props
      .map(p => `${p.bhk || "Plot"} ₹${p.price}`)
      .join("\n");
  }

  setTimeout(() => addMsg(reply, "ai"), 600);

  // save lead
  await db.from("leads").insert([{
    agent_id: currentAgent.id,
    bhk: intent.bhk,
    budget_max: intent.budget_max,
    location: intent.location
  }]);

  // refresh UI
  await loadLeads();

  btn.disabled = false;
  btn.innerHTML = "Send";
};
