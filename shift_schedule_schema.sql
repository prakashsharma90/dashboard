-- SQL Schema for Shift Schedule Module

-- 1. Shifts Table: Defines shift templates
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTERVAL DEFAULT '1 hour',
    total_hours NUMERIC(4, 2),
    is_night_shift BOOLEAN DEFAULT FALSE,
    color_code TEXT DEFAULT '#4D4286',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Employee Shifts Table: Assigns shifts to employees
CREATE TABLE IF NOT EXISTS public.employee_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    assigned_by UUID REFERENCES public.employees(id),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed', 'ongoing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, date)
);

-- 3. Shift Logs Table: Tracks actual work vs shift (Advanced Integration)
CREATE TABLE IF NOT EXISTS public.shift_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    login_time TIMESTAMP WITH TIME ZONE,
    logout_time TIMESTAMP WITH TIME ZONE,
    total_hours_worked NUMERIC(6, 2),
    overtime_hours NUMERIC(6, 2) DEFAULT 0,
    is_late BOOLEAN DEFAULT FALSE,
    late_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies

-- Shifts: Everyone can read
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view shifts" ON shifts FOR SELECT USING (true);

-- Employee Shifts
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view their own assigned shifts" 
ON employee_shifts FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM employees WHERE id = employee_id));

CREATE POLICY "Admins can manage all employee shifts" 
ON employee_shifts FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM employees WHERE role IN ('employer', 'admin')));

-- Shift Logs
ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view their own shift logs" 
ON shift_logs FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM employees WHERE id = employee_id));

CREATE POLICY "Employees can insert their own shift logs" 
ON shift_logs FOR INSERT 
WITH CHECK (auth.uid() IN (SELECT user_id FROM employees WHERE id = employee_id));

CREATE POLICY "Admins can view all shift logs" 
ON shift_logs FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM employees WHERE role IN ('employer', 'admin')));
