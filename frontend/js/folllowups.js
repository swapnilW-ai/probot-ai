async function saveFollowup(leadId) {

  const payload = {
    lead_id: leadId,
    agent_id: currentAgent.id,

    followup_date:
      document.getElementById('followupDate').value,

    followup_time:
      document.getElementById('followupTime').value,

    followup_type:
      document.getElementById('followupType').value,

    priority:
      document.getElementById('followupPriority').value,

    note:
      document.getElementById('followupNote').value
  };

  const { error } = await supabase
    .from('followups')
    .insert([payload]);

  if (error) {
    console.error(error);
    return;
  }

  closeModal();
  loadFollowups();
}
// load followups
async function loadFollowups() {

  const today = new Date()
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('followups')
    .select(`
      *,
      leads(*)
    `)
    .gte('followup_date', today)
    .order('followup_date')
    .order('followup_time');

  if (error) {
    console.error(error);
    return;
  }

  renderFollowups(data || []);
}
function renderFollowups(followups) {

  const container = document.getElementById('followupsContainer');

  if (!container) return;

  // empty state
  if (!followups.length) {
    container.innerHTML = `
      <div class="empty-followups">
        No follow-ups found
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  followups.forEach(item => {

    const leadName =
      item.leads?.name ||
      item.leads?.full_name ||
      'Unknown Lead';

    const priorityClass =
      item.priority?.toLowerCase() || 'medium';

    const statusClass =
      item.status?.toLowerCase() || 'pending';

    const card = document.createElement('div');

    card.className =
      `followup-card ${priorityClass} ${statusClass}`;

    card.innerHTML = `

      <div class="followup-top">

        <div>
          <h3>${leadName}</h3>

          <p class="followup-type">
            ${item.followup_type || 'General Follow-Up'}
          </p>
        </div>

        <span class="priority-badge ${priorityClass}">
          ${item.priority || 'medium'}
        </span>

      </div>

      <div class="followup-body">

        <p>
          📅 ${item.followup_date || '-'}
        </p>

        <p>
          ⏰ ${item.followup_time || '-'}
        </p>

        <p>
          📝 ${item.note || 'No notes added'}
        </p>

        ${item.ai_generated ? `
          <div class="ai-badge">
            🤖 AI Generated
          </div>
        ` : ''}

      </div>

      <div class="followup-footer">

        <span class="status-badge ${statusClass}">
          ${item.status || 'pending'}
        </span>

        <div class="followup-actions">

          <button
            class="complete-btn"
            onclick="markFollowupComplete('${item.id}')"
          >
            Complete
          </button>

          <button
            class="reschedule-btn"
            onclick="openRescheduleModal('${item.id}')"
          >
            Reschedule
          </button>

        </div>

      </div>
    `;

    container.appendChild(card);

  });

}

//check due
function checkDueFollowups(
  followups
) {

  const now = new Date();

  followups.forEach(item => {

    const due =
      new Date(
        `${item.followup_date}
         ${item.followup_time}`
      );

    if (
      item.status === 'pending' &&
      due <= now
    ) {

      showReminderPopup(item);
    }
  });
}
