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
