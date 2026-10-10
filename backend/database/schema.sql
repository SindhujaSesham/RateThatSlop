
-- RATE THAT SLOP DATABASE SCHEMA

-- 1. USER PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,

    display_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. SEWING PATTERNS
CREATE TABLE IF NOT EXISTS public.patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_platform TEXT NOT NULL,
    external_listing_id TEXT NOT NULL,
    listing_url TEXT,
    title TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (source_platform, external_listing_id)
);


-- 3. USER REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    pattern_id UUID NOT NULL
        REFERENCES public.patterns(id) ON DELETE CASCADE,

    pattern_tried BOOLEAN NOT NULL,
    garment_type TEXT,

    answers JSONB NOT NULL DEFAULT '{}'::jsonb,

    questionnaire_version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, pattern_id),

    CONSTRAINT valid_answers
        CHECK (jsonb_typeof(answers) = 'object'),

    CONSTRAINT valid_questionnaire_version
        CHECK (questionnaire_version > 0)
);


-- Index for retrieving reports about a pattern
CREATE INDEX IF NOT EXISTS idx_reports_pattern_id
ON public.reports(pattern_id);


-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
