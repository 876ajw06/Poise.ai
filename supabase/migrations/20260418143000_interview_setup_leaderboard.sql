-- Live interview setup fields + public leaderboard (no transcripts)

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS target_duration_min integer,
  ADD COLUMN IF NOT EXISTS interview_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resume_context text,
  ADD COLUMN IF NOT EXISTS session_kind text NOT NULL DEFAULT 'practice';

CREATE INDEX IF NOT EXISTS idx_interview_sessions_kind_created
  ON public.interview_sessions (user_id, session_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  display_name text,
  overall_score numeric NOT NULL,
  job_role text,
  company text,
  seniority text,
  duration_minutes integer,
  interview_modes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_entries_session_id_key UNIQUE (session_id)
);

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard entries are publicly readable"
  ON public.leaderboard_entries
  FOR SELECT
  USING (true);

CREATE POLICY "Users insert their own leaderboard rows"
  ON public.leaderboard_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score_created
  ON public.leaderboard_entries (overall_score DESC, created_at DESC);
