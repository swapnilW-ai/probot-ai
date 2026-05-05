// ── INIT ──────────────────────────────────────
let allVisits = [];
let currentFilter = 'all';
let editingId = null;


initApp().then(async () => {
  if (!currentAgent) return;

  // Sidebar agent info
  const initials = (currentAgent.name || currentAgent.email || 'A')
    .split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('sb-avatar').textContent = initials;
  document.getElementById('sb-name').textContent   = currentAgent.name || currentAgent.email;
  document.getElementById('sb-plan').textContent   = `${(currentAgent.plan||'PRO').toUpperCase()} · ${currentAgent.city||''}`;

  // Date
  document.getElementById('top-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Default date = tomorrow
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  document.getElementById('v-date').value = tom.toISOString().split('T')[0];

  await Promise.all([loadVisits(), loadProps()]);
});

// ── LOAD VISITS ───────────────────────────────
async function loadVisits() {
  try {
    const { data, error } = await db
      .from('visits')
      .select('*')
      .eq('agent_id', currentAgent.id)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    allVisits = data || [];
    updateStats();
    updateTabCounts();
    render(currentFilter);
  } catch(e) {
    document.getElementById('visits-area').innerHTML =
      `<div class="empty-state"><div class="empty-glow">⚠️</div><div class="empty-title">Error loading visits</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

// ── LOAD PROPERTIES FOR DROPDOWN ─────────────
async function loadProps() {
  try {
    const { data } = await db
      .from('properties')
      .select('id,bhk,location,city,price')
      .eq('agent_id', currentAgent.id)
      .eq('status', 'available');

    const sel = document.getElementById('v-property');
    sel.innerHTML = '<option value="">Select property...</option>';
    (data || []).forEach(p => {
      const o = document.createElement('option');
      o.value = o.textContent = `${p.bhk} — ${p.location}${p.city?', '+p.city:''} (₹${p.price}L)`;
      sel.appendChild(o);
    });
  } catch(e) { console.error('Props error:', e.message); }
}

// ── STATS ─────────────────────────────────────
function updateStats() {
  const tod = new Date().toDateString();
  const pending   = allVisits.filter(v => v.status === 'pending').length;
  const confirmed = allVisits.filter(v => v.status === 'confirmed').length;
  const done      = allVisits.filter(v => v.status === 'done').length;
  const today     = allVisits.filter(v => v.scheduled_at && new Date(v.scheduled_at).toDateString() === tod).length;

  document.getElementById('s-pending').textContent   = pending;
  document.getElementById('s-confirmed').textContent = confirmed;
  document.getElementById('s-today').textContent     = today;
  document.getElementById('s-done').textContent      = done;
  document.getElementById('pending-badge').textContent = pending;
}

// ── TAB COUNTS ────────────────────────────────
function updateTabCounts() {
  const tod = new Date().toDateString();
  document.getElementById('fc-all').textContent       = allVisits.length;
  document.getElementById('fc-pending').textContent   = allVisits.filter(v => v.status === 'pending').length;
  document.getElementById('fc-confirmed').textContent = allVisits.filter(v => v.status === 'confirmed').length;
  document.getElementById('fc-today').textContent     = allVisits.filter(v => v.scheduled_at && new Date(v.scheduled_at).toDateString() === tod).length;
  document.getElementById('fc-done').textContent      = allVisits.filter(v => v.status === 'done').length;
  document.getElementById('fc-cancelled').textContent = allVisits.filter(v => v.status === 'cancelled').length;
}

// ── FILTER ────────────────────────────────────
function filterVisits(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  render(f);
}

// ── RENDER ────────────────────────────────────
function render(filter) {
  const area = document.getElementById('visits-area');
  const tod  = new Date().toDateString();

  let list = [...allVisits];
  if (filter === 'pending')   list = list.filter(v => v.status === 'pending');
  if (filter === 'confirmed') list = list.filter(v => v.status === 'confirmed');
  if (filter === 'done')      list = list.filter(v => v.status === 'done');
  if (filter === 'cancelled') list = list.filter(v => v.status === 'cancelled');
  if (filter === 'today')     list = list.filter(v => v.scheduled_at && new Date(v.scheduled_at).toDateString() === tod);

  if (!list.length) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-glow">📅</div>
        <div class="empty-title">No visits ${filter === 'all' ? 'yet' : 'in this category'}</div>
        <div class="empty-sub">${filter === 'all' ? 'Book your first visit or let the AI agent book automatically when buyers request.' : `No ${filter} visits right now.`}</div>
        ${filter === 'all' ? `<button class="book-btn" onclick="openModal()" style="margin-top:0;">+ Book First Visit</button>` : ''}
      </div>`;
    return;
  }

  area.innerHTML = list.map((v, i) => {
    const dt      = v.scheduled_at ? new Date(v.scheduled_at) : null;
    const dayNum  = dt ? dt.getDate() : '?';
    const monStr  = dt ? dt.toLocaleString('en-IN', { month:'short' }).toUpperCase() : '';
    const timeStr = dt ? dt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '?';
    const isToday = dt && dt.toDateString() === tod;

    return `
    <div class="visit-card s-${v.status||'pending'}" onclick="openDetail('${v.id}')" style="animation-delay:${i*0.05}s">
      <div class="v-date-box">
        <div class="v-day">${dayNum}</div>
        <div class="v-month">${monStr}</div>
      </div>
      <div class="v-info">
        <div class="v-buyer">
          ${v.buyer_name || 'Unknown Buyer'}
          ${isToday ? '<span class="today-tag">TODAY</span>' : ''}
        </div>
        <div class="v-phone">${v.buyer_phone || '—'}</div>
        <div class="v-prop">🏠 ${v.property || 'Property not specified'}</div>
      </div>
      <div class="v-time">⏰ ${timeStr}</div>
      <div class="v-status badge-${v.status||'pending'}">${statusLabel(v.status)}</div>
      <div class="v-actions" onclick="event.stopPropagation()">
        ${actionBtns(v)}
      </div>
    </div>`;
  }).join('');
}

// ── ACTION BUTTONS ────────────────────────────
function actionBtns(v) {
  if (v.status === 'pending') return `
    <button class="vbtn v-confirm" onclick="setStatus('${v.id}','confirmed')">✅ Confirm</button>
    <button class="vbtn v-cancel"  onclick="setStatus('${v.id}','cancelled')">✗</button>`;
  if (v.status === 'confirmed') return `
    <button class="vbtn v-done"   onclick="setStatus('${v.id}','done')">🏆 Done</button>
    <button class="vbtn v-cancel" onclick="setStatus('${v.id}','cancelled')">✗</button>`;
  if (v.status === 'done') return `
    <button class="vbtn" onclick="editVisit('${v.id}');event.stopPropagation()">✏️</button>`;
  if (v.status === 'cancelled') return `
    <button class="vbtn v-confirm" onclick="setStatus('${v.id}','pending')">↩ Reopen</button>`;
  return '';
}

// ── STATUS UPDATE ─────────────────────────────
async function setStatus(id, status) {
  try {
    const { error } = await db.from('visits').update({ status }).eq('id', id);
    if (error) throw error;
    await loadVisits();
    closeDetail();
  } catch(e) { alert(e.message); }
}

// ── OPEN DETAIL PANEL ─────────────────────────
function openDetail(id) {
  const v  = allVisits.find(x => x.id === id);
  if (!v) return;

  const dt      = v.scheduled_at ? new Date(v.scheduled_at) : null;
  const dateStr = dt ? dt.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—';
  const timeStr = dt ? dt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—';

  document.getElementById('d-title').textContent = v.buyer_name || 'Visit Details';
  document.getElementById('d-sub').textContent   = `${statusLabel(v.status)} · ${v.property || ''}`;

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Buyer Info</div>
      <div class="detail-row"><span class="d-key">Name</span><span class="d-value">${v.buyer_name||'—'}</span></div>
      <div class="detail-row"><span class="d-key">Phone</span><span class="d-value">${v.buyer_phone||'—'}</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Visit Info</div>
      <div class="detail-row"><span class="d-key">Property</span><span class="d-value">${v.property||'—'}</span></div>
      <div class="detail-row"><span class="d-key">Date</span><span class="d-value">${dateStr}</span></div>
      <div class="detail-row"><span class="d-key">Time</span><span class="d-value">${timeStr}</span></div>
      <div class="detail-row"><span class="d-key">Status</span><span class="d-value">${statusLabel(v.status)}</span></div>
      <div class="detail-row"><span class="d-key">Booked By</span><span class="d-value">${v.booked_by||'Agent'}</span></div>
    </div>
    ${v.notes ? `<div class="detail-section"><div class="detail-section-title">Notes</div><div class="detail-notes">${v.notes}</div></div>` : ''}
  `;

  document.getElementById('detail-foot').innerHTML = actionBtns(v).replace(/onclick="/g, `onclick="`) +
    `<button class="mbtn cancel" onclick="editVisit('${v.id}');closeDetail()">✏️ Edit</button>
     <button class="mbtn cancel" onclick="closeDetail()">Close</button>`;

  document.getElementById('detail-overlay').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
}

// ── SAVE VISIT ────────────────────────────────
async function saveVisit() {
  const name     = document.getElementById('v-name').value.trim();
  const phone    = document.getElementById('v-phone').value.trim();
  const property = document.getElementById('v-property').value;
  const date     = document.getElementById('v-date').value;
  const time     = document.getElementById('v-time').value;
  const notes    = document.getElementById('v-notes').value.trim();

  if (!name)     return showMsg('Please enter buyer name', 'error');
  if (!phone)    return showMsg('Please enter buyer phone', 'error');
  if (!property) return showMsg('Please select a property', 'error');
  if (!date)     return showMsg('Please select visit date', 'error');

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Saving...';

  const payload = {
    agent_id:     currentAgent.id,
    buyer_name:   name,
    buyer_phone:  phone,
    property,
    scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
    status:       'pending',
    notes:        notes || null,
    booked_by:    'agent'
  };

  try {
    if (editingId) {
      const { error } = await db.from('visits').update(payload).eq('id', editingId);
      if (error) throw error;
      showMsg('✅ Visit updated!', 'success');
    } else {
      const { error } = await db.from('visits').insert([payload]);
      if (error) throw error;
      showMsg('✅ Visit booked successfully!', 'success');
    }
    await loadVisits();
    setTimeout(closeModal, 1000);
  } catch(e) { showMsg(e.message, 'error'); }

  btn.disabled = false;
  btn.textContent = '📅 Book Visit';
}

// ── EDIT ──────────────────────────────────────
function editVisit(id) {
  const v = allVisits.find(x => x.id === id);
  if (!v) return;
  editingId = id;
  document.getElementById('modal-title-text').textContent = 'Edit Visit';
  document.getElementById('v-name').value     = v.buyer_name  || '';
  document.getElementById('v-phone').value    = v.buyer_phone || '';
  document.getElementById('v-property').value = v.property    || '';
  document.getElementById('v-notes').value    = v.notes       || '';
  if (v.scheduled_at) {
    const d = new Date(v.scheduled_at);
    document.getElementById('v-date').value = d.toISOString().split('T')[0];
    document.getElementById('v-time').value = d.toTimeString().slice(0,5);
  }
  document.getElementById('modal').classList.add('open');
}

// ── MODAL HELPERS ─────────────────────────────
function openModal() {
  editingId = null;
  document.getElementById('modal-title-text').textContent = 'Book Site Visit';
  clearForm();
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
  clearForm();
}

function overlayClick(e, id) {
  if (e.target === document.getElementById(id)) {
    if (id === 'modal') closeModal();
    else closeDetail();
  }
}

function clearForm() {
  ['v-name','v-phone','v-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('v-property').value = '';
  document.getElementById('v-time').value     = '11:00';
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  document.getElementById('v-date').value = tom.toISOString().split('T')[0];
  showMsg('','');
}

function showMsg(msg, type) {
  const el = document.getElementById('modal-msg');
  el.textContent = msg;
  el.className = `msg-bar ${type}`;
}

// ── HELPERS ───────────────────────────────────
function statusLabel(s) {
  return {pending:'⏳ Pending', confirmed:'✅ Confirmed', done:'🏆 Done', cancelled:'❌ Cancelled'}[s] || s;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDetail(); }
});
