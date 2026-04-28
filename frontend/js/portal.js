
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=AIzaSyBqdGK5fk9GGQKpcb2uInnWV1CvqUPi5nQ';

const AGENT_PROMPT = `You are an expert AI real estate assistant for a property agent in Nashik, Maharashtra, India.
Reply in Hindi+English (Hinglish). Max 4-5 lines. WhatsApp style.
Listings: 1BHK Panchavati Rs24L | 2BHK Gangapur Rs48.5L | 2BHK Ambad Rs40L | 3BHK Satpur Rs75L | 3BHK College Rd Rs95L
Ask about BHK, budget, location. Offer site visit. Never say you are AI.`;

let currentAgent = null;
let convHistory = [];
let sessionReplies = 0;
//load Agent
window.loadAgentProfile = async function(user) {

  let { data: profile } = await db
    .from('agents')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  currentAgent = profile;

  // UPDATE UI HERE 
  if (currentAgent) {

    const initials = (currentAgent.name || "U")
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0,2)
      .toUpperCase();

    document.getElementById('sb-avatar').textContent = initials;
    document.getElementById('sb-name').textContent = currentAgent.name || "User";

    document.getElementById('sb-plan').textContent =
      `${currentAgent.plan?.toUpperCase()} · ${currentAgent.city || ''}`;

    document.getElementById('topbar-date').textContent =
      new Date().toLocaleDateString('en-IN',{
        weekday:'long',
        day:'numeric',
        month:'short'
      }) + ` · ${currentAgent.city || ''}`;
  }

};

// ═══════════════════════════════════════════
// INIT — Check if already logged in
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  const dateEl = document.getElementById('topbar-date');

  if (dateEl) {
    dateEl.textContent =
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
  }

});

(async () => {
  const { data: { session } } = await db.auth.getSession();

  if (!session) return;

  const user = session.user;

  // 1. TRY LOAD PROFILE
  let { data: profile } = await db
    .from('agents')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // 2. IF NOT FOUND → CREATE IT
  if (!profile) {
    console.warn(" Profile missing, creating...");

    const { error } = await db.from('agents').insert([{
      id: user.id,
      email: user.email,
      name: user.email.split('@')[0],
      plan: 'free',
      status: 'active',
      trial_start: new Date().toISOString(),
      plan_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
    }]);

    if (error) {
      console.error(" Failed to create profile:", error);
      alert("Account setup error. Please try again.");
      return;
    }

    // reload profile after insert
    const res = await db
      .from('agents')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    profile = res.data;
  }

  // 3. CONTINUE NORMAL FLOW
  await loadAgentProfile(user);
  showDashboard();

})();
// ═══════════════════════════════════════════
// AUTH TAB SWITCH
// ═══════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0 && tab==='login') || (i===1 && tab==='signup'));
  });
  document.getElementById('login-form').style.display  = tab==='login'  ? 'block' : 'none';
  document.getElementById('signup-form').style.display = tab==='signup' ? 'block' : 'none';
  clearMsg();
}

