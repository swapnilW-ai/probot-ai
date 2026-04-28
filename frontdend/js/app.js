// ─────────────────────────────────────────────
// SUPABASE INIT (GLOBAL SINGLE INSTANCE)
// ─────────────────────────────────────────────
const { createClient } = supabase;

window.db = createClient(
  'https://zejcequtmrmetogbxudz.supabase.co',
  'sb_publishable_MDKa6Y4VCUoVA_UeBdaQ8w_93qDws5E'
);

// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
window.currentAgent = null;


// ─────────────────────────────────────────────
// INIT APP (AUTH + PROFILE)
// ─────────────────────────────────────────────
window.initApp = async function () {
  try {
    const { data: { session } } = await db.auth.getSession();

    // 🔒 If not logged in → redirect to portal
    if (!session) {
      console.warn("No session → redirecting to portal");
      window.location.href = "/frontend/pages/agent-portal.html";
      return;
    }

    const user = session.user;

    // 🔍 Fetch agent profile
    const { data, error } = await db
      .from('agents')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    // ✅ Set global agent
    window.currentAgent = data || {
      id: user.id,
      name: user.email,
      city: 'N/A',
      plan: 'free'
    };

    console.log("✅ App initialized:", currentAgent);

  } catch (err) {
    console.error("Init error:", err.message);

    // fallback
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      window.currentAgent = {
        id: session.user.id,
        name: session.user.email,
        city: 'N/A',
        plan: 'free'
      };
    }
  }
};


// ─────────────────────────────────────────────
// LOGOUT (GLOBAL)
// ─────────────────────────────────────────────
window.logout = async function () {
  await db.auth.signOut();
  window.location.href = "/frontend/pages/agent-portal.html";
};


// ─────────────────────────────────────────────
// SAFE DOM HELPER
// ─────────────────────────────────────────────
window.$ = function (id) {
  return document.getElementById(id);
};


// ─────────────────────────────────────────────
// MESSAGE HELPER (GLOBAL UI FEEDBACK)
// ─────────────────────────────────────────────
window.showMsg = function (msg, type = "info") {
  const el = document.getElementById('msg');

  if (!el) return;

  el.textContent = msg;

  el.style.color =
    type === "error" ? "red" :
    type === "success" ? "green" :
    "#333";
};


// ─────────────────────────────────────────────
// AUTH GUARD (OPTIONAL EXTRA)
// ─────────────────────────────────────────────
window.requireAuth = async function () {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = "/frontend/pages/agent-portal.html";
    return false;
  }

  return true;
};


// ─────────────────────────────────────────────
// DATE FORMATTER (REUSABLE)
// ─────────────────────────────────────────────
window.formatDate = function (date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};


// ─────────────────────────────────────────────
// PRICE NORMALIZER (REUSABLE)
// ─────────────────────────────────────────────
window.normalizePrice = function (value) {
  if (!value) return null;

  return parseInt(value.toString().replace(/[^\d]/g, ''));
};


// ─────────────────────────────────────────────
// DEBUG LOGGER (OPTIONAL)
// ─────────────────────────────────────────────
window.log = function (...args) {
  console.log("[APP]", ...args);
};
