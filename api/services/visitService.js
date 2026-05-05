const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export async function generateSlots(agentId, date) {

  const start = new Date(`${date}T00:00:00.000Z`);
  const end   = new Date(`${date}T23:59:59.999Z`);

  const url = `${SUPABASE_URL}/rest/v1/visits?agent_id=eq.${agentId}&scheduled_at=gte.${encodeURIComponent(start.toISOString())}&scheduled_at=lte.${encodeURIComponent(end.toISOString())}&select=scheduled_at`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    }
  });

  const visits = await res.json();

  const workingHours = [
    "09:00","10:00","11:00","12:00",
    "14:00","15:00","16:00","17:00","18:00"
  ];

  const bookedTimes = (visits || []).map(v => {
    const d = new Date(v.scheduled_at);
    return d.toISOString().slice(11, 16);
  });

  return workingHours.filter(t => !bookedTimes.includes(t));
}
