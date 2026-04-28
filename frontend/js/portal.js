// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
let convHistory = [];
let sessionReplies = 0;

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=AIzaSyBqdGK5fk9GGQKpcb2uInnWV1CvqUPi5nQ';

const AGENT_PROMPT = `You are an expert AI real estate assistant for a property agent in Nashik, Maharashtra, India.
Reply in Hindi+English (Hinglish). Max 4-5 lines. WhatsApp style.
Listings: 1BHK Panchavati Rs24L | 2BHK Gangapur Rs48.5L | 2BHK Ambad Rs40L | 3BHK Satpur Rs75L | 3BHK College Rd Rs95L
Ask about BHK, budget, location. Offer site visit. Never say you are AI.`;


// ─────────────────────────────────────────────
// INIT PAGE
// ─────────────────────────────────────────────
window.addEventListener('load', async () => {

  // topbar date
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // session check
  const { data: { session } } = await db.auth.getSession();

  if (!session) return;

  await loadAgentProfile(session.user);
  showDashboard();

});


// ─────────────────────────────────────────────
// AUTH UI
// ─────────────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0 && tab==='login') || (i===1 && tab==='signup'));
  });

  document.getElementById('login-form').style.display  = tab==='login' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = tab==='signup' ? 'block' : 'none';

  clearMsg();
};

function showMsg(msg, type='error') {
  const el = document.getElementById('auth-msg');
  if (!el) return;

  el.textContent = msg;
  el.className = `auth-msg ${type}`;
}

function clearMsg() {
  const el = document.getElementById('auth-msg');
  if (el) el.className = 'auth-msg';
}


// ─────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────
window.handleSignup = async function() {

  const fname = document.getElementById('s-fname').value.trim();
  const lname = document.getElementById('s-lname').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const phone = document.getElementById('s-phone').value.trim();
  const city  = document.getElementById('s-city').value;
  const pass  = document.getElementById('s-pass').value;

  if (!fname || !email || !phone || !city || !pass)
    return showMsg('Please fill all fields');

  if (pass.length < 6)
    return showMsg('Password must be at least 6 characters');

  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Creating account...';

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: `${fname} ${lname}`, phone, city } }
    });

    if (error) throw error;

    await db.from('agents').insert([{
      id: data.user.id,
      name: `${fname} ${lname}`,
      email,
      phone,
      city,
      plan: 'trial',
      status: 'active',
      trial_start: new Date().toISOString()
    }]);

    await db.auth.signInWithPassword({ email, password: pass });
    await loadAgentProfile(data.user);

    showMsg('Account created!', 'success');
    setTimeout(showDashboard, 800);

  } catch(e) {
    showMsg(e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Create Free Account';
};


// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
window.handleLogin = async function () {

  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;

  if (!email || !pass) {
    alert("Please enter email & password");
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password: pass
  });

  if (error) {
    alert(error.message);
    return;
  }

  await loadAgentProfile(data.user);
  showDashboard();
};


// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
window.handleLogout = async function () {
  await db.auth.signOut();
  location.reload();
};


// ─────────────────────────────────────────────
// LOAD PROFILE
// ─────────────────────────────────────────────
window.loadAgentProfile = async function(user) {

  try {
    const { data } = await db
      .from('agents')
      .select('*')
      .eq('id', user.id)
      .single();

    currentAgent = data;

  } catch {
    currentAgent = {
      id: user.id,
      name: user.email,
      city: 'Nashik',
      plan: 'trial'
    };
  }

  // sidebar UI
  const initials = currentAgent.name
    .split(' ')
    .map(n=>n[0])
    .join('')
    .slice(0,2)
    .toUpperCase();

  document.getElementById('sb-avatar').textContent = initials;
  document.getElementById('sb-name').textContent   = currentAgent.name;
  document.getElementById('sb-plan').textContent   =
    `${currentAgent.plan?.toUpperCase()} · ${currentAgent.city}`;
};


// ─────────────────────────────────────────────
// SHOW DASHBOARD
// ─────────────────────────────────────────────
window.showDashboard = function () {

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('dashboard').classList.add('show');

  loadLeads();
  loadStats();
  setPill('blue', '✓ Connected · Your Data Only');
};


// ─────────────────────────────────────────────
// STATS + LEADS
// ─────────────────────────────────────────────
function setPill(cls, txt) {
  const p = document.getElementById('db-pill');
  if (!p) return;

  p.className = `pill ${cls}`;
  p.innerHTML = `<div class="pill-dot"></div><span>${txt}</span>`;
}

async function loadLeads() {
  if (!currentAgent) return;

  const { data } = await db
    .from('leads')
    .select('*')
    .eq('agent_id', currentAgent.id)
    .order('created_at', { ascending: false });

  const tb = document.getElementById('leads-tbody');

  if (!data?.length) {
    tb.innerHTML = `<tr><td colspan="6">No leads yet</td></tr>`;
    return;
  }

  tb.innerHTML = data.map(l => `
    <tr>
      <td>${l.name || 'Buyer'}</td>
      <td>${l.bhk || '?'}</td>
      <td>${l.budget_max || '?'}</td>
      <td>${l.score}</td>
      <td>${new Date(l.created_at).toLocaleTimeString()}</td>
      <td><button>Call</button></td>
    </tr>
  `).join('');
}

async function loadStats() {
  if (!currentAgent) return;

  const { data } = await db
    .from('leads')
    .select('*')
    .eq('agent_id', currentAgent.id);

  document.getElementById('s-total').textContent = data?.length || 0;
}


// ─────────────────────────────────────────────
// CHAT (UNCHANGED LOGIC)
// ─────────────────────────────────────────────
window.sendMsg = async function() {

  const inp = document.getElementById('chat-in');
  const btn = document.getElementById('send-btn');

  const txt = inp.value.trim();
  if (!txt) return;

  inp.value = '';
  btn.disabled = true;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts:[{ text: AGENT_PROMPT }] },
        contents: [{ role:'user', parts:[{ text: txt }] }]
      })
    });

    const d = await res.json();
    console.log(d);

  } catch(e) {
    console.error(e);
  }

  btn.disabled = false;
};
