// ═══════════════════════════════════════════════════════
// PROPBOT AI — Follow-Up Engine (Phase 1)
// AI Intent Detection + Auto Scheduling + CRM Logic
// ═══════════════════════════════════════════════════════
const db = window.db;
let allFollowups = [];
let allLeads     = [];
let currentTab   = 'today';
let currentAISuggestion = null;
let editingId    = null;

const GEMINI_KEY = 'AIzaSyBqdGK5fk9GGQKpcb2uInnWV1CvqUPi5nQ';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=' + GEMINI_KEY;
const SUPABASE_URL = 'https://zejcequtmrmetogbxudz.supabase.co';
//const SUPABASE_KEY = process.env.SUPABASE_KEY;

// ── INIT ──────────────────────────────────────────────
initApp().then(async () => {
  if (!currentAgent) return;

  // Sidebar agent info
  const initials = (currentAgent.name || 'A').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('sb-avatar').textContent = initials;
  document.getElementById('sb-name').textContent   = currentAgent.name || currentAgent.email;
  document.getElementById('sb-plan').textContent   = `${(currentAgent.plan||'PRO').toUpperCase()} · ${currentAgent.city||''}`;

  // Date
  document.getElementById('top-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Default date = today
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

  await Promise.all([loadFollowups(), loadLeadsDropdown()]);

  // Check for due reminders
  checkReminders();
});

// ── LOAD FOLLOW-UPS ───────────────────────────────────
async function loadFollowups() {
  try {
    const { data, error } = await db
      .from('followups')
      .select(`*, leads(name, phone, score, bhk, budget_max)`)
      .eq('agent_id', currentAgent.id)
      .order('followup_date', { ascending: true })
      .order('followup_time', { ascending: true });

    if (error) throw error;

    allFollowups = data || [];
    console.log(`✅ Follow-ups loaded: ${allFollowups.length}`);

    updateStats();
    updateTabCounts();
    render(currentTab);

  } catch(e) {
    console.error('loadFollowups error:', e.message);
    document.getElementById('fu-area').innerHTML =
      `<div class="empty-state"><div class="empty-glow">⚠️</div><div class="empty-title">${e.message}</div></div>`;
  }
}

// ── LOAD LEADS FOR DROPDOWN ───────────────────────────
async function loadLeadsDropdown() {
  try {
    const { data } = await db
      .from('leads')
      .select('id, name, phone, score, bhk, budget_max')
      .eq('agent_id', currentAgent.id)
      .order('created_at', { ascending: false });

    allLeads = data || [];

    const sel = document.getElementById('f-lead');
    sel.innerHTML = '<option value="">Select lead...</option>';
    allLeads.forEach(l => {
      const o = document.createElement('option');
      o.value = l.id;
      o.textContent = `${l.name || 'Unknown'} · ${l.phone || ''} · ${l.score?.toUpperCase() || 'WARM'}`;
      sel.appendChild(o);
    });
  } catch(e) { console.error('Leads dropdown error:', e.message); }
}

// ── STATS ─────────────────────────────────────────────
function updateStats() {
  const today    = new Date().toISOString().split('T')[0];
  const due      = allFollowups.filter(f => f.followup_date <= today && f.status === 'pending').length;
  const upcoming = allFollowups.filter(f => f.followup_date > today  && f.status === 'pending').length;
  const done     = allFollowups.filter(f => f.status === 'done').length;
  const ai       = allFollowups.filter(f => f.ai_generated).length;

  document.getElementById('s-due').textContent      = due;
  document.getElementById('s-upcoming').textContent = upcoming;
  document.getElementById('s-done').textContent     = done;
  document.getElementById('s-ai').textContent       = ai;
  document.getElementById('due-badge').textContent  = due;
}

// ── TAB COUNTS ────────────────────────────────────────
function updateTabCounts() {
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('tc-today').textContent    = allFollowups.filter(f => f.followup_date === today && f.status === 'pending').length;
  document.getElementById('tc-upcoming').textContent = allFollowups.filter(f => f.followup_date > today  && f.status === 'pending').length;
  document.getElementById('tc-all').textContent      = allFollowups.filter(f => f.status === 'pending').length;
  document.getElementById('tc-ai').textContent       = allFollowups.filter(f => f.ai_generated).length;
  document.getElementById('tc-done').textContent     = allFollowups.filter(f => f.status === 'done').length;
  document.getElementById('tc-missed').textContent   = allFollowups.filter(f => f.followup_date < today && f.status === 'pending').length;
}

// ── SET TAB ───────────────────────────────────────────
function setTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  render(tab);
}

