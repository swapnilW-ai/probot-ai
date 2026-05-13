// backend/followupService.js

export async function generateAIFollowup(
  lead,
  aiResult
) {

  const next = new Date();

  next.setHours(
    next.getHours() +
    aiResult.next_followup_hours
  );

  return {

    lead_id: lead.id,

    agent_id: lead.agent_id,

    followup_date:
      next.toISOString().split('T')[0],

    followup_time:
      next.toTimeString().slice(0, 5),

    followup_type:
      aiResult.followup_type,

    priority:
      aiResult.priority,

    ai_generated: true,

    ai_reason:
      aiResult.reason,

    status: 'pending'
  };
  //auto followup creation
  async function createAIFollowup(lead, aiData) {

  const next = new Date();

  next.setHours(
    next.getHours() + aiData.next_followup_hours
  );

  await supabase
    .from('followups')
    .insert([
      {
        lead_id: lead.id,
        agent_id: lead.agent_id,

        followup_date:
          next.toISOString().split('T')[0],

        followup_time:
          next.toTimeString().slice(0, 5),

        followup_type:
          aiData.followup_type,

        priority:
          aiData.priority,

        ai_generated: true,

        ai_reason:
          aiData.ai_reason
      }
    ]);
}
}
