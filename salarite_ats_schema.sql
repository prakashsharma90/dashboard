-- Salarite ATS (Applicant Tracking System) Schema

-- 1. Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES auth.users(id), -- The employer/admin who created it
    title TEXT NOT NULL,
    department TEXT,
    location TEXT, -- Onsite / Remote / Hybrid
    job_location_type TEXT DEFAULT 'Onsite',
    employment_type TEXT, -- Full-time / Part-time / Internship
    experience_required TEXT,
    salary_range TEXT,
    description TEXT,
    responsibilities TEXT,
    skills_required TEXT[],
    qualifications TEXT,
    perks_benefits TEXT,
    openings_count INTEGER DEFAULT 1,
    deadline DATE,
    visibility TEXT DEFAULT 'Public', -- Public / Internal
    status TEXT DEFAULT 'Open', -- Open / Closed / Draft
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Candidates Table (Talent Pool)
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    resume_url TEXT,
    skills TEXT[],
    experience_years NUMERIC(4,1),
    current_location TEXT,
    current_company TEXT,
    expected_salary TEXT,
    tags TEXT[], -- e.g. ["Frontend", "React", "Senior"]
    talent_pool_status TEXT DEFAULT 'Active', -- Active / Archived
    ai_score INTEGER, -- Placeholder for AI matching score
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Job Applications (The Pipeline)
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    stage TEXT DEFAULT 'Applied', -- Applied, Screening, Shortlisted, Interview Scheduled, Interviewed, Selected, Rejected, Offered, Hired
    status TEXT DEFAULT 'Active', -- Active, Rejected, Withdrawn
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rejection_reason TEXT,
    notes TEXT
);

-- 4. Interviews
CREATE TABLE IF NOT EXISTS public.interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
    interview_type TEXT, -- Online / Offline / Telephonic
    scheduled_at TIMESTAMP WITH TIME ZONE,
    interviewer_name TEXT,
    meeting_link TEXT,
    location TEXT,
    notes TEXT,
    feedback TEXT,
    status TEXT DEFAULT 'Scheduled' -- Scheduled, Completed, Cancelled
);

-- 5. Offers
CREATE TABLE IF NOT EXISTS public.job_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
    offered_salary TEXT,
    joining_date DATE,
    offer_letter_url TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Accepted, Declined
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for ATS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

-- Simple policy: All auth users (employers) can CRUD for now (Demo purposes)
CREATE POLICY "Allow all authenticated users full access to jobs" ON public.jobs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all authenticated users full access to candidates" ON public.candidates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all authenticated users full access to applications" ON public.job_applications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all authenticated users full access to interviews" ON public.interviews FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all authenticated users full access to offers" ON public.job_offers FOR ALL USING (auth.role() = 'authenticated');
