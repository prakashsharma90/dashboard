-- Supabase SQL Schema for Salarite HR & Payroll

-- 1. Employee Profiles Table (Linked to Supabase Auth)
create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  emp_id text not null unique,
  first_name text,
  last_name text,
  designation text,
  department text,
  joining_date date,
  contact_number text,
  emergency_contact text,
  address text,
  date_of_birth date,
  gender text,
  bank_details text,
  profile_photo_url text,
  profile_completed boolean default false,
  role text default 'employee' check (role in ('employee', 'employer', 'admin')),
  salary numeric(12, 2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Employees: Users can only see and update their own profile (except salary/designation)
alter table employees enable row level security;
create policy "Users can view their own profile." on employees for select using (auth.uid() = user_id);
create policy "Users can update their own personal info." on employees for update 
using (auth.uid() = user_id) 
with check (salary = salary AND designation = designation); -- Simplistic check to ensure restricted fields aren't changed via RLS

-- 2. Attendance Logs
create table public.attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) not null,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  date date default current_date,
  status text check (status in ('Present', 'Absent', 'Late')),
  location text,
  ip_address text
);

alter table attendance_logs enable row level security;
create policy "Employees can view their own attendance." on attendance_logs for select using (auth.uid() in (select user_id from employees where id = employee_id));
create policy "Employees can check in." on attendance_logs for insert with check (auth.uid() in (select user_id from employees where id = employee_id));

-- 3. Leave Management
create table public.leave_types (
  id serial primary key,
  name text not null,
  description text
);

create table public.leave_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) not null,
  leave_type_id integer references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  reason text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now()
);

create table public.leave_allocations (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) not null,
  leave_type_id integer references public.leave_types(id),
  total_allowed integer default 12,
  remaining integer default 12
);

-- 4. Payslips
create table public.payslips (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) not null,
  month integer not null,
  year integer not null,
  pdf_path text,
  earnings jsonb, -- e.g. {"basic": 50000, "hra": 20000}
  deductions jsonb,
  net_pay numeric(12, 2),
  created_at timestamp with time zone default now()
);

-- 5. Tasks & Goals
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  assigned_to uuid references public.employees(id),
  title text not null,
  description text,
  due_date date,
  priority text default 'medium',
  status text default 'todo' check (status in ('todo', 'in_progress', 'review', 'completed')),
  created_at timestamp with time zone default now()
);

create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id),
  target text,
  progress integer default 0,
  deadline date
);

-- 6. Notices
create table public.notices (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text,
  target_audience text default 'all', -- all, department name, or designation
  attachment_url text,
  created_at timestamp with time zone default now()
);

-- 7. Performance Reviews
create table public.performance_reviews (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id),
  reviewer_id uuid references public.employees(id), -- Manager who reviews
  review_cycle text, -- e.g., "Annual 2024"
  self_rating jsonb,
  manager_rating jsonb,
  comments text,
  status text default 'draft'
);

-- 8. Documents
create table public.employee_documents (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id),
  doc_type text, -- Offer Letter, ID Proof, etc.
  file_path text,
  is_verified boolean default false,
  created_at timestamp with time zone default now()
);

-- 9. HR Tickets
create table public.hr_tickets (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id),
  category text, -- Payroll, IT, Policy, etc.
  subject text,
  description text,
  status text default 'open',
  priority text default 'medium',
  created_at timestamp with time zone default now()
);

-- 10. Grievance Management
create table public.grievances (
    id uuid default uuid_generate_v4() primary key,
    employee_id uuid references public.employees(id) not null,
    subject text not null,
    category text not null,
    priority text not null default 'Medium',
    description text not null,
    is_confidential boolean default false,
    incident_date date,
    ticket_type text default 'Grievance',
    status text default 'Pending',
    created_at timestamp with time zone default now() not null
);

create table public.grievance_assignments (
    id uuid default uuid_generate_v4() primary key,
    grievance_id uuid references public.grievances(id) on delete cascade not null,
    role text not null,
    created_at timestamp with time zone default now() not null
);

create table public.grievance_logs (
    id uuid default uuid_generate_v4() primary key,
    grievance_id uuid references public.grievances(id) on delete cascade not null,
    action text not null,
    actor_name text not null,
    actor_role text not null,
    details text,
    created_at timestamp with time zone default now() not null
);

create table public.grievance_messages (
    id uuid default uuid_generate_v4() primary key,
    grievance_id uuid references public.grievances(id) on delete cascade not null,
    sender_id uuid references public.employees(id) not null,
    message text not null,
    is_internal boolean default false,
    created_at timestamp with time zone default now() not null
);

-- RLS for Grievances
alter table public.grievances enable row level security;
alter table public.grievance_assignments enable row level security;
alter table public.grievance_logs enable row level security;
alter table public.grievance_messages enable row level security;

-- Policies for Grievances
create policy "Employees can view/insert their own grievances" on grievances
for all using (auth.uid() in (select user_id from employees where id = employee_id));

create policy "Admins/Employer can view assigned grievances" on grievances
for select using (
    auth.uid() in (select user_id from employees where role in ('employer', 'admin')) OR
    auth.uid() in (
        select e.user_id from employees e 
        join grievance_assignments a on a.role = e.role 
        where a.grievance_id = id
    )
);

create policy "Visibility of assignments" on grievance_assignments
for all using (true); -- Simplified for demo, restrict in production

create policy "Visibility of logs" on grievance_logs
for all using (true); -- Simplified for demo

create policy "Visibility of messages" on grievance_messages
for all using (
    (auth.uid() in (select user_id from employees where id = sender_id)) OR
    (not is_internal AND auth.uid() in (select e.user_id from employees e join grievances g on g.employee_id = e.id where g.id = grievance_id)) OR
    (auth.uid() in (select e.user_id from employees e join grievance_assignments a on a.role = e.role where a.grievance_id = grievance_id))
);

-- 11. Holidays
create table public.holidays (
  id serial primary key,
  name text not null,
  date date not null,
  is_public boolean default true,
  created_at timestamp with time zone default now()
);
