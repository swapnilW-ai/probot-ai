// 🔥 FINAL VERSION (dynamic + date aware)

export async function generateSlots(agentId, date) {

  // Full day range
  const start = new Date(date + "T00:00:00");
  const end   = new Date(date + "T23:59:59");

  // Fetch ONLY that day's visits
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/visits?agent_id=eq.${agentId}&scheduled_at=gte.${start.toISOString()}&scheduled_at=lte.${end.toISOString()}&select=scheduled_at`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  const visits = await res.json();

  // Define working hours (customizable)
  const workingHours = [
    "09:00","10:00","11:00","12:00",
    "14:00","15:00","16:00","17:00","18:00"
  ];

  // Extract booked times
  const bookedTimes = (visits || []).map(v =>
    new Date(v.scheduled_at).toTimeString().slice(0, 5)
  );

  // Remove booked slots
  const available = workingHours.filter(t => !bookedTimes.includes(t));

  return available;
}
