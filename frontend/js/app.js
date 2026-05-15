const { createClient } = supabase;

window.db = createClient(
  'https://zejcequtmrmetogbxudz.supabase.co',
  'sb_publishable_MDKa6Y4VCUoVA_UeBdaQ8w_93qDws5E'
);

// ── ROUTES ───
const routes = {
  dashboard: '/portal',
  conversations: '/conversation',
  leads: '/all-leads',
  followups: '/followups',
  visits: '/site-visits',
  billing: '/billing',
  settings: '/settings'
};

// ── GLOBALS ───────
window.currentAgent = null;
// ── INIT APP ─────────

window.initApp = async function () {

  try {

    const {
      data: { session }
    } = await db.auth.getSession();

    // No session
    if (!session) {
      window.location.href =
        "/frontend/pages/agent-portal.html";
      return;
    }

    const user = session.user;

    // Load agent profile
    const {
      data,
      error
    } = await db
      .from('agents')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error(
        'Agent fetch error:',
        error.message
      );
    }

    window.currentAgent =
      data || {
        id: user.id,
        name: user.email,
        city: "Nashik",
        plan: "free"
      };

    console.log(
      '✅ Agent loaded:',
      window.currentAgent
    );

    return window.currentAgent;

  } catch (err) {
    console.error(
      'initApp error:',
      err.message
    );

    return null;
  }
};

// ── LOGOUT ───────
window.logout = async function () {
  await db.auth.signOut();
  window.location.href = "/frontend/pages/agent-portal.html";
};

// ── NAVIGATION ───────
window.goTo = function (route) {
  if (routes[route]) {
    window.location.href =
      routes[route];
  }
};

// ── HELPERS ────────
window.formatDate = function (date) {
  if (!date) return '—';
  return new Date(date)
    .toLocaleDateString(
      'en-IN',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }
    );
};

window.formatTime = function (time) {
  if (!time) return '—';
  return time.slice(0,5);
};

window.formatCurrency = function (value) {
  if (!value) return '—';
  return new Intl.NumberFormat(
    'en-IN',
    { style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }
  ).format(value);
};
