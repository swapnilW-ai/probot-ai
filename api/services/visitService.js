
export async function generateSlots(agentId, date) {
  const slots = ["11:00", "13:00", "15:00", "17:00"];

  const { data: visits } = await db
    .from("visits")
    .select("scheduled_at")
    .eq("agent_id", agentId);

  const bookedTimes = (visits || []).map(v =>
    new Date(v.scheduled_at).toTimeString().slice(0, 5)
  );

  return slots.filter(s => !bookedTimes.includes(s));
}
