
// ── RAZORPAY ──
const RAZORPAY_KEY = 'rzp_live_SiRzzkBb3FKaQQ';

let currentPlan = 'pro';

// ✅ OPEN MODAL (FIXED)
window.openModal = function(plan)) {
  currentPlan = plan;
  document.getElementById('modal').classList.add('open');
  document.getElementById('signup-screen').style.display = 'block';
  document.getElementById('success-screen').classList.remove('show');
  document.body.style.overflow = 'hidden';

  const isFree = plan === 'free';

  document.getElementById('modal-plan-label').textContent =
    isFree ? '🟢 Starter — Free Forever' : '⚡ Pro Agent — ₹999/month';

  document.getElementById('order-summary').innerHTML = isFree ? `
    <div class="order-row"><span class="order-label">Plan</span><span>Starter</span></div>
    <div class="order-row"><span class="order-label">Features</span><span>50 replies/month</span></div>
    <div class="order-row total"><span>Due today</span><span style="color:var(--green-light)">₹0 — Free</span></div>
  ` : `
    <div class="order-row"><span class="order-label">Plan</span><span>Pro Agent</span></div>
    <div class="order-row"><span class="order-label">Trial period</span><span>14 days free</span></div>
    <div class="order-row"><span class="order-label">After trial</span><span>₹999/month</span></div>
    <div class="order-row total"><span>Due today</span><span>₹0</span></div>
  `;

  document.getElementById('pay-btn').textContent =
    isFree ? '✅ Create Free Account' : '🚀 Start Free Trial';
}

// ✅ CLOSE MODAL
window.closeModal = function() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

window.handleOverlayClick = function(e) {
  if (e.target.id === 'modal') closeModal();
}

// ✅ VALIDATION
function validate() {
  const fname = document.getElementById('f-fname').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const city  = document.getElementById('f-city').value;
  const password = document.getElementById('f-password').value;

  if (!fname) return alert('Enter first name'), false;
  if (!phone || phone.length < 8) return alert('Invalid phone'), false;
  if (!email || !email.includes('@')) return alert('Invalid email'), false;
  if (!password || password.length < 6) return alert('Min 6 char password'), false;
  if (!city) return alert('Select city'), false;

  return true;
}

// ✅ SIGNUP FLOW
window.handleSignup = async function() {
  if (!validate()) return;

  const fname = document.getElementById('f-fname').value.trim();
  const lname = document.getElementById('f-lname').value.trim();
  const name = fname + ' ' + lname;
  const phone = document.getElementById('f-phone').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const city  = document.getElementById('f-city').value;

  if (currentPlan === 'free') {
    await createUser(name, phone, email, city);
  } else {
    startPayment(name, phone, email, city);
  }
}

// ✅ FIXED USER CREATION
async function createUser(name, phone, email, city) {
  try {
    const password = document.getElementById('f-password').value;

    const { data, error } = await db.auth.signUp({
      email: email,
      password: password
    });

    if (error) throw error;

    const userId = data.user.id;

    const expiry = getPlanExpiry(currentPlan);

    const { error: insertError }=await db.from('agents').insert([{
      id: userId,
      name,
      phone,
      email,
      city,
      plan: currentPlan,
      status: 'active',
      plan_expiry: expiry,
      trial_start: new Date().toISOString()
    }]);
    if (insertError) {
      console.error(" AGENT INSERT ERROR:", insertError);
      alert(insertError.message);
    }
    showSuccess(name, phone, email, city, currentPlan);

    // ✅ REDIRECT AFTER SUCCESS
    setTimeout(() => {
      window.location.href = "/portal";
    }, 2000);

  } catch (err) {
    alert(err.message);
  }
}

// ✅ EXPIRY
function getPlanExpiry(plan) {
  const now = new Date();
  if (plan === "free") now.setDate(now.getDate() + 7);
  else now.setDate(now.getDate() + 30);
  return now.toISOString();
}

// ✅ PAYMENT
function startPayment(name, phone, email, city) {
  const options = {
    key: RAZORPAY_KEY,
    amount: 100,
    currency: "INR",
    name: "PropBot AI",

    handler: async function () {
      await createUser(name, phone, email, city);
    },

    prefill: { name, email, contact: phone },
    theme: { color: "#22c55e" }
  };

  new Razorpay(options).open();
}

// ✅ SUCCESS UI
function showSuccess(name, phone, email, city, plan) {
  document.getElementById('signup-screen').style.display = 'none';
  const ss = document.getElementById('success-screen');
  ss.classList.add('show');

  document.getElementById('success-details').innerHTML = `
    <div class="success-detail-row"><span>Name</span><span>${name}</span></div>
    <div class="success-detail-row"><span>Phone</span><span>${phone}</span></div>
    <div class="success-detail-row"><span>City</span><span>${city}</span></div>
    <div class="success-detail-row"><span>Plan</span><span>${plan}</span></div>
    <div class="success-detail-row"><span>Status</span><span>✅ Active</span></div>
  `;
}

// ESC close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
