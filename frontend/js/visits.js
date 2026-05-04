// ═══════════════════════════════════════════════════════
// PROPBOT AI — visits.js
// Complete site visit management
// ═══════════════════════════════════════════════════════

let allVisits    = [];
let currentFilter = 'all';
let editingVisitId = null;

// ── INIT ─────────────────────────────────────────────
initApp().then(async () => {
  if (!currentAgent) return;

  // Set sidebar agent info
  const initials = currentAgent.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  document.getElementById('agent-avatar').textContent = initials;
  document.getElementById('agent-name').textContent   = currentAgent.name || currentAgent.email;
  document.getElementById('agent-plan').textContent   = `${(currentAgent.plan || 'PRO').toUpperCase()} · ${currentAgent.city || ''}`;

  // Set date in topbar
  document.getElementById('top-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  // Set default visit date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('v-date').value = tomorrow.toISOString().split('T')[0];

  await Promise.all([
    loadVisits(),
    loadPropertiesForDropdown()
  ]);
});

// ── LOAD VISITS FROM SUPABASE ─────────────────────────
async function loadVisits() {
  try {
    const { data, error } = await db
      .from('visits')
      .select('*')
      .eq('agent_id', currentAgent.id)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    allVisits = data || [];
    console.log(`✅ Visits loaded: ${allVisits.length}`);

    updateStats();
    renderVisits(currentFilter);

  } catch(e) {
    console.error('loadVisits error:', e.message);
    document.getElementById('visits-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Could not load visits</div>
        <div class="empty-sub">${e.message}</div>
      </div>`;
  }
}

// ── LOAD PROPERTIES FOR DROPDOWN ─────────────────────
async function loadPropertiesForDropdown() {
  try {
    const { data } = await db
      .from('properties')
      .select('id, bhk, location, city, price')
      .eq('agent_id', currentAgent.id)
      .eq('status', 'available');

    const select = document.getElementById('v-property');
    select.innerHTML = '<option value="">Select property...</option>';

    (data || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = `${p.bhk} - ${p.location}${p.city ? ', ' + p.city : ''} (₹${p.price}L)`;
      opt.textContent = opt.value;
      select.appendChild(opt);
    });

  } catch(e) {
    console.error('Properties dropdown error:', e.message);
  }
}

// ── UPDATE STATS ──────────────────────────────────────
function updateStats() {
  const today = new Date().toDateString();

  const pending   = allVisits.filter(v => v.status === 'pending').length;
  const confirmed = allVisits.filter(v => v.status === 'confirmed').length;
  const done      = allVisits.filter(v => v.status === 'done').length;
  const todayCount = allVisits.filter(v => {
    return v.scheduled_at && new Date(v.scheduled_at).toDateString() === today;
  }).length;

  document.getElementById('s-pending').textContent   = pending;
  document.getElementById('s-confirmed').textContent = confirmed;
  document.getElementById('s-today').textContent     = todayCount;
  document.getElementById('s-done').textContent      = done;
  document.getElementById('pending-badge').textContent = pending;
}

// ── FILTER VISITS ─────────────────────────────────────
window.filterVisits = function(filter, btn) {
  currentFilter = filter;

  // Update tab styles
  document.querySelectorAll('.vtab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  renderVisits(filter);
};

// ── RENDER VISITS ─────────────────────────────────────
function renderVisits(filter) {
  const list = document.getElementById('visits-list');
  const today = new Date().toDateString();

  let filtered = [...allVisits];

  if (filter === 'pending')   filtered = filtered.filter(v => v.status === 'pending');
  if (filter === 'confirmed') filtered = filtered.filter(v => v.status === 'confirmed');
  if (filter === 'done')      filtered = filtered.filter(v => v.status === 'done');
  if (filter === 'cancelled') filtered = filtered.filter(v => v.status === 'cancelled');
  if (filter === 'today')     filtered = filtered.filter(v => v.scheduled_at && new Date(v.scheduled_at).toDateString() === today);

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-title">No visits found</div>
        <div class="empty-sub">
          ${filter === 'all'
            ? 'No site visits yet. Book your first visit or let the AI agent book one automatically.'
            : `No ${filter} visits right now.`}
        </div>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(v => {
    const date      = v.scheduled_at ? new Date(v.scheduled_at) : null;
    const dayNum    = date ? date.getDate() : '?';
    const monthStr  = date ? date.toLocaleString('en-IN', { month: 'short' }).toUpperCase() : '';
    const timeStr   = date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '?';
    const isToday   = date && date.toDateString() === today;

    return `
    <div class="visit-card status-${v.status || 'pending'}" onclick="openDetail('${v.id}')">

      <div class="visit-date-box">
        <div class="vdate-day">${dayNum}</div>
        <div class="vdate-month">${monthStr}</div>
      </div>

      <div class="visit-info">
        <div class="visit-buyer">
          ${v.buyer_name || 'Unknown Buyer'}
          ${isToday ? '<span style="font-size:0.65rem;background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 6px;border-radius:4px;font-weight:700;">TODAY</span>' : ''}
        </div>
        <div class="visit-phone">${v.buyer_phone || '—'}</div>
        <div class="visit-property">🏠 ${v.property || 'Property not specified'}</div>
      </div>

      <div class="visit-time-badge">⏰ ${timeStr}</div>

      <div class="visit-status badge-${v.status || 'pending'}">
        ${statusLabel(v.status)}
      </div>

      <div class="visit-actions" onclick="event.stopPropagation()">
        ${actionButtons(v)}
      </div>

    </div>`;
  }).join('');
}

// ── ACTION BUTTONS PER STATUS ─────────────────────────
function actionButtons(v) {
  if (v.status === 'pending') return `
    <button class="vbtn confirm-btn" onclick="updateStatus('${v.id}', 'confirmed')">✅ Confirm</button>
    <button class="vbtn cancel-btn"  onclick="updateStatus('${v.id}', 'cancelled')">✗ Cancel</button>`;

  if (v.status === 'confirmed') return `
    <button class="vbtn done-btn"   onclick="updateStatus('${v.id}', 'done')">🏆 Done</button>
    <button class="vbtn cancel-btn" onclick="updateStatus('${v.id}', 'cancelled')">✗ Cancel</button>`;

  if (v.status === 'done') return `
    <button class="vbtn" onclick="editVisit('${v.id}')">✏️ Edit</button>`;

  if (v.status === 'cancelled') return `
    <button class="vbtn confirm-btn" onclick="updateStatus('${v.id}', 'pending')">↩ Reopen</button>`;

  return '';
}

// ── STATUS LABEL ──────────────────────────────────────
function statusLabel(s) {
  const map = { pending: '⏳ Pending', confirmed: '✅ Confirmed', done: '🏆 Done', cancelled: '❌ Cancelled' };
  return map[s] || s;
}

// ── UPDATE VISIT STATUS ───────────────────────────────
window.updateStatus = async function(id, newStatus) {
  try {
    const { error } = await db
      .from('visits')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) throw error;

    console.log(`✅ Visit ${id} → ${newStatus}`);
    await loadVisits();

  } catch(e) {
    alert('Error: ' + e.message);
  }
};

// ── OPEN DETAIL PANEL ─────────────────────────────────
window.openDetail = function(id) {
  const v    = allVisits.find(x => x.id === id);
  if (!v) return;

  const date = v.scheduled_at ? new Date(v.scheduled_at) : null;
  const dateStr = date
    ? date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const timeStr = date
    ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-row"><span class="detail-key">Buyer</span><span class="detail-value">${v.buyer_name || '—'}</span></div>
    <div class="detail-row"><span class="detail-key">Phone</span><span class="detail-value">${v.buyer_phone || '—'}</span></div>
    <div class="detail-row"><span class="detail-key">Property</span><span class="detail-value">${v.property || '—'}</span></div>
    <div class="detail-row"><span class="detail-key">Date</span><span class="detail-value">${dateStr}</span></div>
    <div class="detail-row"><span class="detail-key">Time</span><span class="detail-value">${timeStr}</span></div>
    <div class="detail-row"><span class="detail-key">Status</span><span class="detail-value">${statusLabel(v.status)}</span></div>
    <div class="detail-row"><span class="detail-key">Booked By</span><span class="detail-value">${v.booked_by || 'Agent'}</span></div>
    ${v.notes ? `<div class="detail-notes">📝 ${v.notes}</div>` : ''}
  `;

  document.getElementById('detail-foot').innerHTML = actionButtons(v)
    .replace(/onclick="updateStatus/g, `onclick="updateStatus`)
    + `<button class="vbtn" onclick="editVisit('${v.id}');closeDetail()">✏️ Edit</button>
       <button class="vbtn cancel-btn" onclick="closeDetail()">Close</button>`;

  document.getElementById('detail-panel').classList.add('open');
};

window.closeDetail = function(e) {
  if (!e || e.target === document.getElementById('detail-panel')) {
    document.getElementById('detail-panel').classList.remove('open');
  }
};

// ── SAVE VISIT ────────────────────────────────────────
window.saveVisit = async function() {
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

  // Combine date + time into ISO timestamp
  const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

  const payload = {
    agent_id:    currentAgent.id,
    buyer_name:  name,
    buyer_phone: phone,
    property:    property,
    scheduled_at: scheduledAt,
    status:      'pending',
    notes:       notes || null,
    booked_by:   'agent'
  };

  try {
    if (editingVisitId) {
      const { error } = await db.from('visits').update(payload).eq('id', editingVisitId);
      if (error) throw error;
      showMsg('✅ Visit updated!', 'success');
    } else {
      const { error } = await db.from('visits').insert([payload]);
      if (error) throw error;
      showMsg('✅ Visit booked!', 'success');
    }

    await loadVisits();
    setTimeout(closeModal, 1200);

  } catch(e) {
    showMsg(e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '📅 Book Visit';
};

// ── EDIT VISIT ────────────────────────────────────────
window.editVisit = function(id) {
  const v = allVisits.find(x => x.id === id);
  if (!v) return;

  editingVisitId = id;

  document.getElementById('modal-title').textContent = '✏️ Edit Visit';
  document.getElementById('v-name').value     = v.buyer_name  || '';
  document.getElementById('v-phone').value    = v.buyer_phone || '';
  document.getElementById('v-property').value = v.property    || '';
  document.getElementById('v-notes').value    = v.notes       || '';

  if (v.scheduled_at) {
    const d = new Date(v.scheduled_at);
    document.getElementById('v-date').value = d.toISOString().split('T')[0];
    document.getElementById('v-time').value = d.toTimeString().slice(0, 5);
  }

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

// ── MODAL HELPERS ─────────────────────────────────────
window.openModal = function() {
  editingVisitId = null;
  document.getElementById('modal-title').textContent = '📅 Book Site Visit';
  clearForm();
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  editingVisitId = null;
  clearForm();
};

window.handleOverlay = function(e) {
  if (e.target === document.getElementById('modal')) closeModal();
};

function clearForm() {
  ['v-name', 'v-phone', 'v-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('v-property').value = '';
  document.getElementById('v-time').value = '11:00';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('v-date').value = tomorrow.toISOString().split('T')[0];

  showMsg('', '');
}

function showMsg(msg, type) {
  const el = document.getElementById('modal-msg');
  el.textContent = msg;
  el.className = `msg-bar ${type}`;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDetail(); }
});