function showMsg(msg, type='error') {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = `auth-msg ${type}`;
}
function clearMsg() {
  const el = document.getElementById('auth-msg');
  el.className = 'auth-msg';
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════
window.handleLogin = async function() {

  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;

  if (!email || !pass) {
    showMsg('Enter email & password');
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Logging in...';

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) throw error;

    // load profile + dashboard
    await loadAgentProfile(data.user);
    showDashboard();

  } catch (e) {
    showMsg(e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Login to Dashboard';
};

// ═══════════════════════════════════════════
// SIGNUP
// ═══════════════════════════════════════════
window.handleSignup = async function() {
  const fname = document.getElementById('s-fname').value.trim();
  const lname  = document.getElementById('s-lname').value.trim();
  const email  = document.getElementById('s-email').value.trim();
  const phone  = document.getElementById('s-phone').value.trim();
  const city   = document.getElementById('s-city').value;
  const pass   = document.getElementById('s-pass').value;

  if (!fname||!email||!phone||!city||!pass) return showMsg('Please fill all fields');
  if (pass.length < 6) return showMsg('Password must be at least 6 characters');

  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Creating account...';

  try {
    // 1. Create Supabase auth account
    const { data, error } = await db.auth.signUp({
      email, password: pass,
      options: { data: { full_name: `${fname} ${lname}`, phone, city } }
    });
    if (error) throw error;

    // 2. Save agent profile to agents table
    await db.from('agents').insert([{
      id: data.user.id,
      name: `${fname} ${lname}`,
      email, phone, city,
      plan: 'trial',
      status: 'active',
      trial_start: new Date().toISOString()
    }]);

    showMsg('✅ Account created! Logging you in...', 'success');
    // Note: Make sure email confirmation is OFF in Supabase Auth settings

    // 3. Auto login
    await db.auth.signInWithPassword({ email, password: pass });
    await loadAgentProfile(data.user);
    setTimeout(showDashboard, 1000);

  } catch(e) {
    showMsg(e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Create Free Account';
}


// ═══════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════
async function handleLogout() {
  await db.auth.signOut();
  currentAgent = null;
  document.getElementById('dashboard').classList.remove('show');
  document.getElementById('auth-screen').style.display = 'grid';
  switchTab('login');
}

  // Update sidebar
  // Update sidebar (SAFE)
if (currentAgent) {
  const initials = currentAgent.name.split(' ')
    .map(n=>n[0])
    .join('')
    .slice(0,2)
    .toUpperCase();

  document.getElementById('sb-avatar').textContent = initials;
  document.getElementById('sb-name').textContent = currentAgent.name;
  document.getElementById('sb-plan').textContent =
    `${currentAgent.plan?.toUpperCase()} · ${currentAgent.city}`;

  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-IN',{
      weekday:'long',day:'numeric',month:'short'
    }) + ` · ${currentAgent.city}`;
}

// ═══════════════════════════════════════════
// SHOW DASHBOARD
// ═══════════════════════════════════════════
function showDashboard() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('dashboard').classList.add('show');
  loadLeads();
  loadStats();
  setPill('blue', '✓ Connected · Your Data Only');
}
function setPill(cls, txt) {
  const p = document.getElementById('db-pill');
  p.className = `pill ${cls}`;
  p.innerHTML = `<div class="pill-dot"></div><span>${txt}</span>`;
}

// ═══════════════════════════════════════════
// LOAD LEADS — FILTERED BY AGENT ID
// ═══════════════════════════════════════════
async function loadLeads() {
  if (!currentAgent) return;
  try {
    const { data, error } = await db
      .from('leads')
      .select('*')
      .eq('agent_id', currentAgent.id)   // ← KEY: only THIS agent's leads
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const tb = document.getElementById('leads-tbody');
    if (!data?.length) {
      tb.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="ei">🤖</div>No leads yet. Your AI agent will add them automatically!</div></td></tr>`;
      return;
    }

    tb.innerHTML = data.map(l => `
      <tr class="newrow">
        <td><div class="lname">${l.name||'Buyer'}</div><div class="lphone">${l.phone||'—'}</div></td>
        <td><span style="font-size:0.76rem;color:#555">${l.bhk||'?'} · ${l.location||currentAgent.city}</span></td>
        <td><span class="bgt">${l.budget_max?'₹'+l.budget_max+'L':'?'}</span></td>
        <td>${scoreTag(l.score)}</td>
        <td><span class="tago">${ago(l.created_at)}</span></td>
        <td><button class="abtn">${l.score==='hot'?'Call Now':l.score==='warm'?'Follow Up':'Nurture'}</button></td>
      </tr>`).join('');
  } catch(e) {
    console.error('Load leads error:', e);
  }
}

// ═══════════════════════════════════════════
// LOAD STATS — FILTERED BY AGENT ID
// ═══════════════════════════════════════════
async function loadStats() {
  if (!currentAgent) return;
  try {
    const { data } = await db
      .from('leads')
      .select('id,score,created_at')
      .eq('agent_id', currentAgent.id); // ← only THIS agent's stats

    if (!data) return;
    const today = new Date().toDateString();
    const hot = data.filter(l=>l.score==='hot').length;
    document.getElementById('s-total').textContent = data.length;
    document.getElementById('s-hot').textContent = hot;
    document.getElementById('s-today').textContent = data.filter(l=>new Date(l.created_at).toDateString()===today).length;
    document.getElementById('hot-badge').textContent = hot;
  } catch(e) {}
}

// ═══════════════════════════════════════════
// AI TEST CHAT
// ═══════════════════════════════════════════
async function sendMsg() {
  const inp = document.getElementById('chat-in');
  const btn = document.getElementById('send-btn');
  const txt = inp.value.trim();
  if (!txt) return;

  inp.value = ''; inp.style.height = 'auto';
  btn.disabled = true; btn.innerHTML = '⏳';

  addBubble('user', txt);
  convHistory.push({ role:'user', parts:[{ text:txt }] });
  showTyping();

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts:[{ text: AGENT_PROMPT }] },
        contents: convHistory,
        generationConfig: { maxOutputTokens:200, temperature:0.7 }
      })
    });
    const d = await res.json();
    const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || fallback(txt);
    removeTyping(); addBubble('ai', reply);
    convHistory.push({ role:'model', parts:[{ text:reply }] });

    // Save lead with agent_id
    saveLead(txt, currentAgent?.id);

  } catch(e) {
    removeTyping(); addBubble('ai', fallback(txt));
    saveLead(txt, currentAgent?.id);
  }

  sessionReplies++;
  document.getElementById('s-replies').textContent = sessionReplies;
  btn.disabled = false; btn.innerHTML = '➤';
  inp.focus();
}

// ═══════════════════════════════════════════
// SAVE LEAD WITH AGENT ID
// ═══════════════════════════════════════════
async function saveLead(msg, agentId) {
  if (!agentId) return;
  try {
    const { data } = await db.from('leads').insert([{
      agent_id: agentId,           // ← links lead to THIS agent
      name: 'Test Buyer',
      phone: '+91 00000 00000',
      location: currentAgent?.city || 'Nashik',
      score: 'warm',
      status: 'new'
    }]).select();

    await loadLeads();
    await loadStats();
    addAct('💾', `New lead saved to <strong>your account</strong>`);
  } catch(e) { console.error('Save error:', e); }
}

// ═══════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════
function addBubble(role, text) {
  const c = document.getElementById('chat-msgs');
  const d = document.createElement('div');
  d.className = `mrow ${role==='user'?'user':'ai'}`;
  d.innerHTML = `<div class="mlabel">${role==='ai'?'⚡ AI':'Buyer (Test)'}</div>
    <div class="mbubble">${text.replace(/\n/g,'<br>')}</div>
    <div class="mtime">${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}

function showTyping() {
  const c = document.getElementById('chat-msgs');
  const d = document.createElement('div'); d.id='typ'; d.className='mrow ai';
  d.innerHTML = `<div class="tbubble"><div class="td"></div><div class="td"></div><div class="td"></div></div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}
function removeTyping() { const e=document.getElementById('typ'); if(e) e.remove(); }

function addAct(icon, text, bg='#dcfce7') {
  const log = document.getElementById('act-log');
  const d = document.createElement('div'); d.className='act-item newrow';
  d.innerHTML = `<div class="act-icon" style="background:${bg};">${icon}</div>
    <div class="act-text">${text}</div>
    <div class="act-time">${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>`;
  log.prepend(d);
}

function scoreTag(s) {
  const m={hot:'<span class="tag hot">🔥 Hot</span>',warm:'<span class="tag warm">⚡ Warm</span>',cold:'<span class="tag cold">❄ Cold</span>'};
  return m[s]||m.warm;
}

function ago(ts) {
  const m=Math.floor((Date.now()-new Date(ts))/60000);
  if(m<1) return 'just now'; if(m<60) return m+'m ago';
  const h=Math.floor(m/60); if(h<24) return h+'h ago'; return Math.floor(h/24)+'d ago';
}

function fallback(t) {
  t=t.toLowerCase();
  if(t.includes('2bhk')) return 'Namaste! Gangapur Road pe 2BHK hai — ₹48.5L, ready to move 🏠\nKya kal site visit karenge?';
  if(t.includes('3bhk')) return '3BHK ke liye:\n• Satpur ₹75L - pool+gym\n• College Rd ₹95L - premium\nKaunsa area?';
  return 'Namaste! 😊 Kaunsa BHK chahiye aur budget kya hai?';
}

//document.getElementById('chat-in').addEventListener('keydown', e => {
//  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}
//});
//document.getElementById('chat-in').addEventListener('input', function(){
//  this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,80)+'px';
//}
const chatInput = document.getElementById('chat-in');

if (chatInput) {
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });

  chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });
};

