let properties = [];
let editingId = null;


// ─────────────────────────
// INIT
// ─────────────────────────
initApp().then(async () => {
  renderSidebar();
  await loadProperties();
});


// ─────────────────────────
// SIDEBAR
// ─────────────────────────
function renderSidebar() {
  const initials = currentAgent.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  document.getElementById('sb-avatar').textContent = initials;
  document.getElementById('sb-name').textContent = currentAgent.name;
  document.getElementById('sb-plan').textContent =
    `${currentAgent.plan} · ${currentAgent.city}`;
}


// ─────────────────────────
// LOAD
// ─────────────────────────
window.loadProperties = async function () {

  const { data, error } = await db
    .from('properties')
    .select('*')
    .eq('agent_id', currentAgent.id);

  if (error) return console.error(error);

  properties = data || [];

  renderProperties();
};


// ─────────────────────────
// RENDER
// ─────────────────────────
function renderProperties() {

  const grid = document.getElementById('prop-grid');

  if (!properties.length) {
    grid.innerHTML = "<p>No properties</p>";
    return;
  }

  grid.innerHTML = properties.map(p => `
    <div class="card">
      <h3>${p.bhk || 'Plot'}</h3>
      <p>${p.location}</p>
      <p>₹${p.price}</p>
      <button onclick="editProperty('${p.id}')">Edit</button>
      <button onclick="deleteProperty('${p.id}')">Delete</button>
    </div>
  `).join('');
}


// ─────────────────────────
// SAVE
// ─────────────────────────
window.saveProperty = async function () {

  const payload = {
    agent_id: currentAgent.id,
    type: document.getElementById('f-type').value,
    bhk: document.getElementById('f-bhk').value,
    price: parseInt(document.getElementById('f-price').value),
    location: document.getElementById('f-location').value
  };

  if (editingId) {
    await db.from('properties').update(payload).eq('id', editingId);
  } else {
    await db.from('properties').insert([payload]);
  }

  await loadProperties();
};


// ─────────────────────────
// DELETE
// ─────────────────────────
window.deleteProperty = async function (id) {
  await db.from('properties').delete().eq('id', id);
  await loadProperties();
};


// ─────────────────────────
// EDIT
// ─────────────────────────
window.editProperty = function (id) {
  const p = properties.find(x => x.id === id);
  editingId = id;

  document.getElementById('f-type').value = p.type;
  document.getElementById('f-bhk').value = p.bhk;
  document.getElementById('f-price').value = p.price;
  document.getElementById('f-location').value = p.location;
};


// ─────────────────────────
// MODAL
// ─────────────────────────
window.openModal = function () {
  document.getElementById('modal').style.display = 'block';
};

window.closeModal = function () {
  document.getElementById('modal').style.display = 'none';
};