// ── RENDER ────────────────────────────────────────────
function render(tab) {
  const area  = document.getElementById('fu-area');
  const today = new Date().toISOString().split('T')[0];

  let list = [...allFollowups];

  if (tab === 'today')    list = list.filter(f => f.followup_date === today && f.status === 'pending');
  if (tab === 'upcoming') list = list.filter(f => f.followup_date > today   && f.status === 'pending');
  if (tab === 'all')      list = list.filter(f => f.status === 'pending');
  if (tab === 'ai')       list = list.filter(f => f.ai_generated);
  if (tab === 'done')     list = list.filter(f => f.status === 'done');
  if (tab === 'missed')   list = list.filter(f => f.followup_date < today && f.status === 'pending');

  if (!list.length) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-glow">🔁</div>
        <div class="empty-title">No follow-ups ${tab === 'today' ? 'due today' : 'in this category'}</div>
        <div class="empty-sub">
          ${tab === 'today'
            ? 'Great! No pending follow-ups today. Add one or let the AI engine create them automatically.'
            : `No ${tab} follow-ups right now.`}
        </div>
        ${tab === 'today' || tab === 'all'
          ? `<button class="primary-btn" onclick="openAddModal()" style="margin-top:0;">+ Add Follow-Up</button>`
          : ''}
      </div>`;
    return;
  }

  area.innerHTML = list.map((f, i) => {
    const lead     = f.leads || {};
    const isOverdue = f.followup_date < today && f.status === 'pending';
    const isDone    = f.status === 'done';

    const dateStr  = f.followup_date
      ? new Date(f.followup_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' })
      : '—';
    const timeStr  = f.followup_time ? f.followup_time.slice(0,5) : '—';

    return `
    <div class="fu-card p-${isDone ? 'low' : f.priority || 'medium'} ${isDone ? 'done-card' : ''}"
         style="animation-delay:${i*0.04}s">

      <div class="fu-card-top">
        <div>
          <div class="fu-lead-name">${lead.name || 'Unknown Buyer'}</div>
          <div class="fu-lead-phone">${lead.phone || '—'}</div>
          <div class="fu-meta">
            <span class="fu-type">${f.followup_type || 'General'}</span>
            ${f.ai_generated ? '<span class="fu-ai-badge">🤖 AI</span>' : ''}
            ${isOverdue ? '<span class="fu-overdue">⚠️ OVERDUE</span>' : ''}
            ${lead.score ? `<span class="fu-type">${intentBadge(lead.score)}</span>` : ''}
          </div>
        </div>

        <div class="fu-time-box">
          <div class="fu-date-str">${dateStr}</div>
          <div class="fu-time-str">${timeStr}</div>
        </div>

        <div class="fu-priority ${isDone ? 'pri-done' : 'pri-' + (f.priority||'medium')}">
          ${isDone ? '✓ Done' : priorityLabel(f.priority)}
        </div>

        <div class="fu-actions">
          ${!isDone ? `
            <button class="fa-btn complete" onclick="markDone('${f.id}')">✅ Done</button>
            <button class="fa-btn reschedule" onclick="reschedule('${f.id}')">📅 Reschedule</button>
            <button class="fa-btn ai-run" onclick="runAIForFollowup('${f.id}')">🤖</button>
          ` : `
            <button class="fa-btn" onclick="reopenFollowup('${f.id}')">↩ Reopen</button>
          `}
        </div>
      </div>

      ${f.note ? `<div class="fu-notes">📝 ${f.note}</div>` : ''}
      ${f.ai_reason ? `<div class="fu-ai-reason">🤖 ${f.ai_reason}</div>` : ''}

    </div>`;
  }).join('');
}

// ── HELPERS ───────────────────────────────────────────
function priorityLabel(p) {
  return p === 'high' ? '🔴 High' : p === 'low' ? '🟢 Low' : '🟡 Medium';
}

function intentBadge(score) {
  const map = { hot:'🔥 Hot', warm:'⚡ Warm', cold:'❄ Cold' };
  return map[score] || score;
}

// ── REMINDER CHECK ────────────────────────────────────
function checkReminders() {
  const today   = new Date().toISOString().split('T')[0];
  const overdue = allFollowups.filter(f => f.followup_date <= today && f.status === 'pending');

  if (overdue.length > 0) {
    const banner = document.getElementById('reminder-banner');
    document.getElementById('reminder-text').textContent =
      `⚠️ You have ${overdue.length} overdue follow-up${overdue.length > 1 ? 's' : ''}!`;
    banner.style.display = 'flex';
  }
}

// ── MARK DONE ─────────────────────────────────────────
async function markDone(id) {
  try {
    const { error } = await db.from('followups').update({ status: 'done' }).eq('id', id);
    if (error) throw error;
    await loadFollowups();
  } catch(e) { alert(e.message); }
}

// ── REOPEN ────────────────────────────────────────────
async function reopenFollowup(id) {
  try {
    const { error } = await db.from('followups').update({ status: 'pending' }).eq('id', id);
    if (error) throw error;
    await loadFollowups();
  } catch(e) { alert(e.message); }
}

// ── RESCHEDULE ────────────────────────────────────────
async function reschedule(id) {
  const newDate = prompt('Enter new date (YYYY-MM-DD):');
  if (!newDate) return;

  const newTime = prompt('Enter new time (HH:MM), e.g. 11:00:') || '11:00';

  try {
    const { error } = await db.from('followups').update({
      followup_date: newDate,
      followup_time: newTime,
      status: 'pending'
    }).eq('id', id);
    if (error) throw error;
    await loadFollowups();
  } catch(e) { alert(e.message); }
}

// ── SAVE FOLLOW-UP ────────────────────────────────────
async function saveFollowup() {
  const leadId   = document.getElementById('f-lead').value;
  const date     = document.getElementById('f-date').value;
  const time     = document.getElementById('f-time').value;
  const type     = document.getElementById('f-type').value;
  const priority = document.getElementById('f-priority').value;
  const note     = document.getElementById('f-note').value.trim();

  if (!leadId)   return showMsg('Please select a lead', 'error');
  if (!date)     return showMsg('Please select a date', 'error');

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Saving...';

  const payload = {
    lead_id:       leadId,
    agent_id:      currentAgent.id,
    followup_date: date,
    followup_time: time,
    followup_type: type,
    priority,
    note:          note || null,
    status:        'pending',
    ai_generated:  false
  };

  try {
    const { error } = await db.from('followups').insert([payload]);
    if (error) throw error;
    showMsg('✅ Follow-up saved!', 'success');
    await loadFollowups();
    setTimeout(() => closeModal('add-modal'), 1000);
  } catch(e) {
    showMsg(e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '💾 Save';
}

// ═══════════════════════════════════════════════════════
// ── AI ENGINE ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// AI INTENT + FOLLOW-UP DECISION
const AI_PROMPT = `You are an expert real estate AI sales assistant.
Analyze the lead and their latest conversation. Return ONLY valid JSON no markdown:
{
  "intent": "hot/warm/cold/dead",
  "priority": "high/medium/low",
  "followup_type": "Call Back/Site Visit/Price Negotiation/Payment Reminder/Send Brochure/General Follow-Up",
  "next_followup_hours": number,
  "confidence": number between 0 and 100,
  "reason": "short 1-line explanation",
  "suggested_message": "exact WhatsApp message to send"
}
Rules:
- hot = wants to visit, discussed price, said yes: priority high, hours 12-24
- warm = interested but vague, asked questions: priority medium, hours 24-48
- cold = said later, busy, not now: priority low, hours 72
- dead = no interest, blocked, wrong number: priority low, hours 168`;

// ── RUN AI FOR A SPECIFIC FOLLOW-UP ──────────────────
async function runAIForFollowup(id) {
  const f    = allFollowups.find(x => x.id === id);
  const lead = f?.leads || {};

  currentAISuggestion = null;
  document.getElementById('ai-thinking').style.display = 'flex';
  document.getElementById('ai-result').style.display   = 'none';
  document.getElementById('ai-modal-foot').style.display = 'none';
  document.getElementById('ai-modal').classList.add('open');

  try {
    // Fetch latest conversation
    const { data: convs } = await db
      .from('conversations')
      .select('role, message')
      .eq('lead_id', f.lead_id)
      .order('created_at', { ascending: false })
      .limit(6);

    const convoText = (convs || [])
      .reverse()
      .map(c => `${c.role === 'user' ? 'Buyer' : 'AI'}: ${c.message}`)
      .join('\n') || 'No conversation yet.';

    const leadInfo = `
Lead: ${lead.name || 'Unknown'}, ${lead.bhk || '?'} BHK, budget ₹${lead.budget_max || '?'}L
Score: ${lead.score || 'warm'}
Last follow-up type: ${f.followup_type}

Recent conversation:
${convoText}`;

    // Call Gemini AI
    const res = await fetch(GEMINI_URL, {
    //const res = await fetch('backend/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: AI_PROMPT }] },
          { role: 'model', parts: [{ text: 'Understood. I will analyze and return JSON.' }] },
          { role: 'user', parts: [{ text: 'Analyze this lead:\n' + leadInfo }] }
        ],
        generationConfig: { maxOutputTokens: 300, temperature: 0.3 }
      })
    });

    const d    = await res.json();
    const raw  = (d.candidates?.[0]?.content?.parts?.[0]?.text || '{}').replace(/```json|```/g,'').trim();
    const ai   = JSON.parse(raw);

    currentAISuggestion = { ...ai, lead_id: f.lead_id, followup_id: id };

    // Display result
    document.getElementById('ai-thinking').style.display   = 'none';
    document.getElementById('ai-result').style.display     = 'flex';
    document.getElementById('ai-modal-foot').style.display = 'flex';

    document.getElementById('ai-result').innerHTML = `
      <div class="ai-field">
        <div class="ai-field-label">Lead Intent</div>
        <div class="ai-field-value">
          <span class="ai-intent-badge intent-${ai.intent||'warm'}">${intentIcon(ai.intent)} ${(ai.intent||'warm').toUpperCase()}</span>
        </div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">AI Confidence</div>
        <div class="ai-confidence">
          <div class="confidence-bar"><div class="confidence-fill" style="width:${ai.confidence||50}%"></div></div>
          <div class="confidence-pct">${ai.confidence||50}%</div>
        </div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">Recommended Action</div>
        <div class="ai-field-value">${ai.followup_type} · ${priorityLabel(ai.priority)} · in ${ai.next_followup_hours}h</div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">AI Reasoning</div>
        <div class="ai-field-value" style="color:#888;">${ai.reason}</div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">Suggested WhatsApp Message</div>
        <div class="ai-field-value" style="color:#a78bfa;font-style:italic;">"${ai.suggested_message}"</div>
      </div>
    `;

  } catch(e) {
    document.getElementById('ai-thinking').innerHTML =
      `<span style="color:#ef4444;">AI Error: ${e.message}</span>`;
  }
}

// ── GET AI SUGGESTION FROM MODAL ─────────────────────
async function getAISuggestion() {
  const leadId = document.getElementById('f-lead').value;
  if (!leadId) return showMsg('Please select a lead first', 'error');

  const lead = allLeads.find(l => l.id === leadId);

  currentAISuggestion = null;
  document.getElementById('ai-thinking').style.display = 'flex';
  document.getElementById('ai-result').style.display   = 'none';
  document.getElementById('ai-modal-foot').style.display = 'none';
  document.getElementById('ai-modal').classList.add('open');

  try {
    const { data: convs } = await db
      .from('conversations')
      .select('role, message')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(6);

    const convoText = (convs || [])
      .reverse()
      .map(c => `${c.role === 'user' ? 'Buyer' : 'AI'}: ${c.message}`)
      .join('\n') || 'No conversation yet.';

    const leadInfo = `
Lead: ${lead?.name || 'Unknown'}, ${lead?.bhk || '?'} BHK, budget ₹${lead?.budget_max || '?'}L
Score: ${lead?.score || 'warm'}

Recent conversation:
${convoText}`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: AI_PROMPT }] },
          { role: 'model', parts: [{ text: 'Understood.' }] },
          { role: 'user', parts: [{ text: 'Analyze:\n' + leadInfo }] }
        ],
        generationConfig: { maxOutputTokens: 300, temperature: 0.3 }
      })
    });

    const d   = await res.json();
    const raw = (d.candidates?.[0]?.content?.parts?.[0]?.text || '{}').replace(/```json|```/g,'').trim();
    const ai  = JSON.parse(raw);

    currentAISuggestion = { ...ai, lead_id: leadId };

    document.getElementById('ai-thinking').style.display   = 'none';
    document.getElementById('ai-result').style.display     = 'flex';
    document.getElementById('ai-modal-foot').style.display = 'flex';

    document.getElementById('ai-result').innerHTML = `
      <div class="ai-field">
        <div class="ai-field-label">Lead Intent</div>
        <div class="ai-field-value">
          <span class="ai-intent-badge intent-${ai.intent||'warm'}">${intentIcon(ai.intent)} ${(ai.intent||'warm').toUpperCase()}</span>
        </div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">AI Confidence</div>
        <div class="ai-confidence">
          <div class="confidence-bar"><div class="confidence-fill" style="width:${ai.confidence||50}%"></div></div>
          <div class="confidence-pct">${ai.confidence||50}%</div>
        </div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">Recommended Follow-Up</div>
        <div class="ai-field-value">${ai.followup_type} · ${priorityLabel(ai.priority)} · in ${ai.next_followup_hours}h</div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">AI Reasoning</div>
        <div class="ai-field-value" style="color:#888;">${ai.reason}</div>
      </div>
      <div class="ai-field">
        <div class="ai-field-label">Suggested Message</div>
        <div class="ai-field-value" style="color:#a78bfa;font-style:italic;">"${ai.suggested_message}"</div>
      </div>
    `;

  } catch(e) {
    document.getElementById('ai-thinking').innerHTML =
      `<span style="color:#ef4444;">AI Error: ${e.message}</span>`;
  }
}

// ── APPLY AI SUGGESTION ───────────────────────────────
async function applyAISuggestion() {
  if (!currentAISuggestion) return;

  const ai  = currentAISuggestion;
  const next = new Date();
  next.setHours(next.getHours() + (ai.next_followup_hours || 24));

  const payload = {
    lead_id:       ai.lead_id,
    agent_id:      currentAgent.id,
    followup_date: next.toISOString().split('T')[0],
    followup_time: next.toTimeString().slice(0,5),
    followup_type: ai.followup_type,
    priority:      ai.priority,
    note:          ai.suggested_message || null,
    status:        'pending',
    ai_generated:  true,
    ai_confidence: ai.confidence,
    ai_reason:     ai.reason
  };

  try {
    // If this was triggered from an existing follow-up, mark old as done
    if (ai.followup_id) {
      await db.from('followups').update({ status: 'done' }).eq('id', ai.followup_id);
    }

    const { error } = await db.from('followups').insert([payload]);
    if (error) throw error;

    closeModal('ai-modal');
    closeModal('add-modal');
    await loadFollowups();

  } catch(e) {
    alert('Error applying suggestion: ' + e.message);
  }
}

// ── INTENT ICON ───────────────────────────────────────
function intentIcon(intent) {
  return { hot:'🔥', warm:'⚡', cold:'❄️', dead:'💀' }[intent] || '⚡';
}

// ── MODAL HELPERS ─────────────────────────────────────
function openAddModal() {
  clearForm();
  document.getElementById('add-modal').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'add-modal') clearForm();
}

function overlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

function clearForm() {
  ['f-lead','f-date','f-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-time').value     = '11:00';
  document.getElementById('f-type').value     = 'Call Back';
  document.getElementById('f-priority').value = 'medium';
  document.getElementById('f-date').value     = new Date().toISOString().split('T')[0];
  showMsg('','');
}

function showMsg(msg, type) {
  const el = document.getElementById('modal-msg');
  el.textContent = msg;
  el.className   = `msg-bar ${type}`;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('add-modal');
    closeModal('ai-modal');
  }
});
