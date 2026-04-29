
// properties.js file

let currentAgent = null;
let editingId = null;
let properties = [];

// ── INIT ──
(async () => {

  // ✅ 1. CHECK SESSION FIRST
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    location.href = '/portal';
    return;
  }

   currentAgent = session.user;

  //const currentAgent = session.user;

  // ✅ 2. LOAD PROFILE
  const { data: profile, error } = await db
    .from('agents')
    .select('*')
    .eq('id', currentAgent.id)
    .single();

  if (error || !profile) {
    alert("User profile not found");
    location.href = '/portal';
    return;
  }

  // ✅ 3. CHECK EXPIRY (NOW SAFE)
  if (!profile.plan_expiry || new Date(profile.plan_expiry) < new Date()) {
    alert("Your plan has expired. Please renew.");
    location.href = "/portal";
    return;
  }

  // ✅ 4. SET UI
  const initials = profile.name?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0,2)
    .toUpperCase() || '?';

  document.getElementById('sb-avatar').textContent = initials;
  document.getElementById('sb-name').textContent = profile.name;
  document.getElementById('sb-plan').textContent =
    `${profile.plan?.toUpperCase()} · ${profile.city}`;

  // Prefill
  document.getElementById('f-city').value = profile.city || '';

  // ✅ 5. LOAD DATA
  await loadProperties();

})();

// ── LOAD PROPERTIES ──
  async function loadProperties() {

  const { data: { user } } = await db.auth.getUser();

  if (!user) {
    console.log("User not logged in");
    return;
  }

  const agentId = user.id;

  console.log("Fetching agentId:", agentId);

  const { data, error } = await db
    .from('properties')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Load error:", error);
    return;
  }
  
  console.log("RAW DATA:", data);

  properties = Array.isArray(data) ? data : [];

  console.log("Properties loaded:", properties.length);

  renderProperties();
  updateStats();
  }  
  

