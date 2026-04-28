const { createClient } = supabase;

window.db = createClient(
  'https://zejcequtmrmetogbxudz.supabase.co',
  'sb_publishable_MDKa6Y4VCUoVA_UeBdaQ8w_93qDws5E'
);

window.currentAgent = null;

window.initApp = async function () {

  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = "/frontend/pages/agent-portal.html";
    return;
  }

  const user = session.user;

  const { data } = await db
    .from('agents')
    .select('*')
    .eq('id', user.id)
    .single();

  window.currentAgent = data || {
    id: user.id,
    name: user.email,
    city: "Nashik",
    plan: "free"
  };
};

window.logout = async function () {
  await db.auth.signOut();
  window.location.href = "/frontend/pages/agent-portal.html";
};
