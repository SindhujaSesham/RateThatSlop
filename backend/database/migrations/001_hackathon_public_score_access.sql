-- Apply this migration to the deployed Supabase project.
-- Score reads and writes are intentionally public for the hackathon demo.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patterns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_snapshots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_analyses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patterns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_analyses TO service_role;

ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_score_pattern_access ON public.patterns;
CREATE POLICY public_score_pattern_access ON public.patterns
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS public_score_snapshot_access ON public.score_snapshots;
CREATE POLICY public_score_snapshot_access ON public.score_snapshots
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS public_score_image_access ON public.image_analyses;
CREATE POLICY public_score_image_access ON public.image_analyses
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);
