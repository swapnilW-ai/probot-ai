// ───────── SUPABASE ─────────
const SUPABASE_URL = 'https://zejcequtmrmetogbxudz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MDKa6Y4VCUoVA_UeBdaQ8w_93qDws5E';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ───────── RAZORPAY ─────────
const RAZORPAY_KEY = 'rzp_live_SiRzzkBb3FKaQQ';

let currentPlan = 'pro';

// ───────── MODAL ─────────
window.openModal = function(plan) {
  currentPlan = plan;

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('signup-screen').style.display = 'block';
  document.getElementById('success-screen').classList.remove('show');

  const isFree = plan === 'free';

  document.getElementById('modal-plan-label').textContent =
    isFree ? '🟢 Starter — Free Forever' : '⚡ Pro Agent — ₹999/month';

  document.getElementById('pay-btn').textContent =
    isFree ? 'Create Free Account' : 'Start Free Trial';
};

window.closeModal = function() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
};

window.handleOverlayClick = function(e) {
  if (e.target.id === 'modal') closeModal();
};

// ───────── VALIDATION ─────────
function validate() {
  const email = document.getElementById('f-email').value;
  const pass = document.getElementById('f-password').value;

  if (!email || !pass) {
    alert("Enter email & password");
    return false;
  }
  return true;
}

// ───────── SIGNUP ─────────
window.handleSignup = async function() {
  if (!validate()) return;

  const email = document.getElementById('f-email').value;
  const password = document.getElementById('f-password').value;

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) return alert(error.message);

  showSuccess(email);
};

// ───────── SUCCESS ─────────
function showSuccess(email) {
  document.getElementById('signup-screen').style.display = 'none';
  document.getElementById('success-screen').classList.add('show');

  document.getElementById('success-details').innerHTML =
    `<div>Email: ${email}</div>`;

  setTimeout(() => {
    window.location.href = "/portal";
  }, 2000);
}

// ESC close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
