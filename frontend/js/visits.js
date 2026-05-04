-- ═══════════════════════════════════════════════════
-- visitsjs PROPBOT AI — Visits Table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS visits (
  id           uuid default gen_random_uuid() primary key,
  agent_id     uuid references auth.users(id) on delete cascade,
  buyer_name   text,
  buyer_phone  text,
  property     text,
  scheduled_at timestamp,
  status       text default 'pending',
  notes        text,
  booked_by    text default 'agent',
  created_at   timestamp default now()
);

-- Enable RLS
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Agent sees only their visits
CREATE POLICY "Agent manages own visits"
  ON visits FOR ALL
  USING (agent_id = auth.uid());

-- Webhook can insert visits
CREATE POLICY "Service inserts visits"
  ON visits FOR INSERT
  WITH CHECK (true);