// ── RENDER PROPERTIES ──
function renderProperties() {
  const grid = document.getElementById('prop-grid');

  if (!properties.length) {
    grid.innerHTML = `<div style="grid-column:1/-1">
      <div class="empty-state">
        <div class="empty-icon">🏗️</div>
        <div class="empty-title">No properties yet</div>
        <div class="empty-sub">Add your listings here. Your AI agent will use them to<br>suggest the right property to every buyer automatically.</div>
        <button class="add-btn" style="margin:0 auto;" onclick="openModal()">+ Add First Property</button>
      </div>
    </div>`;
    return;
  }

  grid.innerHTML = properties.map(p => `
    <div class="prop-card newcard">
      <div class="ai-badge">⚡ AI Active</div>
      <div class="prop-card-top">
        <div class="prop-header">
          <span class="prop-bhk">${p.bhk || '?'}</span>
          <span class="prop-status ${p.status||'available'}">${statusLabel(p.status)}</span>
        </div>
        <div class="prop-price">${formatPrice(p.price)}<sub> · ${p.type === 'plot'
          ? (p.area ? p.area + ' acres' : '')
          : (p.carpet_area
              ? p.carpet_area + ' sqft (carpet)'
              : '') +
            (p.super_area
              ? ' · ' + p.super_area + ' sqft (super)'
              : '')
}</sub></div>
        <div class="prop-location">📍 ${p.location}${p.city ? ', '+p.city : ''}</div>
        ${p.floor ? `<div class="prop-area">${p.floor}${p.facing ? ' · '+p.facing+' facing' : ''}</div>` : ''}
      </div>
      <div class="prop-card-body">
        ${p.amenities ? `<div class="prop-tags">${p.amenities.split(',').map(a=>`<span class="prop-tag">${a.trim()}</span>`).join('')}</div>` : ''}
        ${p.description ? `<div class="prop-desc">${p.description.slice(0,100)}${p.description.length>100?'...':''}</div>` : ''}
      </div>
      <div class="prop-card-foot">
        <button class="prop-action" onclick="editProperty('${p.id}')">✏️ Edit</button>
        <button class="prop-action" onclick="toggleStatus('${p.id}','${p.status}')">${p.status==='available'?'⏸ Hold':'✅ Activate'}</button>
        <button class="prop-action delete" onclick="deleteProperty('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ── UPDATE STATS ──
function updateStats() {
  const available = properties.filter(p=>p.status==='available'||!p.status).length;
  const sold = properties.filter(p=>p.status==='sold').length;
  const totalValue = properties.reduce((sum,p)=>sum+(parseFloat(p.price)||0),0);
  // Fix floating issue
  const cleanTotal = parseFloat(totalValue.toFixed(2));
  console.log('Stats:', {total: properties.length, available, sold, totalValue});
  document.getElementById('ps-total').textContent = properties.length;
  document.getElementById('ps-available').textContent = available;
  document.getElementById('ps-sold').textContent = sold;
  document.getElementById('ps-value').textContent = formatPrice(cleanTotal);
}

// ── SAVE PROPERTY ──
window.saveProperty = async function() {
    const bhk        = document.getElementById('f-bhk').value;
  const rawPrice = document.getElementById('f-price').value;
  const price = normalizePrice(rawPrice);
  const type = document.getElementById('f-type').value;
  let area = null;
  let carpet_area = null;
  let super_area = null;
  if (type === "plot") {
    area = parseFloat(document.getElementById('f-area').value) || null;
  } else {
    carpet_area = parseInt(document.getElementById('f-carpet').value) || null;
    super_area = parseInt(document.getElementById('f-super').value) || null;
  }
  const location   = document.getElementById('f-location').value.trim();
  const city       = document.getElementById('f-city').value.trim();
  const floor      = document.getElementById('f-floor').value.trim();
  const status     = document.getElementById('f-status').value;
  const amenities  = document.getElementById('f-amenities').value.trim();
  const description = document.getElementById('f-desc').value.trim();
  const facing     = document.getElementById('f-facing').value;
  const possession = document.getElementById('f-possession').value;

  if (type !== 'plot' && !bhk) {
  return showMsg('Please select BHK type', 'error');
  }
  if (!price || isNaN(price)) return showMsg('Please enter a valid price', 'error');
  if (!location) return showMsg('Please enter location', 'error');

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Saving...';

  const { data: { user } } = await db.auth.getUser();
  const agentId = user.id;

  console.log("Saving agentId:", agentId);

  const payload = {
    agent_id: agentId,
    type,
    bhk: type === 'plot' ? null : bhk,
    price,
    area,
    carpet_area,    
    super_area,     
    location,
    city,
    floor,
    status,
    amenities,
    description,
    facing,
    possession
  };

  try {
    if (editingId) {
      // UPDATE
      const { error } = await db
        .from('properties')
        .update(payload)
        .eq('id', editingId);

      if (error) throw error;

      showMsg('✅ Property updated!', 'success');

    } else {
      // INSERT
      const { error } = await db
        .from('properties')
        .insert([payload]);

      if (error) throw error;

      showMsg('✅ Property added!', 'success');
    }

    await loadProperties();
    setTimeout(closeModal, 1200);

  } catch (e) {
    showMsg(e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Save Property';
}
// ── EDIT ──
function editProperty(id) { openModal(id); }

// ── TOGGLE STATUS ──
async function toggleStatus(id, currentStatus) {
  const newStatus = currentStatus === 'available' ? 'hold' : 'available';
  await db.from('properties').update({ status: newStatus }).eq('id', id);
  await loadProperties();
}

// ── DELETE ──
async function deleteProperty(id) {
  if (!confirm('Delete this property? Your AI will stop suggesting it to buyers.')) return;
  await db.from('properties').delete().eq('id', id);
  await loadProperties();
}

// ── HELPERS ──
function statusLabel(s) {
  return s==='sold'?'Sold':s==='hold'?'On Hold':'Available';
}
function normalizePrice(value) {
  if (!value) return null;

  let v = value.toString().toLowerCase().trim();

  // If user types "1.2cr"
  if (v.includes("cr")) {
    return parseFloat(v) * 100;
  }

  // If user types "50l"
  if (v.includes("l")) {
    return parseFloat(v);
  }

  let num = parseFloat(v);

  if (isNaN(num)) return null; // ✅ FIX

  // Smart guess
  if (num <= 10) {
    return num * 100;
  }

  return num;
}
  function formatPrice(price) {
  if (!price) return "₹0";

  if (price >= 100) {
    let cr = (price / 100).toFixed(1); 
    return `₹${cr} Cr`;
  }

  return `₹${price} L`;
}
  function showMsg(msg, type) {
  const el = document.getElementById('modal-msg');
  el.textContent = msg;
  el.className = `msg-bar ${type}`;
}
  function handleTypeChange() {
  const type = document.getElementById("f-type").value;
  const bhk = document.getElementById("f-bhk");

  const plotBox = document.getElementById("plot-area-box");
  const builtBox = document.getElementById("built-area-box");

  if (type === "plot") {
    // Disable BHK
    bhk.value = "";
    bhk.disabled = true;
    // Show plot area
    plotBox.style.display = "block";
    builtBox.style.display = "none";

  } else if (type === "flat" || type === "villa") {
    // Enable BHK
    bhk.disabled = false;
    // Show built area
    plotBox.style.display = "none";
    builtBox.style.display = "block";
  }
}
document.addEventListener('keydown', e => { if(e.key==='Escape') window.closeModal(); });
  
// ── OPEN MODAL ──
window.openModal = function(id = null) {
  editingId = id;
  clearForm();

  if (id) {
    const p = properties.find(x=>x.id===id);
    if (p) {
      document.getElementById('modal-title').textContent = 'Edit Property';
      document.getElementById('f-bhk').value = p.bhk || '';
      document.getElementById('f-price').value = p.price || '';
      document.getElementById('f-area').value = p.area || '';
      document.getElementById('f-location').value = p.location || '';
      document.getElementById('f-city').value = p.city || '';
      document.getElementById('f-floor').value = p.floor || '';
      document.getElementById('f-status').value = p.status || 'available';
      document.getElementById('f-amenities').value = p.amenities || '';
      document.getElementById('f-desc').value = p.description || '';
      document.getElementById('f-facing').value = p.facing || '';
      document.getElementById('f-possession').value = p.possession || 'ready';
    }
  } else {
    document.getElementById('modal-title').textContent = 'Add New Property';
  }

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

console.log("JS LOADED");

window.handleOverlay = function(e) {
  if (e.target === document.getElementById('modal')) window.closeModal();
};

window.closeModal = function() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  editingId = null;
  clearForm();
};

window.clearForm = function() {
  ['f-bhk','f-price','f-area','f-location','f-floor','f-amenities','f-desc','f-facing'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('f-status').value = 'available';
  document.getElementById('f-possession').value = 'ready';

  showMsg('', '');  
};

 // (async () => {

 // const { data: { session } } = await db.auth.getSession();

 // if (!session) {
 //   console.log("No session, redirecting...");
 //   window.location.href = "/portal";
 //   return;
 // }

 // currentAgent = session.user;

 // console.log("Logged in:", currentAgent.id);

 // await loadProperties();

//})();

  window.logout = async function() {
  await db.auth.signOut();
  location.href = "/portal"; // better redirect to login page
};


