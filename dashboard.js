// Supabase Configuration
const supabaseUrl = 'https://rrbbbhvethxtbvupolqo.supabase.co';
const supabaseKey = 'sb_publishable_5zK8zx6xnGkD_-QIoOGZAg_5uBOEVv2';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Initialize Lucide icons
lucide.createIcons();

// Ensure dashboard content has full height for layout
$(document).ready(() => {
    $('#dashboard-content').css('min-height', '100%');
});

// Helper for XSS Prevention
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

// Global Dashboard Data
let dashboardData = {
    employee: null,
    attendance: [],
    leaveAllocations: [],
    tasks: [],
    payslips: [],
    holidays: [],
    notices: [],
    leaveRequests: [],
    leaveTypes: [],
    grievances: [],
    userLookupMap: {}, // Cache for sender names
    courses: [],
    courseAssignments: [],
    certificates: [],
    modules: [],
    progressTracking: [],
    announcements: [],
    announcementReads: []
};

// State management
let currentUserId = 'f09e86ef-f11f-4be3-88e0-5abec820e4a3'; // Demo User ID
let currentGrievanceId = null; // Track current active grievance

async function initDashboard() {
    try {
        // Enforce Session Access Control
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        const userId = session.user.id;
        currentUserId = userId; // Critical: Update global ID from session

        // Fetch user data
        const { data: userData, error: userErr } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (userErr) throw userErr;

        // Final Dashboard Access Logic based on Verification Status
        // Default to Missing if null
        const status = userData.verification_status || (userData.profile_completed ? 'Pending' : 'Missing');

        if (status === 'Missing') {
            window.location.href = 'complete-profile.html';
            return;
        } else if (status === 'Revision Required') {
            window.location.href = 'complete-profile.html?status=revision';
            return;
        } else if (status === 'Rejected') {
            window.location.href = 'complete-profile.html?status=rejected';
            return;
        }

        dashboardData.employee = userData;
        dashboardData.verification_status = status; // either 'Pending' or 'Active'

        // Apply Access Control for Pending state
        if (status === 'Pending') {
            $('body').append(`
                <div id="pending-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999; background:rgba(255,255,255,0.7); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:white; padding:40px; border-radius:24px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); text-align:center; max-width:500px; border:1px solid #e2e8f0;">
                        <div style="width:80px; height:80px; background:#fffbeb; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                            <i data-lucide="shield-alert" style="width:40px; color:#f59e0b;"></i>
                        </div>
                        <h2 style="font-family:'Plus Jakarta Sans'; font-weight:800; color:#1e293b; margin-bottom:12px;">Verification in Progress ⏳</h2>
                        <p style="color:#64748b; line-height:1.6; margin-bottom:24px;">Your profile has been submitted and is currently under HR review. You can view your dashboard in <b>Read-Only</b> mode, but most features are locked until approval.</p>
                        <div style="background:#f8fafc; padding:15px; border-radius:12px; font-size:0.85rem; color:#475569; display:flex; align-items:center; gap:10px;">
                            <i data-lucide="info" style="width:18px;"></i> You will be notified once your profile is verified.
                        </div>
                    </div>
                </div>
            `);
            lucide.createIcons();
            // Prevent most interactions (demo level) but ALLOW support center sidebar and buttons
            $('button, a').not('.user-peek a, .sidebar-link[data-section="help-desk"]').css('pointer-events', 'none').css('opacity', '0.6');
            $('.sidebar-link[data-section="help-desk"]').css('pointer-events', 'auto').css('opacity', '1');
        }


        // Update sidebar and identity card basics
        $('.user-peek .name').text(escapeHTML(`${userData.first_name} ${userData.last_name ? userData.last_name.substring(0, 1) + '.' : ''}`));
        $('.user-peek .role').text(escapeHTML(userData.designation || 'Employee'));

        const [attRes, leaveRes, tasksRes, payRes, holRes, noticeRes, leaveReqRes, leaveTypeRes, grievanceRes, empRes] = await Promise.all([
            supabaseClient.from('attendance_logs')
                .select('*')
                .eq('employee_id', userData.id)
                .order('date', { ascending: false })
                .order('check_in', { ascending: false }),
            supabaseClient.from('leave_allocations').select('*, leave_types(name)').eq('employee_id', userData.id),
            supabaseClient.from('tasks').select('*').eq('assigned_to', userData.id).order('created_at', { ascending: false }),
            supabaseClient.from('payslips').select('*').eq('employee_id', userData.id).order('year', { ascending: false }).order('month', { ascending: false }),
            supabaseClient.from('holidays').select('*').order('date', { ascending: true }),
            supabaseClient.from('notices').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('leave_requests').select('*, leave_types(name)').eq('employee_id', userData.id).order('created_at', { ascending: false }),
            supabaseClient.from('leave_types').select('*'),
            supabaseClient.from('grievances').select('*').eq('employee_id', userData.id).order('created_at', { ascending: false }),
            supabaseClient.from('employees').select('user_id, id, first_name, last_name')
        ]);

        dashboardData.attendance = attRes.data || [];
        dashboardData.leaveAllocations = leaveRes.data || [];
        dashboardData.tasks = tasksRes.data || [];
        dashboardData.payslips = payRes.data || [];
        dashboardData.holidays = holRes.data || [];
        dashboardData.notices = noticeRes.data || [];
        dashboardData.leaveRequests = leaveReqRes.data || [];
        dashboardData.leaveTypes = leaveTypeRes.data || [];
        dashboardData.grievances = grievanceRes.data || [];

        // Build User Lookup Map
        if (empRes?.data) {
             empRes.data.forEach(u => {
                 const name = `${u.first_name} ${u.last_name || ''}`.trim();
                 if (u.user_id) dashboardData.userLookupMap[u.user_id] = name;
                 if (u.id) dashboardData.userLookupMap[u.id] = name;
             });
        }

        // --- NEW: Generate Signed URLs for sensitive documents ---
        dashboardData.employeeSignedUrls = {};
        const docFields = ['doc_aadhaar_url', 'doc_pan_url', 'doc_resume_url', 'doc_photo_url', 'doc_offer_url'];
        await Promise.all(docFields.map(field => {
            const path = userData[field];
            if (path && !path.startsWith('http')) { // Only if it's a path
                return supabaseClient.storage.from('employee-documents').createSignedUrl(path, 3600)
                    .then(({ data }) => { if (data) dashboardData.employeeSignedUrls[field] = data.signedUrl; });
            } else if (path) {
                dashboardData.employeeSignedUrls[field] = path; // Legacy
            }
            return Promise.resolve();
        }));

        // =========================================
        // INJECT DEMO DATA (If arrays are empty)
        // =========================================
        if (dashboardData.tasks.length === 0) {
            dashboardData.tasks = [
                { id: 'demo-t1', title: "Architect Scalable Backend", status: "in_progress", priority: "high", due_date: "Today", project: "Salarite Core" },
                { id: 'demo-t2', title: "Refactor Analytics Engine", status: "completed", priority: "medium", due_date: "Yesterday", project: "Salarite Core" },
                { id: 'demo-t3', title: "Implement Auth Flow", status: "pending", priority: "high", due_date: "Tomorrow", project: "Salarite Core" },
                { id: 'demo-t4', title: "Optimizing Database Queries", status: "in_progress", priority: "medium", due_date: "Apr 6", project: "Infrastructure" },
                { id: 'demo-t5', title: "UI/UX Review - Payroll", status: "completed", priority: "low", due_date: "Apr 2", project: "Salarite Core" }
            ];
        }

        if (dashboardData.attendance.length === 0) {
            const today = new Date().toISOString().split('T')[0];
            dashboardData.attendance = [
                { id: 'demo-a1', date: today, check_in: '09:00:00', check_out: '18:30:00', total_hours: '9.5h' },
                { id: 'demo-a2', date: '2026-04-03', check_in: '08:45:00', check_out: '18:15:00', total_hours: '9.5h' },
                { id: 'demo-a3', date: '2026-04-02', check_in: '09:15:00', check_out: '18:45:00', total_hours: '9.5h' }
            ];
        }

        if (dashboardData.payslips.length === 0) {
            dashboardData.payslips = [
                { id: 'demo-p1', month: 'March', year: 2026, net_pay: 85000, status: 'Published' },
                { id: 'demo-p2', month: 'February', year: 2026, net_pay: 82000, status: 'Published' }
            ];
        }

        if (dashboardData.holidays.length === 0) {
            dashboardData.holidays = [
                { id: 'demo-h1', name: "Mahavir Jayanti", date: "2026-04-14", type: "Gazetted" },
                { id: 'demo-h2', name: "Good Friday", date: "2026-04-03", type: "Gazetted" },
                { id: 'demo-h3', name: "Eid-ul-Fitr", date: "2026-04-20", type: "Gazetted" }
            ];
        }

        if (dashboardData.notices.length === 0) {
            dashboardData.notices = [
                { id: 'demo-n1', title: "New Leave Policy - FY27", content: "HR has updated the carry-over rules for the next financial year. Please check the handbook.", created_at: new Date().toISOString() },
                { id: 'demo-n2', title: "Jaipur Office Team Meetup", content: "Join us for lunch at the office this Friday!", created_at: new Date(Date.now() - 86400000).toISOString() }
            ];
        }

        // =========================================
        // LMS DEMO DATA INJECTION
        // =========================================
        if (dashboardData.courses.length === 0) {
            dashboardData.courses = [
                { id: 'c1', title: "UI/UX Essentials", category: "Design", duration: 120, difficulty: "Intermediate", thumbnail: "https://images.unsplash.com/photo-1586717791821-3f44a563de4c?w=400&q=80" },
                { id: 'c2', title: "Full-Stack Architecture", category: "Engineering", duration: 450, difficulty: "Advanced", thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80" },
                { id: 'c3', title: "Corporate Ethics & Security", category: "Compliance", duration: 60, difficulty: "Beginner", thumbnail: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80" },
                { id: 'c4', title: "Strategic Leadership", category: "Management", duration: 300, difficulty: "Expert", thumbnail: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=80" }
            ];
        }

        if (dashboardData.courseAssignments.length === 0) {
            dashboardData.courseAssignments = [
                { id: 'a1', course_id: 'c1', status: 'in_progress', progress: 65, deadline: '2026-04-15', last_accessed: new Date().toISOString() },
                { id: 'a2', course_id: 'c3', status: 'not_started', progress: 0, deadline: '2026-04-10', last_accessed: null },
                { id: 'a3', course_id: 'c2', status: 'completed', progress: 100, deadline: '2026-03-30', last_accessed: '2026-03-29' }
            ];
        }

        if (dashboardData.certificates.length === 0) {
            dashboardData.certificates = [
                { id: 'cert1', course_id: 'c2', title: "Full-Stack Architecture", issued_date: "2026-03-30", certificate_url: "#" }
            ];
        }

        if (dashboardData.modules.length === 0) {
            dashboardData.modules = [
                { id: 'm1', course_id: 'c1', title: "Intro to Visual Hierarchy", type: "video", duration: "12m", order: 1 },
                { id: 'm2', course_id: 'c1', title: "Typography Deep Dive", type: "pdf", duration: "8m", order: 2 },
                { id: 'm3', course_id: 'c1', title: "Color Theory & Psychology", type: "video", duration: "15m", order: 3 },
                { id: 'm4', course_id: 'c1', title: "Module 1 Assessment", type: "quiz", duration: "10m", order: 4 }
            ];
        }

        // =========================================
        // ANNOUNCEMENTS DEMO DATA
        // =========================================
        if (dashboardData.announcements.length === 0) {
            dashboardData.announcements = [
                { 
                    id: 'ann-1', 
                    title: "🚀 FY27 Strategic Growth Plan", 
                    description: "Our roadmap for the next financial year focusing on AI-driven automation and global expansion. All hands meet on Monday.", 
                    type: "general", 
                    priority: "medium", 
                    created_at: new Date().toISOString(), 
                    expiry_date: "2026-05-01",
                    is_read: false
                },
                { 
                    id: 'ann-2', 
                    title: "⚠️ Mandatory Security Patching", 
                    description: "Critical security update for the internal dev environment. Please update your environment variables by EOD.", 
                    type: "urgent", 
                    priority: "high", 
                    created_at: new Date(Date.now() - 3600000).toISOString(), 
                    expiry_date: "2026-04-10",
                    is_read: false
                },
                { 
                    id: 'ann-3', 
                    title: "🎉 Annual Retreat: Jaipur 2026", 
                    description: "Pack your bags! Our annual team building retreat is happening in the Pink City next month. Details inside.", 
                    type: "event", 
                    priority: "low", 
                    created_at: new Date(Date.now() - 86400000).toISOString(), 
                    expiry_date: "2026-05-15",
                    is_read: true
                },
                { 
                    id: 'ann-4', 
                    title: "📜 Updated Overtime Policy", 
                    description: "HR has updated the overtime reimbursement brackets. Effective from April 1st, 2026.", 
                    type: "policy", 
                    priority: "medium", 
                    created_at: new Date(Date.now() - 172800000).toISOString(), 
                    expiry_date: "2026-12-31",
                    is_read: true
                }
            ];
        }

        // Update Check-In/Out button state
        updateAttendanceUI();

        // Initial render
        const hash = window.location.hash.replace('#', '') || 'overview';
        switchSection(hash);

    } catch (err) {
        console.error("Error fetching data:", err);
    }
}

const sections = {
    overview: {
        title: "Dashboard Overview",
        render: () => {
            const emp = dashboardData.employee;
            const initials = `${emp.first_name.charAt(0)}${emp.last_name ? emp.last_name.charAt(0) : ''}`;
            const completedTasks = dashboardData.tasks.filter(t => t.status === 'completed').length;
            const recentTasks = dashboardData.tasks.length > 0 ? dashboardData.tasks.slice(0, 3) : [
                { id: 't1', title: "Optimize blog SEO", status: "completed", due_date: "Today", project: "Client project", priority: "high" },
                { id: 't2', title: "Create backlink strategy", status: "in_progress", due_date: "Tomorrow", project: "SEO", priority: "medium" },
                { id: 't3', title: "Update landing page content", status: "pending", due_date: "Apr 2", project: "Content", priority: "low" }
            ];

            const pendingBanner = dashboardData.verification_status === 'Pending' ? `
                <div class="premium-notif fade-in" style="background:#fff7ed; color:#9a3412; border:1px solid #ffedd5; padding:12px; border-radius:12px; margin-bottom:1.5rem; display:flex; gap:10px; align-items:center;">
                    <i data-lucide="alert-circle" style="width:20px;"></i>
                    <span style="font-size:0.85rem; font-weight:600;"><b>Verification Pending:</b> Your profile is under review by HR. Full access will be available soon.</span>
                </div>
            ` : '';

            return `
                ${pendingBanner}
                
                <!-- 1. Premium Profile Banner Card -->
                <div class="premium-profile-card fade-in">
                    <div class="premium-card-banner"></div>
                    <div class="premium-card-body">
                        <div class="premium-avatar-box">
                            <div class="premium-avatar">${initials}</div>
                        </div>
                        <div class="premium-info-main">
                            <div class="premium-name-row">
                                <h2 style="margin:0; font-family:'Plus Jakarta Sans', sans-serif; font-weight:900; letter-spacing:-1px;">${escapeHTML(emp.first_name)} ${escapeHTML(emp.last_name || '')}</h2>
                                <span class="badge-verified" style="font-size:0.65rem; background:#f0fdf4; color:#10b981; padding:2px 10px; border-radius:15px; font-weight:800; border:1px solid #dcfce7; font-family:'Inter', sans-serif;">Verified</span>
                            </div>
                            <p class="premium-role-text" style="margin:4px 0 12px; font-weight:600; color:var(--text-muted);">${escapeHTML(emp.designation || 'Web Design Specialist')} &bull; ${escapeHTML(emp.department || 'Jaipur (Remote)')}</p>
                            <div class="premium-pill-row">
                                <div class="premium-pill" style="font-weight:700;"><i data-lucide="square-plus" style="width:12px;"></i> EMP10245</div>
                                <div class="premium-pill" style="font-weight:700;"><i data-lucide="home" style="width:12px;"></i> Jaipur Remote</div>
                                <div class="premium-pill" style="font-weight:700;"><i data-lucide="trending-up" style="width:12px;"></i> wds</div>
                            </div>
                        </div>
                        <div class="premium-stats-group">
                            <div class="premium-stat-item">
                                <span class="val">24</span>
                                <label>Days present</label>
                            </div>
                            <div class="premium-stat-item">
                                <span class="val" style="color:var(--brand-blue);">98%</span>
                                <label>Attendance</label>
                            </div>
                            <div class="premium-stat-item">
                                <span class="val" style="color:var(--success);">92%</span>
                                <label>Productivity</label>
                            </div>
                        </div>
                        <div class="premium-actions-group">
                            <button class="btn-premium-outline" onclick="switchSection('profile')"><i data-lucide="edit-3" style="width:16px;"></i> Edit profile</button>
                            <button class="btn-premium-solid" onclick="switchSection('documents')"><i data-lucide="calendar" style="width:16px;"></i> Documents</button>
                        </div>
                    </div>
                </div>

                <!-- 2. Main Analytics Grid -->
                <div class="main-grid fade-in">
                    
                    <!-- Left Column -->
                    <div class="left-col">
                        <!-- Attendance Trends -->
                        <div class="content-card">
                            <div class="card-title">
                                Attendance trends
                                <span class="status-badge" style="background:#f0fdf4; color:#10b981; font-weight:700;">Checked out</span>
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:15px; margin-top:10px;">
                                <div style="background:var(--main-bg); padding:15px; border-radius:12px; text-align:center;">
                                    <div style="font-size:1.5rem; font-weight:800; color:var(--accent);">22<small style="font-size:0.7rem; color:var(--text-muted);">/26</small></div>
                                    <label style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">Monthly presence</label>
                                </div>
                                <div style="background:var(--main-bg); padding:15px; border-radius:12px; text-align:center;">
                                    <div style="font-size:1.5rem; font-weight:800; color:#f59e0b;">3</div>
                                    <label style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">Late logins</label>
                                </div>
                                <div style="background:var(--main-bg); padding:15px; border-radius:12px; text-align:center;">
                                    <div style="font-size:1.5rem; font-weight:800; color:var(--text-dark);">8.5h</div>
                                    <label style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">Avg. logged</label>
                                </div>
                                <div style="background:var(--main-bg); padding:15px; border-radius:12px; text-align:center;">
                                    <div style="font-size:1.5rem; font-weight:800; color:var(--danger);">12h</div>
                                    <label style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">Overtime</label>
                                </div>
                            </div>
                        </div>

                        <!-- Tasks & Work -->
                        <div class="content-card">
                            <div class="card-title">
                                Tasks & work
                                <a href="#" onclick="switchSection('tasks')" style="font-size:0.75rem; color:var(--brand-blue); text-decoration:none; display:flex; align-items:center; gap:4px;">View all <i data-lucide="arrow-right" style="width:12px;"></i></a>
                            </div>
                            <div class="task-list-modern" style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
                                ${recentTasks.map(task => `
                                    <div class="task-row-item" style="display:flex; align-items:center; gap:15px; padding:12px; border-radius:12px; transition:background 0.2s; cursor:pointer;" onmouseover="this.style.background='var(--main-bg)'" onmouseout="this.style.background='transparent'">
                                        <div class="task-check" style="width:20px; color:${task.status === 'completed' ? 'var(--success)' : 'var(--text-muted)'};">
                                            <i data-lucide="${task.status === 'completed' ? 'check-circle' : 'circle'}" style="width:18px;"></i>
                                        </div>
                                        <div style="flex-grow:1;">
                                            <div style="font-weight:700; color:var(--text-dark); font-size:0.9rem;">${escapeHTML(task.title)}</div>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">Due: ${escapeHTML(task.due_date)} &bull; ${escapeHTML(task.project)}</div>
                                        </div>
                                        <div style="text-align:right;">
                                            <div class="status-text" style="font-size:0.7rem; font-weight:700; color:${task.status === 'completed' ? 'var(--success)' : (task.status === 'in_progress' ? 'var(--brand-blue)' : 'var(--text-muted)')}; text-transform:capitalize;">${task.status.replace('_', ' ')}</div>
                                            <div class="priority-label" style="font-size:0.65rem; color:${task.priority === 'high' ? 'var(--danger)' : (task.priority === 'medium' ? 'var(--warning)' : 'var(--text-muted)')}; font-weight:800; text-transform:uppercase;">${task.priority}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem;">
                            <!-- Performance & Analytics -->
                            <div class="content-card" onclick="switchSection('analytics')" style="cursor:pointer; transition: transform 0.2s;">
                                <div class="card-title">
                                    Analytics
                                    <i data-lucide="trending-up" style="width:16px; color:var(--accent);"></i>
                                </div>
                                <div style="margin-top:10px;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Efficiency</span>
                                        <span style="font-size:0.75rem; font-weight:800; color:var(--success);">85%</span>
                                    </div>
                                    <div style="height:6px; background:#f1f5f9; border-radius:10px; overflow:hidden; margin-bottom:15px;">
                                        <div style="width:85%; height:100%; background:var(--accent);"></div>
                                    </div>
                                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                        <div style="background:#f8fafc; padding:10px; border-radius:10px; text-align:center; border:1px solid #f1f5f9;">
                                            <div style="font-size:1rem; font-weight:800; color:var(--accent);">4.2</div>
                                            <div style="font-size:0.6rem; color:var(--text-muted); font-weight:700;">Rating</div>
                                        </div>
                                        <div style="background:#f8fafc; padding:10px; border-radius:10px; text-align:center; border:1px solid #f1f5f9;">
                                            <div style="font-size:1rem; font-weight:800; color:var(--brand-blue);">${completedTasks}</div>
                                            <div style="font-size:0.6rem; color:var(--text-muted); font-weight:700;">Tasks</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Announcements -->
                            <div class="content-card">
                                <div class="card-title">Announcements <span class="badge" style="background:#fee2e2; color:var(--danger); font-size:0.65rem; padding:2px 8px; border-radius:10px;">2 new</span></div>
                                <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
                                    <div style="display:flex; gap:12px; align-items:center; background:#fffbeb; padding:10px; border-radius:10px;">
                                        <div style="background:white; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#f59e0b;"><i data-lucide="party-popper" style="width:16px;"></i></div>
                                        <div style="display:flex; flex-direction:column;">
                                            <div style="font-size:0.8rem; font-weight:700; color:var(--text-dark);">Holi celebration at cafeteria</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted);">Mar 24 - 4:00 PM onwards</div>
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:12px; align-items:center; background:var(--accent-soft); padding:10px; border-radius:10px;">
                                        <div style="background:white; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--accent);"><i data-lucide="file-text" style="width:16px;"></i></div>
                                        <div style="display:flex; flex-direction:column;">
                                            <div style="font-size:0.8rem; font-weight:700; color:var(--text-dark);">New WFH policy updated</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted);">Click to view documentation</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Document Quick View -->
                        <div class="content-card fade-in-up">
                            <div class="card-title">Document quick view</div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
                                <div style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--border-color); border-radius:12px;">
                                    <div style="background:#f0fdf4; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--success);"><i data-lucide="file-check" style="width:18px;"></i></div>
                                    <div>
                                        <div style="font-size:0.85rem; font-weight:700; color:var(--text-dark);">Aadhaar card</div>
                                        <div style="font-size:0.7rem; color:var(--success); font-weight:600;">Verified</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--border-color); border-radius:12px;">
                                    <div style="background:#f0fdf4; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--success);"><i data-lucide="file-check" style="width:18px;"></i></div>
                                    <div>
                                        <div style="font-size:0.85rem; font-weight:700; color:var(--text-dark);">PAN card</div>
                                        <div style="font-size:0.7rem; color:var(--success); font-weight:600;">Verified</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--border-color); border-radius:12px;">
                                    <div style="background:#fffbeb; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#f59e0b;"><i data-lucide="clock" style="width:18px;"></i></div>
                                    <div>
                                        <div style="font-size:0.85rem; font-weight:700; color:var(--text-dark);">ID proof</div>
                                        <div style="font-size:0.7rem; color:#f59e0b; font-weight:600;">Pending review</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--border-color); border-radius:12px;">
                                    <div style="background:#f0fdf4; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--success);"><i data-lucide="file-check" style="width:18px;"></i></div>
                                    <div>
                                        <div style="font-size:0.85rem; font-weight:700; color:var(--text-dark);">Salary slip</div>
                                        <div style="font-size:0.7rem; color:var(--success); font-weight:600;">Verified</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column -->
                    <div class="right-col">
                        <!-- Today's Time -->
                        <div class="content-card" style="text-align:center; padding:30px 20px;">
                            <div class="card-title" style="justify-content:center; margin-bottom:5px;">Today's time</div>
                            <div id="live-timer" style="font-size:3rem; font-weight:800; color:var(--text-dark); letter-spacing:-2px;">--:--:--</div>
                            <div id="current-date" style="font-size:0.85rem; color:var(--text-muted); font-weight:600; margin-bottom:15px;">--</div>
                            <div style="display:flex; justify-content:center; margin-bottom:25px;">
                                <span class="status-badge" style="background:#f1f5f9; color:var(--text-muted); display:flex; align-items:center; gap:6px;"><span style="width:6px; height:6px; background:#64748b; border-radius:50%;"></span> Checked out</span>
                            </div>
                            
                            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:25px;">
                                <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
                                    <span style="color:var(--text-muted); font-weight:600;">Shift time</span>
                                    <span style="font-weight:700; color:var(--text-dark);">09:30 AM - 06:30 PM</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:8px 0; border-top:1px solid var(--border-color);">
                                    <span style="color:var(--text-muted); font-weight:600;">Expected log</span>
                                    <span style="font-weight:700; color:var(--text-dark);">08h 30m</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:8px 0; border-top:1px solid var(--border-color);">
                                    <span style="color:var(--text-muted); font-weight:600;">Today logged</span>
                                    <span style="font-weight:700; color:var(--text-dark);">06h 24m</span>
                                </div>
                            </div>

                            <button class="btn-premium-solid" id="check-in-main" style="width:100%; justify-content:center; padding:15px; border-radius:12px; font-size:1rem;">Punch in again</button>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:15px; display:flex; align-items:center; justify-content:center; gap:6px;">
                                <i data-lucide="lock" style="width:12px;"></i> Secured with biometric check-in
                            </div>
                        </div>

                        <!-- Leave Balance -->
                        <div class="content-card">
                            <div class="card-title">Leave balance <button class="btn-premium-solid" style="padding:4px 12px; font-size:0.7rem;" onclick="switchSection('leave')">+ Apply</button></div>
                            <div style="display:flex; flex-direction:column; gap:15px; margin-top:10px;">
                                ${dashboardData.leaveAllocations.length > 0 ? dashboardData.leaveAllocations.map(al => {
                                    const perc = (al.remaining / al.total_allowed) * 100;
                                    let color = 'var(--accent)';
                                    if (al.leave_types.name.toLowerCase().includes('sick')) color = 'var(--danger)';
                                    if (al.leave_types.name.toLowerCase().includes('earned')) color = 'var(--success)';
                                    
                                    return `
                                        <div>
                                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:8px;">
                                                <span>${al.leave_types.name}</span> 
                                                <span style="color:var(--text-muted);">${al.remaining} / ${al.total_allowed} days</span>
                                            </div>
                                            <div style="height:4px; background:var(--main-bg); border-radius:10px; overflow:hidden;">
                                                <div style="width:${perc}%; height:100%; background:${color};"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('') : '<p style="font-size:0.8rem; color:var(--text-muted);">No leave allocations found.</p>'}
                            </div>
                        </div>

                        <!-- Monthly summary -->
                        <div class="content-card fade-in-up">
                            <div class="card-title">Monthly summary</div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                                <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #f1f5f9;">
                                    <div style="font-size:1.5rem; font-weight:800; color:var(--brand-blue);">${dashboardData.attendance.length}</div>
                                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Present days</div>
                                </div>
                                <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #f1f5f9;">
                                    <div style="font-size:1.5rem; font-weight:800; color:#f59e0b;">0</div>
                                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Late arrivals</div>
                                </div>
                                <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #f1f5f9;">
                                    <div style="font-size:1.5rem; font-weight:800; color:var(--danger);">0</div>
                                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Absences</div>
                                </div>
                                <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #f1f5f9;">
                                    <div style="font-size:1.5rem; font-weight:800; color:var(--success);">${dashboardData.tasks.filter(t => t.status === 'completed').length}</div>
                                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Tasks closed</div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            `;
        }
    },
    profile: {
        title: "My Profile",
        render: () => {
            const emp = dashboardData.employee;
            const signed = dashboardData.employeeSignedUrls || {};
            const safeVal = (v) => v ? escapeHTML(v) : '<span style="color:var(--text-muted); font-style:italic; font-weight:400;">Not provided</span>';

            // Helper to create an editable field
            const field = (label, key, value, type = 'text') => {
                const displayVal = value ? escapeHTML(value) : '';
                return `<div class="info-item">
                    <label>${label}</label>
                    <span class="profile-display-val" data-key="${key}" style="font-weight:700;">${safeVal(value)}</span>
                    <input class="profile-edit-input" data-key="${key}" type="${type}" value="${displayVal}" style="display:none; padding:10px 14px; border:1px solid #e2e8f0; border-radius:10px; font-size:0.9rem; font-family:inherit; width:100%; box-sizing:border-box; background:var(--main-bg); color:var(--text-dark);">
                </div>`;
            };

            // Read-only field
            const readOnly = (label, value) => `<div class="info-item"><label>${label}</label><span style="font-weight:700;">${safeVal(value)}</span></div>`;

            // Document link
            const docLink = (label, url, icon = 'file-text') => {
                const status = url ? 'View Document' : 'Not uploaded';
                const linkAttr = url ? `href="${url}" target="_blank" rel="noopener noreferrer" mode="secure"` : 'style="opacity:0.5; cursor:not-allowed;"';
                return `
                    <a ${linkAttr} class="doc-card-modern">
                        <div class="doc-icon-box"><i data-lucide="${icon}"></i></div>
                        <div class="doc-info-box">
                            <label>${escapeHTML(label)}</label>
                            <span>${status}</span>
                        </div>
                    </a>
                `;
            };

            const photoUrl = signed.doc_photo_url || emp.profile_photo_url || 'https://i.pravatar.cc/150';

            return `
                <div class="profile-container">
                    
                    <!-- 1. BANNER & HEADER OVERLAP -->
                    <div class="profile-banner-wrapper">
                        <div class="profile-banner"></div>
                        <div class="profile-header-overlap">
                            <div class="profile-avatar-wrapper">
                                <img src="${photoUrl}" class="profile-avatar-overlap" alt="User Avatar">
                                <div style="position:absolute; bottom:10px; right:10px; background:white; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.1); cursor:pointer;">
                                    <i data-lucide="camera" style="width:18px; color:var(--accent);"></i>
                                </div>
                            </div>
                            <div class="profile-name-info">
                                <h1>${emp.first_name} ${emp.last_name || ''}</h1>
                                <p>
                                    <i data-lucide="shield" style="width:14px; color:var(--accent);"></i> 
                                    ${emp.designation || 'Specialist'} • ${emp.department || 'Operations'}
                                </p>
                            </div>
                        </div>

                        <!-- Glass Quick Stats -->
                        <div class="profile-quick-stats">
                            <div class="glass-stat-card">
                                <label>Attendance</label>
                                <span class="val">${dashboardData.attendance.length}/28</span>
                            </div>
                            <div class="glass-stat-card">
                                <label>Leave Balance</label>
                                <span class="val">${dashboardData.leaveAllocations[0]?.remaining || 0}</span>
                            </div>
                        </div>

                        <div style="position: absolute; right: 20px; top: 20px;">
                            <button class="primary-btn profile-edit-btn" onclick="toggleProfileEdit()" id="btn-profile-edit" style="border-radius:20px; padding: 0.8rem 1.8rem; display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.2); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); color:white; box-shadow:none;">
                                <i data-lucide="edit-3" style="width:16px;"></i> <span id="edit-btn-text">Edit Profile</span>
                            </button>
                        </div>
                    </div>

                    <div class="profile-grid-layout">
                        <!-- LEFT COLUMN: QUICK INFO -->
                        <div class="profile-sidebar-cards">
                            <div class="section-wrapper">
                                <h3 style="font-size:0.9rem; margin-bottom:1.5rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1.5px; font-weight:800;">Corporate Identity</h3>
                                <div class="profile-stat-box">
                                    <div class="stat-mini-card">
                                        <label>EMP ID</label>
                                        <span>${emp.emp_id}</span>
                                    </div>
                                    <div class="stat-mini-card">
                                        <label>STATUS</label>
                                        <span style="color:var(--success); font-size:0.9rem;">${emp.verification_status || 'Active'}</span>
                                    </div>
                                </div>
                                <div style="margin-top:25px; padding-top:20px; border-top:1px solid var(--border-color);">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                        <span style="color:var(--text-muted); font-size:0.8rem; font-weight:600;">Joining Date</span>
                                        <span style="font-size:0.9rem; font-weight:700; color:var(--text-dark);">${emp.joining_date || 'N/A'}</span>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                        <span style="color:var(--text-muted); font-size:0.8rem; font-weight:600;">Reports To</span>
                                        <div style="text-align:right;">
                                            <div style="font-size:0.9rem; font-weight:700; color:var(--text-dark);">${emp.reporting_manager || 'Admin'}</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted);">Manager</div>
                                        </div>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="color:var(--text-muted); font-size:0.8rem; font-weight:600;">Working At</span>
                                        <span style="font-size:0.9rem; font-weight:700; color:var(--text-dark);">${emp.work_location || 'Remote'}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="section-wrapper" style="background:linear-gradient(135deg, var(--accent) 0%, #312e81 100%); border-color:transparent; color:white;">
                                <h3 style="font-size:1.1rem; color:white; margin-bottom:10px;"><i data-lucide="zap" style="width:20px; color:#fbbf24; fill:#fbbf24;"></i> Quick Support</h3>
                                <p style="font-size:0.85rem; color:rgba(255,255,255,0.8); margin-bottom:20px; line-height:1.5;">Need to update official records or having trouble? Our HR team is here to assist you.</p>
                                <button style="width:100%; padding:12px; border-radius:12px; border:none; background:white; color:var(--accent); font-weight:800; cursor:pointer; font-size:0.9rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">Open HR Desk</button>
                            </div>
                        </div>

                        <!-- RIGHT COLUMN: DETAILED INFO -->
                        <div class="profile-main-cards">
                            
                            <!-- Personal & Contact -->
                            <div class="section-wrapper section-personal">
                                <div class="section-header-row">
                                    <h3><i data-lucide="user-check"></i> Personal & Contact</h3>
                                </div>
                                <div class="info-grid">
                                    ${field('Phone Number', 'contact_number', emp.contact_number, 'tel')}
                                    ${field('Gender', 'gender', emp.gender)}
                                    ${field('Date of Birth', 'date_of_birth', emp.date_of_birth, 'date')}
                                    ${field('Marital Status', 'marital_status', emp.marital_status)}
                                </div>
                            </div>

                            <!-- Residence -->
                            <div class="section-wrapper section-residence">
                                <div class="section-header-row">
                                    <h3><i data-lucide="navigation"></i> Residence Address</h3>
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px;">
                                    <div>
                                        <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:1.25rem; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
                                            <i data-lucide="home" style="width:14px;"></i> Current
                                        </h4>
                                        <div style="display:flex; flex-direction:column; gap:15px;">
                                            ${field('Address Line', 'current_address_line1', emp.current_address_line1)}
                                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                                                ${field('City', 'current_city', emp.current_city)}
                                                ${field('Pincode', 'current_pincode', emp.current_pincode)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="border-left:1px solid var(--border-color); padding-left:30px;">
                                        <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:1.25rem; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
                                            <i data-lucide="map" style="width:14px;"></i> Permanent
                                        </h4>
                                        <div style="display:flex; flex-direction:column; gap:15px;">
                                            ${field('Address Line', 'permanent_address_line1', emp.permanent_address_line1)}
                                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                                                ${field('City', 'permanent_city', emp.permanent_city)}
                                                ${field('Pincode', 'permanent_pincode', emp.permanent_pincode)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Bank Details -->
                            <div class="section-wrapper section-bank">
                                <div class="section-header-row">
                                    <h3><i data-lucide="credit-card"></i> Bank & Financials</h3>
                                </div>
                                <div class="info-grid">
                                    ${field('Bank Name', 'bank_name', emp.bank_name)}
                                    ${field('A/C Number', 'bank_account_number', emp.bank_account_number)}
                                    ${field('IFSC Code', 'bank_ifsc', emp.bank_ifsc)}
                                    ${field('Branch', 'bank_branch', emp.bank_branch)}
                                </div>
                            </div>

                            <!-- Emergency Contact -->
                            <div class="section-wrapper" style="border-left:5px solid #ef4444; background:rgba(239, 68, 68, 0.02);">
                                <div class="section-header-row">
                                    <h3><i data-lucide="phone-forwarded" style="color:#ef4444;"></i> Emergency Contact</h3>
                                </div>
                                <div class="info-grid">
                                    ${field('Primary Name', 'emergency_contact_name', emp.emergency_contact_name)}
                                    ${field('Relationship', 'emergency_contact_relationship', emp.emergency_contact_relationship)}
                                    ${field('Phone Number', 'emergency_contact_number', emp.emergency_contact_number)}
                                </div>
                            </div>

                            <!-- Documents -->
                            <div class="section-wrapper section-docs">
                                <div class="section-header-row">
                                    <h3><i data-lucide="fingerprint"></i> KYC & Personal Documents</h3>
                                </div>
                                <div class="doc-grid-modern">
                                    ${docLink('Aadhaar Card', signed.doc_aadhaar_url, 'file-text')}
                                    ${docLink('PAN Card', signed.doc_pan_url, 'shield-check')}
                                    ${docLink('Academic Records', signed.doc_resume_url, 'graduation-cap')}
                                    ${docLink('Official Offer', signed.doc_offer_url, 'award')}
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- Modern Global Save Bar -->
                    <div id="profile-save-bar" style="display:none; position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(255,255,255,0.9); backdrop-filter:blur(25px); border:1px solid rgba(0,0,0,0.1); padding:1rem 2.5rem; border-radius:100px; box-shadow:0 20px 60px rgba(0,0,0,0.2); align-items:center; gap:30px; z-index:9000; animation:slideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:10px; height:10px; border-radius:50%; background:#f59e0b; animation: pulse 1.5s infinite;"></div>
                            <p style="margin:0; font-size:1rem; font-weight:700; color:var(--text-dark);">Profile changes unsaved</p>
                        </div>
                        <div style="display:flex; gap:12px;">
                            <button onclick="cancelProfileEdit()" style="background:rgba(0,0,0,0.05); border:none; color:var(--text-dark); font-weight:800; padding:10px 20px; border-radius:50px; cursor:pointer;">Discard</button>
                            <button onclick="saveProfileChanges()" id="btn-save-profile" style="background:var(--accent); color:white; border:none; padding:12px 30px; border-radius:50px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 10px 20px rgba(77, 66, 134, 0.3);">
                                <i data-lucide="check" style="width:18px;"></i> Update Record
                            </button>
                        </div>
                    </div>
                </div>
                
                <style>
                @keyframes slideUp { from { transform: translate(-50%, 100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                </style>
            `;
        }
    },
    attendance: {
        title: "Attendance & Time Tracking",
        render: () => {
            const logs = dashboardData.attendance;
            return `
                <div class="card-group">
                    <div class="stats-card">
                        <label>Today's Working Hours</label>
                        <div class="value" id="att-timer">00:00:00</div>
                        <div class="trend">Live Tracking</div>
                    </div>
                    <div class="stats-card">
                        <label>Average Login Time</label>
                        <div class="value">09:12 AM</div>
                        <div class="trend" style="color:var(--danger);">Later than team avg</div>
                    </div>
                    <div class="stats-card">
                        <label>This Month</label>
                        <div class="value">${logs.length} Days</div>
                        <div class="trend">Performance tracked</div>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-title">Daily Attendance Log</div>
                    <table class="data-table">
                        <thead><tr><th>Date & Day</th><th>Punch In</th><th>Punch Out</th><th>Duration</th><th>Status</th></tr></thead>
                        <tbody>
                            ${logs.map(log => {
                const dateObj = new Date(log.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dateStr = dateObj.toLocaleDateString();

                const checkInDate = log.check_in ? new Date(log.check_in) : null;
                const checkOutDate = log.check_out ? new Date(log.check_out) : null;

                const checkInTime = checkInDate ? checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                const checkOutTime = checkOutDate ? checkOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

                // Proper Duration Calculation
                let durationStr = '-';
                if (checkInDate && checkOutDate) {
                    const diffMs = checkOutDate - checkInDate;
                    if (diffMs > 0) {
                        const hrs = Math.floor(diffMs / 3600000);
                        const mins = Math.floor((diffMs % 3600000) / 60000);
                        durationStr = `${hrs}h ${mins}m`;
                    } else {
                        durationStr = '0h 0m';
                    }
                }

                return `
                                    <tr>
                                        <td>
                                            <div style="font-weight:600;">${dateStr}</div>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">${dayName}</div>
                                        </td>
                                        <td>${checkInTime}</td>
                                        <td>${checkOutTime}</td>
                                        <td>${durationStr}</td>
                                        <td><span class="badge-status badge-present">${log.status}</span></td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    },
    leave: {
        title: "Leave & Holidays",
        render: () => {
            const allocations = dashboardData.leaveAllocations;
            const requests = dashboardData.leaveRequests || [];
            const types = dashboardData.leaveTypes || [];

            // Group Allocations for Premium Cards
            const allocationHTML = allocations.map(al => {
                let lvClass = 'lv-unpaid';
                let icon = 'calendar';
                
                const name = al.leave_types.name.toLowerCase();
                if (name.includes('casual')) { lvClass = 'lv-casual'; icon = 'user'; }
                else if (name.includes('sick')) { lvClass = 'lv-sick'; icon = 'heart-pulse'; }
                else if (name.includes('earned')) { lvClass = 'lv-earned'; icon = 'award'; }
                
                return `
                    <div class="lv-card ${lvClass}">
                        <div class="lv-icon-box"><i data-lucide="${icon}"></i></div>
                        <div class="lv-info">
                            <label>${al.leave_types.name}</label>
                            <div class="val">${al.remaining} <span class="total">/ ${al.total_allowed}</span></div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="leave-summary-grid">
                    ${allocationHTML || '<div class="content-card" style="width:100%; text-align:center; color:var(--text-muted);">No leave balances allocated yet.</div>'}
                </div>

                <div class="lv-main-grid">
                    <div class="lv-form-section">
                        <div class="lv-form-card">
                            <div class="lv-form-title">
                                <i data-lucide="send" style="color:var(--accent);"></i>
                                Apply for Leave
                            </div>
                            
                            <form id="leave-apply-form">
                                <div class="lv-calc-banner">
                                    <div class="lv-calc-info">
                                        <label>Calculated Duration</label>
                                        <div class="val" id="apply-leave-days">0 Days</div>
                                    </div>
                                    <button type="button" class="btn-premium-outline" style="padding:6px 12px; font-size:0.7rem;" onclick="showToast('Calendar view coming soon!', 'info')">
                                        <i data-lucide="calendar" style="width:14px;"></i> View Calendar
                                    </button>
                                </div>

                                <div class="lv-form-group">
                                    <label>Leave Type</label>
                                    <select id="apply-leave-type" class="lv-input" required>
                                        <option value="">Choose leave type...</option>
                                        ${types.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                                    </select>
                                </div>

                                <div class="lv-row">
                                    <div class="lv-form-group">
                                        <label>From Date</label>
                                        <input type="date" id="apply-leave-start" class="lv-input" required>
                                    </div>
                                    <div class="lv-form-group">
                                        <label>To Date</label>
                                        <input type="date" id="apply-leave-end" class="lv-input" required>
                                    </div>
                                </div>

                                <div class="lv-form-group">
                                    <label>Reason for Leave</label>
                                    <textarea id="apply-leave-reason" class="lv-input" rows="3" placeholder="Explain why you are taking leave..." required style="resize:none;"></textarea>
                                </div>

                                <div class="lv-form-group">
                                    <label>Supporting Document <span style="font-weight:400; color:var(--text-muted);">(Optional)</span></label>
                                    <div style="border: 1px dashed var(--border-color); padding: 15px; border-radius: 12px; text-align: center; background:var(--main-bg);">
                                        <i data-lucide="upload-cloud" style="width:24px; color:var(--text-muted); margin-bottom:8px;"></i>
                                        <input type="file" id="apply-leave-attachment" style="display:block; width:100%; font-size:0.8rem; color:var(--text-muted);">
                                    </div>
                                </div>

                                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:2rem;">
                                    <button type="reset" class="btn-premium-outline">Clear Form</button>
                                    <button type="submit" class="btn-premium-solid" id="btn-submit-leave">
                                        Submit Request <i data-lucide="arrow-right" style="width:16px;"></i>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="lv-history-section">
                        <div class="lv-history-card">
                            <div class="lv-history-header">
                                <h3>Recent Requests</h3>
                                <div class="status-badge" style="background:var(--main-bg); font-size:0.6rem;">LAST 6 MONTHS</div>
                            </div>

                            <div class="lv-history-list">
                                ${requests.map(req => {
                const start = new Date(req.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' });
                const end = new Date(req.end_date).toLocaleDateString([], { month: 'short', day: 'numeric' });
                const days = Math.ceil((new Date(req.end_date) - new Date(req.start_date)) / (1000 * 60 * 60 * 24)) + 1;
                const status = req.status.toLowerCase();
                
                let iconClass = 'stat-pending', icon = 'clock', tagClass = 'tag-pending';
                if (status === 'approved') { iconClass = 'stat-approved'; icon = 'check'; tagClass = 'tag-approved'; }
                if (status === 'rejected') { iconClass = 'stat-rejected'; icon = 'x'; tagClass = 'tag-rejected'; }
                
                return `
                                        <div class="lv-history-item">
                                            <div class="lv-status-icon ${iconClass}">
                                                <i data-lucide="${icon}" style="width:18px;"></i>
                                            </div>
                                            <div class="lv-item-info">
                                                <div class="title">${req.leave_types?.name}</div>
                                                <div class="subtitle">${start} - ${end} • ${days} Day${days > 1 ? 's' : ''}</div>
                                            </div>
                                            <div class="lv-item-status" style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                                                <div class="lv-status-tag ${tagClass}">${status}</div>
                                                ${status === 'pending' ? `<button class="text-btn" style="color:var(--danger); font-size:0.65rem;" onclick="cancelLeaveRequest(${req.id})">Cancel</button>` : ''}
                                            </div>
                                        </div>
                                    `;
            }).join('') || `
                                    <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                                        <i data-lucide="inbox" style="width:32px; opacity:0.3; margin-bottom:10px;"></i>
                                        <p style="font-size:0.85rem;">No leave history found</p>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Info Card -->
                        <div class="content-card" style="margin-top:1.5rem; border-left:4px solid var(--accent);">
                            <div style="display:flex; gap:12px; align-items:flex-start;">
                                <i data-lucide="info" style="color:var(--accent); width:20px; margin-top:2px;"></i>
                                <div>
                                    <div style="font-weight:700; font-size:0.85rem; margin-bottom:4px;">Smart Leave Policy</div>
                                    <p style="font-size:0.75rem; color:var(--text-muted); line-height:1.5;">
                                        Apply at least 2 days in advance for casual leave. Sick leaves require a medical certificate for more than 3 days.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },
    salary: {
        title: "Payroll & Salary Info",
        render: () => `
            <div class="content-card">
                <div class="card-title">Recent Payslips</div>
                <table class="data-table">
                    <thead><tr><th>Month</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${dashboardData.payslips.map(pay => `
                            <tr>
                                <td>${new Date(pay.year, pay.month - 1).toLocaleString('default', { month: 'long' })} ${pay.year}</td>
                                <td>₹ ${pay.net_pay.toLocaleString()}</td>
                                <td><span style="color:var(--success); font-weight:600;">Paid</span></td>
                                <td><button class="icon-btn" onclick="viewPayslip(${pay.id})"><i data-lucide="eye"></i></button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    },
    tasks: {
        title: "Tasks & Work",
        render: () => `
            <div class="content-card">
                <div class="card-title">Current Sprint Tasks</div>
                ${dashboardData.tasks.map(task => `
                    <div style="padding:20px; border:1px solid var(--border-color); border-radius:18px; margin-bottom:15px; background:white; display:flex; justify-content:space-between; align-items:flex-start; gap:20px;">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                                <b style="font-size:1rem; color:var(--text-dark);">${task.title}</b> 
                                <span class="badge-status ${task.priority === 'high' ? 'badge-late' : ''}" style="font-size:0.6rem;">${task.priority.toUpperCase()}</span>
                            </div>
                            <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.5;">${task.description || ''}</div>
                            <div style="display:flex; align-items:center; gap:15px; font-size:0.75rem; color:var(--text-muted); margin-top:12px;">
                                <span style="display:flex; align-items:center; gap:5px;"><i data-lucide="calendar" style="width:14px;"></i> Due ${new Date(task.due_date).toLocaleDateString()}</span>
                                <span style="display:flex; align-items:center; gap:5px;"><i data-lucide="activity" style="width:14px;"></i> ${task.status.replace('-', ' ')}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            ${task.status !== 'completed' ? `
                                <button class="btn-premium-solid" style="padding:8px 14px; font-size:0.75rem;" onclick="updateTaskStatus(${task.id}, 'completed')">
                                    <i data-lucide="check" style="width:14px;"></i> Complete
                                </button>
                            ` : `
                                <span style="color:var(--success); font-weight:700; font-size:0.8rem; display:flex; align-items:center; gap:5px;">
                                    <i data-lucide="check-circle" style="width:14px;"></i> DONE
                                </span>
                            `}
                        </div>
                    </div>
                `).join('')}
                ${dashboardData.tasks.length === 0 ? '<p>No tasks assigned.</p>' : ''}
            </div>
        `
    },

    training: {
        title: "Learning & Excellence Hub",
        render: () => {
            const assignments = dashboardData.courseAssignments;
            const courses = dashboardData.courses;
            const certificates = dashboardData.certificates;

            // Stats
            const completedCount = assignments.filter(a => a.status === 'completed').length;
            const inProgressCount = assignments.filter(a => a.status === 'in_progress').length;
            
            // Current Focus (Most recently accessed in-progress course)
            const focusAssignment = assignments
                .filter(a => a.status === 'in_progress')
                .sort((a, b) => new Date(b.last_accessed) - new Date(a.last_accessed))[0];
            const focusCourse = focusAssignment ? courses.find(c => c.id === focusAssignment.course_id) : null;

            return `
                <div class="lms-container fade-in-up">
                    <!-- 1. Continue Learning Hero (If active) -->
                    ${focusCourse ? `
                        <div class="lms-hero-card" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 24px; padding: 30px; color: white; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 15px 30px rgba(79, 70, 229, 0.2); position: relative; overflow: hidden;">
                             <div style="position: absolute; right: -20px; top: -20px; opacity: 0.1;"><i data-lucide="graduation-cap" style="width: 150px; height: 150px;"></i></div>
                             <div style="z-index: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.2); width: fit-content; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                    <div style="width: 6px; height: 6px; background: #4ade80; border-radius: 50%;"></div> Resume Learning
                                </div>
                                <h1 style="font-size: 1.8rem; font-weight: 950; margin: 0; letter-spacing: -0.5px;">${focusCourse.title}</h1>
                                <p style="font-size: 0.9rem; opacity: 0.9; margin-top: 8px; max-width: 400px;">Finish your last module to achieve your certificate. You're almost there!</p>
                                <div style="display: flex; align-items: center; gap: 20px; margin-top: 25px;">
                                    <button class="btn-premium-solid" style="background: white; color: #4f46e5; border: none; padding: 12px 24px; border-radius: 12px;" onclick="viewCourse('${focusCourse.id}')">Resume Training</button>
                                    <div style="font-size: 0.85rem; font-weight: 800;">${focusAssignment.progress}% Progress</div>
                                </div>
                             </div>
                             <div class="hero-progress-ring" style="width: 120px; height: 120px; position: relative;">
                                <svg width="120" height="120" viewBox="0 0 120 120">
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12" />
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="white" stroke-width="12" stroke-dasharray="${(focusAssignment.progress / 100) * 339.29} 339.29" stroke-linecap="round" style="transition: stroke-dashoffset 1s ease-out;" />
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.2rem; font-weight: 950;">${focusAssignment.progress}%</div>
                             </div>
                        </div>
                    ` : `
                        <div class="lms-hero-card empty" style="background: white; border: 2px dashed var(--border-color); border-radius: 24px; padding: 40px; text-align: center; margin-bottom: 25px;">
                            <i data-lucide="book-open" style="width: 48px; color: var(--text-muted); opacity: 0.5; margin-bottom: 15px;"></i>
                            <h3 style="font-weight: 800; color: var(--text-dark);">No Active Training</h3>
                            <p style="color: var(--text-muted); font-size: 0.9rem;">Browse the library below to start your next learning journey.</p>
                        </div>
                    `}

                    <!-- 2. Learning Stats -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
                        <div class="analytics-stat-card" style="padding: 18px; background: white; border-radius: 20px; border: 1px solid var(--border-color);">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Assigned</div>
                            <div style="font-size: 1.5rem; font-weight: 900; margin-top: 5px;">${assignments.length}</div>
                        </div>
                        <div class="analytics-stat-card" style="padding: 18px; background: white; border-radius: 20px; border: 1px solid var(--border-color);">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Completed</div>
                            <div style="font-size: 1.5rem; font-weight: 900; margin-top: 5px; color: var(--success);">${completedCount}</div>
                        </div>
                        <div class="analytics-stat-card" style="padding: 18px; background: white; border-radius: 20px; border: 1px solid var(--border-color);">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Learning Hrs</div>
                            <div style="font-size: 1.5rem; font-weight: 900; margin-top: 5px; color: var(--accent);">14.5h</div>
                        </div>
                        <div class="analytics-stat-card" style="padding: 18px; background: white; border-radius: 20px; border: 1px solid var(--border-color);">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Certificates</div>
                            <div style="font-size: 1.5rem; font-weight: 900; margin-top: 5px; color: #8b5cf6;">${certificates.length}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px;">
                        <div class="left-col">
                            <!-- 3. My Courses -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h3 style="font-size: 1.1rem; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 10px;">
                                    <i data-lucide="list-checks" style="color: #6366f1;"></i> My Enrolled Courses
                                </h3>
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); align-items: center; display: flex; gap: 10px;">
                                    <span style="color: var(--accent);">All</span> <span>Mandatory</span> <span>Optional</span>
                                </div>
                            </div>
                            <div class="lms-course-list" style="display: flex; flex-direction: column; gap: 12px;">
                                ${assignments.map(a => {
                                    const c = courses.find(x => x.id === a.course_id);
                                    if (!c) return '';
                                    return `
                                        <div class="lms-course-row" style="background: white; border: 1px solid var(--border-color); padding: 15px; border-radius: 18px; display: flex; align-items: center; gap: 20px; transition: all 0.2s; cursor: pointer;" onclick="viewCourse('${c.id}')">
                                            <div style="width: 80px; height: 50px; border-radius: 10px; overflow: hidden; flex-shrink: 0;">
                                                <img src="${c.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;">
                                            </div>
                                            <div style="flex: 1;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                                    <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${c.category}</span>
                                                    <span style="font-size: 0.65rem; font-weight: 900; color: ${a.status === 'completed' ? 'var(--success)' : 'var(--accent)'}; text-transform: uppercase;">${a.status.replace('_', ' ')}</span>
                                                </div>
                                                <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-dark);">${c.title}</div>
                                            </div>
                                            <div style="width: 140px;">
                                                <div style="display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 800; margin-bottom: 5px;">
                                                    <span style="color: var(--text-muted);">Progress</span>
                                                    <span style="color: var(--text-dark);">${a.progress}%</span>
                                                </div>
                                                <div style="height: 4px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
                                                    <div style="width: ${a.progress}%; height: 100%; background: ${a.status === 'completed' ? 'var(--success)' : 'var(--accent)'}; border-radius: 10px;"></div>
                                                </div>
                                            </div>
                                            <div style="background: #f8fafc; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
                                                <i data-lucide="play" style="width: 16px;"></i>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <div class="right-col">
                            <!-- 4. Certificates -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h3 style="font-size: 1.1rem; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 10px;">
                                    <i data-lucide="award" style="color: #f59e0b;"></i> Credentials
                                </h3>
                            </div>
                            <div class="cert-stack" style="display: flex; flex-direction: column; gap: 12px;">
                                ${certificates.map(cert => `
                                    <div class="cert-card-mini" style="background: white; border: 1px solid var(--border-color); padding: 20px; border-radius: 20px; position: relative; overflow: hidden;">
                                        <div style="position: absolute; right: -10px; bottom: -10px; opacity: 0.05;"><i data-lucide="shield-check" style="width: 80px; height: 80px;"></i></div>
                                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--success); text-transform: uppercase; margin-bottom: 5px;">UNLOCKED • ${new Date(cert.issued_date).toLocaleDateString()}</div>
                                        <div style="font-size: 0.95rem; font-weight: 950; color: var(--text-dark); margin-bottom: 15px;">${cert.title}</div>
                                        <button class="btn-premium-outline" style="width: 100%; border-radius: 10px; font-size: 0.75rem; height: 36px; gap: 8px;">
                                            <i data-lucide="external-link" style="width: 14px;"></i> View Certificate
                                        </button>
                                    </div>
                                `).join('') || `
                                    <div style="padding: 30px; text-align: center; color: var(--text-muted); background: #f8fafc; border-radius: 20px; border: 1px solid var(--border-color);">
                                        No certificates earned yet. 🏆
                                    </div>
                                `}
                            </div>

                            <!-- 5. Learning Goal -->
                            <div class="learning-goal-card" style="margin-top: 25px; background: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 20px;">
                                <div style="display: flex; gap: 12px;">
                                    <div style="background: #fbbf24; color: white; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <i data-lucide="target" style="width: 22px;"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.85rem; color: #92400e;">Weekly Goal: 4 Hours</div>
                                        <div style="font-size: 0.75rem; color: #b45309; margin-top: 4px;">You've completed 3.2h this week. 80% of your target reached!</div>
                                        <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 10px; margin-top: 12px; overflow: hidden;">
                                            <div style="width: 80%; height: 100%; background: #fbbf24; border-radius: 10px;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
    },

    announcements: {
        title: "Announcements",
        render: () => {
            const list = dashboardData.announcements.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const unreadCount = list.filter(a => !a.is_read).length;
            const urgentCount = list.filter(a => a.priority === 'high').length;
            const totalCount = list.length;

            return `
                <div class="fade-in-up" style="width: 100%; margin: 0 auto; padding-bottom: 50px;">
                    
                    <!-- Premium Header Section -->
                    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); border-radius: 24px; padding: 40px; margin-bottom: 30px; position: relative; overflow: hidden; color: white; box-shadow: 0 20px 40px rgba(67, 56, 202, 0.15);">
                        <!-- Decorative shapes -->
                        <div style="position: absolute; top: -50px; right: -20px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); border-radius: 50%;"></div>
                        <div style="position: absolute; bottom: -30px; left: 10%; width: 150px; height: 150px; background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%); border-radius: 50%;"></div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 2;">
                            <div>
                                <h2 style="font-size: 2.2rem; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px;">Company Broadcasts</h2>
                                <p style="font-size: 1rem; color: rgba(255,255,255,0.8); margin: 0; font-weight: 400;">Stay aligned with critical updates and news.</p>
                            </div>
                            
                            <div style="display: flex; gap: 16px;">
                                <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 16px 24px; text-align: center; min-width: 100px;">
                                    <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Unread</div>
                                    <div style="font-size: 1.8rem; font-weight: 800; color: #fbbf24; line-height: 1;">${unreadCount}</div>
                                </div>
                                <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 16px 24px; text-align: center; min-width: 100px;">
                                    <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Urgent</div>
                                    <div style="font-size: 1.8rem; font-weight: 800; color: #f87171; line-height: 1;">${urgentCount}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Filter Bar -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 0 8px;">
                        <div style="display: flex; gap: 10px; background: var(--card-bg); padding: 6px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                            <button class="nav-pill active" style="padding: 8px 20px; background: var(--accent); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">All Updates</button>
                            <button class="nav-pill" style="padding: 8px 20px; background: transparent; color: var(--text-muted); border: none; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">Unread Only</button>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="filter" style="width: 14px;"></i> Latest First
                        </div>
                    </div>

                    <!-- Feed Cards Container -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${list.map((a, i) => {
                            const isHigh = a.priority === 'high';
                            const prioColor = isHigh ? '#ef4444' : (a.priority === 'medium' ? '#f59e0b' : '#3b82f6');
                            const prioBg = isHigh ? 'rgba(239,68,68,0.1)' : (a.priority === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)');
                            const typeIcon = a.type === 'urgent' ? 'alert-triangle' : (a.type === 'event' ? 'calendar' : (a.type === 'policy' ? 'shield' : 'info'));
                            const dateStr = new Date(a.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                            
                            const delay = i * 0.05;

                            // Strip emojis
                            const stripEmojis = str => str ? str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '').trim() : '';
                            const cleanFeedTitle = stripEmojis(a.title);

                            return `
                                <div class="premium-hover-card fade-in-up" onclick="viewAnnouncement('${a.id}')" style="animation-delay: ${delay}s; background: var(--card-bg); border-radius: 16px; border: 1px solid ${!a.is_read ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-color)'}; padding: 16px 20px; position: relative; overflow: hidden; cursor: pointer; box-shadow: ${!a.is_read ? '0 10px 25px -5px rgba(99, 102, 241, 0.1)' : '0 2px 4px -1px rgba(0,0,0,0.02)'}; transition: transform 0.2s ease, box-shadow 0.2s ease;">
                                    
                                    ${!a.is_read ? `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(to bottom, #6366f1, #a855f7);"></div>` : ''}

                                    <div style="display: flex; gap: 16px;">
                                        <!-- Icon -->
                                        <div style="width: 40px; height: 40px; border-radius: 10px; background: ${prioBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.5);">
                                            <i data-lucide="${typeIcon}" style="width: 18px; color: ${prioColor};"></i>
                                        </div>

                                        <!-- Content -->
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-size: 0.6rem; font-weight: 800; color: ${prioColor}; text-transform: uppercase; letter-spacing: 0.5px; background: ${prioBg}; padding: 2px 8px; border-radius: 4px;">${a.priority}</span>
                                                    ${!a.is_read ? `<span style="width: 6px; height: 6px; background: #6366f1; border-radius: 50%; box-shadow: 0 0 8px rgba(99,102,241,0.6);"></span><span style="font-size: 0.65rem; font-weight: 700; color: #6366f1;">New</span>` : ''}
                                                </div>
                                                <div style="text-align: right;">
                                                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-dark); line-height: 1;">${dateStr}</div>
                                                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">${timeSince(new Date(a.created_at))} ago</div>
                                                </div>
                                            </div>

                                            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-dark); margin: 0 0 6px 0; line-height: 1.3;">${cleanFeedTitle}</h4>
                                            
                                            <p style="font-size: 0.85rem; color: var(--text-body); line-height: 1.4; margin: 0 0 12px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-right: 20px;">
                                                ${a.description}
                                            </p>

                                            <!-- Footer of card -->
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <div style="width: 18px; height: 18px; background: #1e1b4b; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.5rem; font-weight: 800;">HA</div>
                                                    <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted);">Posted by HR Dept</span>
                                                </div>
                                                <div style="font-size: 0.7rem; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 4px; transition: gap 0.2s;" class="read-more-link">
                                                    Read Full Update <i data-lucide="arrow-right" style="width: 12px;"></i>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}

                        ${list.length === 0 ? `
                            <div style="padding: 60px 24px; text-align: center; background: var(--card-bg); border-radius: 20px; border: 1px dashed var(--border-color);">
                                <div style="width: 64px; height: 64px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                                    <i data-lucide="inbox" style="width: 32px; height: 32px; color: #cbd5e1;"></i>
                                </div>
                                <p style="font-size: 1.1rem; color: var(--text-dark); font-weight: 700; margin-bottom: 8px;">You're all caught up!</p>
                                <p style="font-size: 0.9rem; color: var(--text-muted);">No new announcements at this time.</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    },

    policies: {
        title: "Company Policies & Compliance",
        render: () => {
            // Mock data representing the assigned policies (Normally fetched from Supabase)
            const assignedPolicies = [
                { id: 'p1', title: 'Work From Home Policy v2', category: 'Leave / Attendance', version: 'v2', effective_date: '2026-04-01', status: 'pending', url: '#' },
                { id: 'p2', title: 'Employee Code of Conduct', category: 'Human Resources', version: 'v1', effective_date: '2026-01-01', status: 'acknowledged', url: '#' },
                { id: 'p3', title: 'Data Security & IT Policy', category: 'Security', version: 'v3', effective_date: '2025-11-15', status: 'acknowledged', url: '#' }
            ];

            const pending = assignedPolicies.filter(p => p.status === 'pending');
            const acked = assignedPolicies.filter(p => p.status === 'acknowledged');

            return `
                <div class="fade-in-up" style="width: 100%; margin: 0 auto; padding-bottom: 50px;">
                    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; padding: 40px; margin-bottom: 30px; position: relative; overflow: hidden; color: white;">
                        <div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1;">
                            <div>
                                <span style="background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Legal & Compliance</span>
                                <h2 style="font-size: 2.2rem; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 900; margin: 15px 0 5px; line-height: 1.1;">Company Policies</h2>
                                <p style="font-size: 1rem; color: #cbd5e1; margin: 0;">Review and acknowledge important company disclosures.</p>
                            </div>
                            <div style="display: flex; gap: 20px;">
                                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 16px; backdrop-filter: blur(12px); text-align: center; min-width: 120px;">
                                    <div style="font-size: 2rem; font-weight: 900; color: #ef4444; line-height: 1;">${pending.length}</div>
                                    <div style="font-size: 0.75rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px;">Pending Action</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 16px; backdrop-filter: blur(12px); text-align: center; min-width: 120px;">
                                    <div style="font-size: 2rem; font-weight: 900; color: #10b981; line-height: 1;">${acked.length}</div>
                                    <div style="font-size: 0.75rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px;">Acknowledged</div>
                                </div>
                            </div>
                        </div>
                        <i data-lucide="scale" style="position: absolute; right: 5%; bottom: -20px; width: 180px; height: 180px; color: white; opacity: 0.03; transform: rotate(-10deg);"></i>
                    </div>

                    ${pending.length > 0 ? `
                    <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
                        <h3 style="color: #991b1b; font-size: 1.1rem; font-weight: 800; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;"><i data-lucide="alert-circle" style="width: 20px;"></i> Pending Acknowledgements</h3>
                        <div style="display: grid; gap: 15px;">
                            ${pending.map(p => `
                                <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #fca5a5; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(239,68,68,0.1);">
                                    <div style="display: flex; gap: 16px; align-items: center;">
                                        <div style="width: 46px; height: 46px; border-radius: 12px; background: #fef2f2; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                                            <i data-lucide="file-warning"></i>
                                        </div>
                                        <div>
                                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                                                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e293b;">${p.title}</h4>
                                                <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; color: #475569;">${p.version}</span>
                                            </div>
                                            <div style="font-size: 0.8rem; color: #64748b; font-weight: 500;">Category: <b>${p.category}</b> &nbsp;&bull;&nbsp; Effective: ${new Date(p.effective_date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <button onclick="viewPolicy('${p.id}')" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(239,68,68,0.3); transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                                        Review & Acknowledge <i data-lucide="arrow-right" style="width:16px;"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <div style="background: white; border-radius: 16px; border: 1px solid var(--border-color); overflow: hidden;">
                        <div style="padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-dark); margin: 0;">All Applicable Policies</h3>
                            <div style="display: flex; gap: 10px;">
                                <select style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-dark); font-weight: 500; outline: none;">
                                    <option>All Categories</option>
                                    <option>Leave</option>
                                    <option>Security</option>
                                </select>
                            </div>
                        </div>
                        <div style="padding: 24px;">
                            ${assignedPolicies.length > 0 ? `
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr>
                                            <th style="text-align: left; padding: 12px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 2px solid #f1f5f9;">Policy Document</th>
                                            <th style="text-align: left; padding: 12px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 2px solid #f1f5f9;">Category</th>
                                            <th style="text-align: left; padding: 12px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 2px solid #f1f5f9;">Effective Date</th>
                                            <th style="text-align: left; padding: 12px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 2px solid #f1f5f9;">Status</th>
                                            <th style="text-align: right; padding: 12px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 2px solid #f1f5f9;">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${assignedPolicies.map(p => `
                                            <tr>
                                                <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9;">
                                                    <div style="display: flex; align-items: center; gap: 12px;">
                                                        <i data-lucide="file-text" style="color: var(--brand-purple); width: 20px;"></i>
                                                        <div>
                                                            <div style="font-weight: 800; color: var(--text-dark); font-size: 0.95rem;">${p.title}</div>
                                                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Version ${p.version}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9;">
                                                    <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #475569;">${p.category}</span>
                                                </td>
                                                <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; color: var(--text-dark); font-weight: 600;">
                                                    ${new Date(p.effective_date).toLocaleDateString()}
                                                </td>
                                                <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9;">
                                                    ${p.status === 'acknowledged' 
                                                        ? `<span style="color: #10b981; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;"><i data-lucide="check-circle-2" style="width: 14px;"></i> Accepted</span>`
                                                        : `<span style="color: #ef4444; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;"><i data-lucide="alert-circle" style="width: 14px;"></i> Action Req.</span>`
                                                    }
                                                </td>
                                                <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9; text-align: right;">
                                                    <button onclick="viewPolicy('${p.id}')" style="background: transparent; border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 8px; font-weight: 700; font-size: 0.75rem; color: var(--text-dark); cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='var(--brand-purple)'; this.style.color='var(--brand-purple)';" onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-dark)';">
                                                        ${p.status === 'acknowledged' ? 'View Document' : 'Read Policy'}
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `
                                <div style="text-align: center; padding: 40px;">
                                    <div style="width: 64px; height: 64px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                                        <i data-lucide="shield" style="width: 32px; height: 32px; color: #cbd5e1;"></i>
                                    </div>
                                    <p style="font-size: 1.1rem; color: var(--text-dark); font-weight: 700; margin-bottom: 8px;">No policies assigned yet 📜</p>
                                    <p style="font-size: 0.9rem; color: var(--text-muted);">When HR publishes new guidelines, they will appear here.</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }
    },


    analytics: {
        title: "Enterprise Performance Hub",
        render: () => {
            const emp = dashboardData.employee;
            const tasks = dashboardData.tasks;
            const attendance = dashboardData.attendance;
            const leaves = dashboardData.leaveAllocations;

            // 1. Calculations
            const today = new Date().toISOString().split('T')[0];
            const todayAtt = attendance.find(a => a.date === today);
            let workingHours = todayAtt?.total_hours || '0h 0m';

            const totalTasks = tasks.length || 0;
            const completedTasks = tasks.filter(t => t.status === 'completed').length || 0;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            
            const attendanceScore = (attendance.length / 26) * 100;
            const productivityScore = 92; // ELITE DEMO SCORE
            const attendanceScoreValue = 98; // ELITE DEMO SCORE
            const learningScore = 85; 
            const activeToday = workingHours !== '0h 0m';

            return `
                <!-- 1. Time Filter Pill Strip -->
                <div class="time-filter-strip fade-in-down" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <div class="time-pill active" style="padding: 8px 16px; background: var(--accent); color: white; border-radius: 50px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">Today</div>
                    <div class="time-pill" style="padding: 8px 16px; background: white; border: 1px solid var(--border-color); border-radius: 50px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Week</div>
                    <div class="time-pill" style="padding: 8px 16px; background: white; border: 1px solid var(--border-color); border-radius: 50px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Month</div>
                    <div class="time-pill" style="padding: 8px 16px; background: white; border: 1px solid var(--border-color); border-radius: 50px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Quarter</div>
                </div>

                <div class="analytics-main-layout">
                        <!-- 4. Real-time Snapshot Grid -->
                        <!-- 4. Real-time Snapshot Grid: Premium Modern Hub -->
                        <div class="analytics-top-cards fade-in-up" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                            <!-- CARD 1: ACTIVE LOGS -->
                            <div class="stat-hub-card" style="background: #f0f7ff; border: 1px solid #dbeafe; border-radius: 20px; padding: 18px; display: flex !important; flex-direction: row !important; align-items: center; gap: 16px; position: relative; overflow: hidden; transition: all 0.3s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.05); cursor: pointer;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #3b82f6;"></div>
                                <div class="hub-icon" style="background: white; color: #3b82f6; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);"><i data-lucide="clock-3" style="width:22px;"></i></div>
                                <div>
                                    <div style="font-size: 0.65rem; font-weight: 800; color: #60a5fa; letter-spacing: 0.8px; text-transform: uppercase;">Active Today</div>
                                    <div style="font-size: 1.3rem; font-weight: 950; color: #1e3a8a; margin-top: 2px;">${workingHours}</div>
                                </div>
                                <i data-lucide="chevron-right" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 14px; opacity: 0.2;"></i>
                            </div>

                            <!-- CARD 2: SKILL LEVEL -->
                            <div class="stat-hub-card" style="background: #fdf2f8; border: 1px solid #fce7f3; border-radius: 20px; padding: 18px; display: flex !important; flex-direction: row !important; align-items: center; gap: 16px; position: relative; overflow: hidden; transition: all 0.3s; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.05); cursor: pointer;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #ec4899;"></div>
                                <div class="hub-icon" style="background: white; color: #ec4899; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(236, 72, 153, 0.1);"><i data-lucide="shield" style="width:22px;"></i></div>
                                <div>
                                    <div style="font-size: 0.65rem; font-weight: 800; color: #f472b6; letter-spacing: 0.8px; text-transform: uppercase;">Expertise</div>
                                    <div style="font-size: 1.3rem; font-weight: 950; color: #831843; margin-top: 2px;">Level 4 <span style="font-size: 0.8rem; opacity: 0.4;">/ 10</span></div>
                                </div>
                                <i data-lucide="chevron-right" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 14px; opacity: 0.2;"></i>
                            </div>

                            <!-- CARD 3: BURNOUT -->
                            <div class="stat-hub-card" style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 20px; padding: 18px; display: flex !important; flex-direction: row !important; align-items: center; gap: 16px; position: relative; overflow: hidden; transition: all 0.3s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.05); cursor: pointer;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #10b981;"></div>
                                <div class="hub-icon" style="background: white; color: #10b981; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.1);"><i data-lucide="heart" style="width:22px;"></i></div>
                                <div>
                                    <div style="font-size: 0.65rem; font-weight: 800; color: #4ade80; letter-spacing: 0.8px; text-transform: uppercase;">Wellness</div>
                                    <div style="font-size: 1.3rem; font-weight: 950; color: #064e3b; margin-top: 2px;">OPTIMAL</div>
                                </div>
                                <i data-lucide="chevron-right" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 14px; opacity: 0.2;"></i>
                            </div>

                            <!-- CARD 4: KPI RANK -->
                            <div class="stat-hub-card" style="background: #f5f3ff; border: 1px solid #ede9fe; border-radius: 20px; padding: 18px; display: flex !important; flex-direction: row !important; align-items: center; gap: 16px; position: relative; overflow: hidden; transition: all 0.3s; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.05); cursor: pointer;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #8b5cf6;"></div>
                                <div class="hub-icon" style="background: white; color: #8b5cf6; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.1);"><i data-lucide="trophy" style="width:22px;"></i></div>
                                <div>
                                    <div style="font-size: 0.65rem; font-weight: 800; color: #a78bfa; letter-spacing: 0.8px; text-transform: uppercase;">KPI Status</div>
                                    <div style="font-size: 1.3rem; font-weight: 950; color: #4c1d95; margin-top: 2px;">TOP 15%</div>
                                </div>
                                <i data-lucide="chevron-right" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 14px; opacity: 0.2;"></i>
                            </div>
                        </div>

                        <!-- 5. Today's Focus: Compact Design Rows -->
                        <div class="focus-widget fade-in-up" style="padding: 20px; border-radius: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <h3 style="font-size: 0.9rem; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 8px;"><i data-lucide="target" style="color: #ef4444; width: 18px;"></i> Priority Focus</h3>
                                <div class="status-badge" style="background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 800; color: var(--text-muted);">${dashboardData.tasks.filter(t => t.status !== 'completed').length} PENDING</div>
                            </div>
                            <div class="focus-list" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                                ${dashboardData.tasks.filter(t => t.status !== 'completed').slice(0, 3).map(t => `
                                    <div class="focus-task-compact" onclick="switchSection('tasks')" style="background: white; border: 1px solid var(--border-color); padding: 14px; border-radius: 16px; display: flex; flex-direction: column; gap: 10px; transition: all 0.2s; cursor: pointer;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                            <div style="width: 20px; height: 20px; border-radius: 6px; background: ${t.priority === 'high' ? '#fef2f2' : '#eff6ff'}; display: flex; align-items: center; justify-content: center;">
                                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${t.priority === 'high' ? '#ef4444' : '#3b82f6'};"></div>
                                            </div>
                                            <span style="font-size: 0.6rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase;">${t.priority}</span>
                                        </div>
                                        <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-dark); line-height: 1.3; min-height: 2rem;">${t.title}</div>
                                        <div style="margin-top: auto;">
                                            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 700; margin-bottom: 5px;">
                                                <span style="color: var(--text-muted);">Progress</span>
                                                <span style="color: var(--accent);">${t.status === 'in_progress' ? '65%' : '0%'}</span>
                                            </div>
                                            <div style="width: 100%; height: 4px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                                                <div style="width: ${t.status === 'in_progress' ? '65%' : '0%'}; height: 100%; background: var(--accent);"></div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('') || `
                                    <div style="grid-column: span 3; text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.8rem;">
                                        🎉 All focus tasks are complete for today.
                                    </div>
                                `}
                            </div>
              
                        <!-- 6. Elite Analytics Shelf: Benchmarking & Payroll -->
                        <div class="analytics-shelf fade-in-up" style="margin-top: 25px; display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px;">
                            <div class="left-shelf">
                                <div class="analytics-chart-container" style="padding: 24px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); height: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
                                    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--accent);"></div>
                                    <div class="analytics-chart-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div>
                                            <h3 style="font-size: 1.1rem; font-weight: 900; margin: 0; color: var(--text-dark); letter-spacing: -0.3px;">Performance Benchmarking</h3>
                                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Dynamic comparison vs Regional Top 10%</p>
                                        </div>
                                        <div style="display: flex; gap: 12px; font-size: 0.65rem; font-weight: 800; background: #f8fafc; padding: 8px 14px; border-radius: 12px; border: 1px solid #f1f5f9;">
                                            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: var(--accent); border-radius: 2px;"></span> YOU</div>
                                            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #cbd5e1; border-radius: 2px;"></span> AVG</div>
                                        </div>
                                    </div>

                                    <div style="height: 240px; margin: 0 -10px;">
                                        <canvas id="productivityChart"></canvas>
                                    </div>
                                    
                                    <div class="benchmarking-metrics" style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div class="bench-item-glass" style="padding: 16px; border-radius: 18px; background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; transition: transform 0.2s, box-shadow 0.2s;">
                                            <div style="background: white; color: #3b82f6; width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);"><i data-lucide="zap" style="width: 20px;"></i></div>
                                            <div>
                                                <div style="font-size: 0.6rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Velocity</div>
                                                <div style="font-size: 1.1rem; font-weight: 900;">2.1 Days <span style="font-size: 0.7rem; color: var(--success); font-weight: 800; margin-left: 4px;">↑ 35%</span></div>
                                            </div>
                                        </div>
                                        <div class="bench-item-glass" style="padding: 16px; border-radius: 18px; background: linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%); border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; transition: transform 0.2s, box-shadow 0.2s;">
                                            <div style="background: white; color: #10b981; width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.1);"><i data-lucide="check-circle" style="width: 20px;"></i></div>
                                            <div>
                                                <div style="font-size: 0.6rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Accuracy</div>
                                                <div style="font-size: 1.1rem; font-weight: 900;">98.4% <span style="font-size: 0.7rem; color: var(--accent); font-weight: 800; margin-left: 4px;">Elite</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="right-shelf" style="display: flex; flex-direction: column; gap: 20px;">
                                <!-- 7. Earning Projection Hub: Premium Design Box -->
                                <div class="payroll-insight-card" style="padding: 24px; border-radius: 24px; background: white; border: 1px solid rgba(0,0,0,0.05); position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.02); height: 100%;">
                                    <div style="position: absolute; top: -20px; right: -20px; width: 140px; height: 140px; background: var(--accent); opacity: 0.04; border-radius: 50%;"></div>
                                    <div class="card-head" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-weight: 900; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">Net Projection</span>
                                        <div style="background: #f0fdf4; color: #10b981; padding: 4px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 800; border: 1px solid #dcfce7; display: flex; align-items: center; gap: 5px;">
                                            <div style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></div> LIVE 
                                        </div>
                                    </div>
                                    <div class="payroll-total" style="margin-bottom: 25px; text-align: center; background: #f8fafc; padding: 22px; border-radius: 20px; border: 1px solid #f1f5f9;">
                                        <span class="caption" style="font-weight: 700; opacity: 0.5; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px;">Est. Net for March</span>
                                        <div class="amount" style="font-size: 2.2rem; font-weight: 900; color: var(--text-dark); margin-top: 5px; letter-spacing: -1.5px;">₹${(emp.salary || 0).toLocaleString()}</div>
                                        <div style="display: inline-flex; align-items: center; gap: 6px; background: white; color: #059669; padding: 4px 12px; border-radius: 100px; font-size: 0.65rem; font-weight: 800; margin-top: 10px; border: 1px solid #dcfce7;">
                                            <i data-lucide="trending-up" style="width: 12px;"></i> +₹4,200 Bonus
                                        </div>
                                    </div>
                                    <div class="payroll-list" style="display: flex; flex-direction: column; gap: 12px;">
                                        <div class="row" style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;">
                                            <span style="color: var(--text-muted);">Base Pay</span> 
                                            <span style="color: var(--text-dark);">₹${(emp.salary * 0.7).toLocaleString()}</span>
                                        </div>
                                        <div class="row" style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;">
                                            <span style="color: var(--text-muted);">Incentives</span> 
                                            <span style="color: var(--accent);">₹${(emp.salary * 0.2).toLocaleString()}</span>
                                        </div>
                                        <div class="row" style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;">
                                            <span style="color: var(--text-muted);">Tax Ded.</span> 
                                            <span style="color: #ef4444;">-₹${(emp.salary * 0.1).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                        <button class="btn-premium-outline" style="width: 100%; border-radius: 12px; font-size: 0.7rem; height: 40px; justify-content: center;" onclick="showToast('Loading full breakdown...', 'info')">Breakdown</button>
                                        <button class="btn-premium-solid" style="width: 100%; border-radius: 12px; font-size: 0.7rem; height: 40px; justify-content: center;" onclick="showToast('Preparing PDF slips...', 'info')">All Slips</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                        <!-- 8. Learning & AI: Premium Design Shelf -->
                        <div class="analytics-shelf fade-in-up" style="margin-top: 25px; display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px;">
                            <div class="left-shelf">
                                <div class="analytics-chart-container" style="padding: 24px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); height: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
                                    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #6366f1;"></div>
                                    <div class="analytics-chart-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div>
                                            <h3 style="font-size: 1.1rem; font-weight: 900; margin: 0; color: var(--text-dark); letter-spacing: -0.3px;">Learning & Growth Matrix</h3>
                                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Career trajectory mapping vs Role Requirements</p>
                                        </div>
                                        <button class="btn-premium-solid" style="padding: 8px 16px; font-size: 0.7rem; border-radius: 12px;" onclick="showToast('Loading Learning Path...', 'info')">Start Path</button>
                                    </div>
                                    <div class="growth-hub-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                                        <div class="radar-box" style="height: 200px; position: relative;">
                                            <canvas id="growthRadarChart"></canvas>
                                        </div>
                                        <div class="skills-list" style="display: flex; flex-direction: column; gap: 15px;">
                                            <div class="course-item-box" style="padding: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; cursor: pointer;">
                                                <div style="background: #fdf2f8; color: #ec4899; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><i data-lucide="layout" style="width: 18px;"></i></div>
                                                <div style="flex: 1;">
                                                    <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-dark);">UI/UX Essentials</div>
                                                    <div style="font-size: 0.65rem; color: var(--text-muted);">Goal: Level 6</div>
                                                </div>
                                                <i data-lucide="play-circle" style="width: 16px; color: #ec4899;"></i>
                                            </div>
                                            <div class="skill-mini-progress">
                                                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; margin-bottom: 6px;"><span>React Design</span> <span style="color: var(--accent);">85%</span></div>
                                                <div style="height: 4px; background: #f1f5f9; border-radius: 10px;"><div style="width: 85%; height: 100%; background: var(--accent); border-radius: 10px;"></div></div>
                                            </div>
                                            <div class="skill-mini-progress">
                                                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; margin-bottom: 6px;"><span>Cloud Arch</span> <span style="color: #3b82f6;">40%</span></div>
                                                <div style="height: 4px; background: #f1f5f9; border-radius: 10px;"><div style="width: 40%; height: 100%; background: #3b82f6; border-radius: 10px;"></div></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="right-shelf" style="display: flex; flex-direction: column; gap: 20px;">
                                <!-- AI Coach Insight: Compact Box -->
                                <div class="ai-suggestion-premium" style="padding: 20px; border-radius: 24px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; box-shadow: 0 10px 25px rgba(79, 70, 229, 0.2); position: relative; overflow: hidden;">
                                    <div style="position: absolute; bottom: -10px; right: -10px; opacity: 0.1;"><i data-lucide="bot" style="width: 80px; height: 80px;"></i></div>
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                        <div style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 8px; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.5px;">AI COACH</div>
                                        <div style="width: 6px; height: 6px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);"></div>
                                    </div>
                                    <h4 style="font-size: 1rem; font-weight: 800; margin-bottom: 8px;">Workload Peak</h4>
                                    <p style="font-size: 0.8rem; line-height: 1.5; opacity: 0.9; margin-bottom: 15px;">
                                        Based on task data, you are <b>22% more efficient</b> during morning sprints. Let's block 10 AM.
                                    </p>
                                    <button style="width: 100%; background: white; color: #4f46e5; border: none; font-weight: 900; padding: 10px; border-radius: 12px; font-size: 0.75rem; cursor: pointer;" onclick="showToast('Focus block added!', 'success')">Block focus time</button>
                                </div>

                                <!-- Leave Balance: Compact Box -->
                                <div class="analytics-chart-container" style="padding: 20px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.02);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                        <h3 style="font-size: 0.9rem; font-weight: 900; margin: 0; color: var(--text-dark);">Wellness</h3>
                                        <button style="padding: 4px 10px; font-size: 0.65rem; font-weight: 800; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; border-radius: 8px;" onclick="switchSection('training')">Request</button>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 20px;">
                                        <div style="width: 70px; height: 70px; position: relative;">
                                            <canvas id="leavePieChart"></canvas>
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.6rem; font-weight: 900; color: var(--text-dark);">12/15</div>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-dark); margin-bottom: 4px;">12 Days Left</div>
                                            <div style="font-size: 0.65rem; color: var(--success); font-weight: 700;">Safe Balance</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Official Documents -->
                        <div class="content-card fade-in-up" style="margin-top: 25px; border-radius: 20px; padding: 25px;">
                            <div class="reports-header-box" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h3 class="card-title" style="margin: 0; font-size: 1rem;">Official Records & Compliance</h3>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Certified performance transcripts and tax records</p>
                                </div>
                                <div class="reports-filter-group" style="display: flex; gap: 10px;">
                                    <span class="filter-pill active" style="font-size: 0.7rem; padding: 6px 14px; background: var(--accent-soft); color: var(--accent); border-radius: 50px; font-weight: 800; cursor: pointer;">Quarterly</span>
                                    <span class="filter-pill" style="font-size: 0.7rem; padding: 6px 14px; background: #f1f5f9; color: var(--text-muted); border-radius: 50px; font-weight: 600; cursor: pointer;">Annual</span>
                                </div>
                            </div>
                            <div class="reports-grid-modern" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div class="report-item-compact" onclick="showToast('Generating Audit...', 'info')" style="padding: 12px 18px; background: white; border: 1px solid var(--border-color); border-radius: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s;">
                                    <div style="background: #eff6ff; color: #3b82f6; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i data-lucide="shield-check" style="width: 16px;"></i></div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-dark);">Performance Audit</div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted);">March '26 Transcript</div>
                                    </div>
                                    <div style="font-size: 0.6rem; font-weight: 900; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">PDF</div>
                                </div>
                                <div class="report-item-compact" onclick="showToast('Generating Log...', 'info')" style="padding: 12px 18px; background: white; border: 1px solid var(--border-color); border-radius: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s;">
                                    <div style="background: #f0fdf4; color: #10b981; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i data-lucide="calendar" style="width: 16px;"></i></div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-dark);">Attendance Log</div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted);">Q1 Attendance Report</div>
                                    </div>
                                    <div style="font-size: 0.6rem; font-weight: 900; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">PDF</div>
                                </div>
                                <div class="report-item-compact" onclick="showToast('Generating Projection...', 'info')" style="padding: 12px 18px; background: white; border: 1px solid var(--border-color); border-radius: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s;">
                                    <div style="background: #fffbeb; color: #f59e0b; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i data-lucide="bar-chart-3" style="width: 16px;"></i></div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-dark);">Tax Projection</div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted);">FY 2026-27 Estimation</div>
                                    </div>
                                    <div style="font-size: 0.6rem; font-weight: 900; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">XLSX</div>
                                </div>
                                <div class="report-item-compact" onclick="showToast('Generating Transcript...', 'info')" style="padding: 12px 18px; background: white; border: 1px solid var(--border-color); border-radius: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s;">
                                    <div style="background: #fef2f2; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i data-lucide="graduation-cap" style="width: 16px;"></i></div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-dark);">Skill Transcript</div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted);">Verified Course Completion</div>
                                    </div>
                                    <div style="font-size: 0.6rem; font-weight: 900; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">PDF</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        }
    },
    documents: {
        title: "Documents & Resources",
        render: () => `
            <div class="content-card">
                <div class="card-title">Resources</div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:15px;">
                    <div style="padding:15px; border:1px solid var(--border-color); border-radius:12px; text-align:center;">
                        <i data-lucide="file-text" style="width:30px; margin-bottom:10px; color:var(--accent);"></i>
                        <div style="font-size:0.85rem; font-weight:600;">Company Policy.pdf</div>
                    </div>
                    <div style="padding:15px; border:1px solid var(--border-color); border-radius:12px; text-align:center;">
                        <i data-lucide="file-text" style="width:30px; margin-bottom:10px; color:var(--accent);"></i>
                        <div style="font-size:0.85rem; font-weight:600;">Holiday_Calendar.pdf</div>
                    </div>
                </div>
            </div>
        `
    },
    'help-desk': {
        title: "Help Desk & Grievances",
        render: () => {
            const grievances = dashboardData.grievances;
            const openTickets = grievances.filter(g => g.status !== 'Closed').length;
            const closedTickets = grievances.filter(g => g.status === 'Closed').length;
            const helpdeskCount = grievances.filter(g => g.ticket_type === 'Helpdesk').length;
            const grievanceCount = grievances.filter(g => g.ticket_type === 'Grievance').length;

            
            return `
                <div class="support-dashboard-stats fade-in" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:20px; margin-bottom:25px;">
                    <div class="stat-card-modern" style="background:white; padding:20px; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:5px;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Helpdesk Tickets</span>
                        <span style="font-size:1.8rem; font-weight:900; color:var(--brand-blue);">${helpdeskCount}</span>
                    </div>
                    <div class="stat-card-modern" style="background:white; padding:20px; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:5px;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Grievances</span>
                        <span style="font-size:1.8rem; font-weight:900; color:#8b5cf6;">${grievanceCount}</span>
                    </div>
                    <div class="stat-card-modern" style="background:white; padding:20px; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:5px;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Open Requests</span>
                        <span style="font-size:1.8rem; font-weight:900; color:#f59e0b;">${openTickets}</span>
                    </div>
                    <div class="stat-card-modern" style="background:white; padding:20px; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:5px;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Closed</span>
                        <span style="font-size:1.8rem; font-weight:900; color:var(--success);">${closedTickets}</span>
                    </div>
                </div>

                <div class="ticket-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div class="ticket-tabs" style="margin:0;">
                        <div class="ticket-tab active" data-tab="all-requests">All Requests</div>
                        <div class="ticket-tab" data-tab="helpdesk">Helpdesk</div>
                        <div class="ticket-tab" data-tab="grievance">Grievance</div>
                        <div class="ticket-tab" data-tab="closed">Closed</div>
                        <div class="ticket-tab" data-tab="my-tickets">My Tickets</div>
                    </div>
                    <button class="btn-premium-solid" onclick="showRequestOptions()" style="border-radius:12px; padding:12px 24px;">
                        <i data-lucide="plus-circle" style="width:18px;"></i> Raise Request
                    </button>
                </div>

                <div id="grievance-tab-content" class="fade-in">
                    <div style="display:flex; justify-content:center; padding:50px;">
                        <div class="spin" style="width:30px; height:30px; border:3px solid var(--accent-hover); border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></div>
                    </div>
                </div>
            `;
        }
    }
};

function switchSection(id) {
    if (dashboardData.verification_status === 'Pending' && id !== 'overview' && id !== 'profile') {
        alert("Your profile is under HR verification. Full dashboard access will be granted once approved.");
        return; // block navigation
    }

    const section = sections[id];
    if (!section) return;

    $('.nav-item').removeClass('active');
    $(`.nav-item[data-id="${id}"]`).addClass('active');
    $('#section-title').text(section.title);

    $('#dashboard-content').fadeOut(150, function () {
        const html = section.render();
        $(this).html(html).fadeIn(150);
        
        // Force Reflow to handle browser rendering stalls
        this.offsetHeight; 
        
        lucide.createIcons();
        if (id === 'overview' || id === 'attendance') {
            updateAttendanceUI();
        }
        if (id === 'help-desk') {
            setTimeout(() => renderSupportTab('all-requests'), 100);
        }
        if (id === 'analytics') {
            setTimeout(() => initAnalyticsCharts(), 200);
        }
    });

    window.location.hash = id;
}

// =========================================
// UI HELPERS & FEEDBACK
// =========================================
function showToast(message, type = 'success') {
    const container = $('#toast-container');
    if (container.length === 0) {
        $('body').append('<div id="toast-container"></div>');
    }
    const toast = $(`
        <div class="toast ${type}" role="status" aria-live="polite">
            <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
            <span>${message}</span>
        </div>
    `);
    $('#toast-container').append(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.fadeOut(300, function () { $(this).remove(); });
    }, 4000);
}

function openTask(taskId) {
    const task = dashboardData.tasks.find(t => t.id === taskId);
    if (!task) {
        showToast("Task details not found.", "error");
        return;
    }
    // For demo, just show a toast. In a real app, this could open a modal.
    showToast(`Opening task: ${task.title}`, "success");
}

function getLocalDateStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function updateAttendanceUI() {
    const today = getLocalDateStr();
    const todayLogs = dashboardData.attendance.filter(log => log.date === today);
    const activeLog = todayLogs.find(log => !log.check_out);
    const lastCompletedLog = todayLogs.filter(log => log.check_out).sort((a, b) => new Date(b.check_out) - new Date(a.check_out))[0];

    const btn = $('#check-in-main');
    const punchLabel = $('#punch-status-label');
    const topIndicator = $('#top-status-indicator');

    if (activeLog) {
        // STATE: CHECKED IN
        if (btn.length) btn.html('<i data-lucide="log-out"></i> Punch Out Now').removeClass('btn-secondary').addClass('btn-primary');
        if (punchLabel.length) punchLabel.html('Status: <span style="color:var(--success);">Checked In ✅</span>').removeClass('inactive');
        if (topIndicator.length) topIndicator.html('<span class="dot"></span> <b>Checked In</b>').removeClass('inactive').addClass('active');
    } else if (lastCompletedLog) {
        // STATE: CHECKED OUT (for the day or a break)
        if (btn.length) btn.html('<i data-lucide="clock"></i> Punch In Again').removeClass('btn-primary').addClass('btn-secondary');
        if (punchLabel.length) punchLabel.html('Status: <span style="color:var(--danger);">Checked Out ❌</span>').addClass('inactive');
        if (topIndicator.length) topIndicator.html('<span class="dot"></span> <b>Checked Out</b>').addClass('inactive').removeClass('active');
    } else {
        // STATE: NOT STARTED
        if (btn.length) btn.html('<i data-lucide="play-circle"></i> Start Your Day').removeClass('btn-secondary').addClass('btn-primary');
        if (punchLabel.length) punchLabel.html('Status: <span style="color:var(--text-muted);">Not Started ⚪</span>').addClass('inactive');
        if (topIndicator.length) topIndicator.html('<span class="dot"></span> <b>Not Started</b>').addClass('inactive').removeClass('active');
    }
    lucide.createIcons();
}

async function handleAttendance() {
    const today = getLocalDateStr();
    const activeLog = dashboardData.attendance.find(log => log.date === today && !log.check_out);

    try {
        if (activeLog) {
            // Check Out
            const checkOutTime = new Date().toISOString();
            const { data, error } = await supabaseClient
                .from('attendance_logs')
                .update({ check_out: checkOutTime })
                .eq('id', activeLog.id)
                .select();

            if (error) throw error;
            showToast("Successfully punched out. Good job!", "success");
            activeLog.check_out = checkOutTime;
        } else {
            // Check In
            const { data, error } = await supabaseClient
                .from('attendance_logs')
                .insert({
                    employee_id: dashboardData.employee.id,
                    check_in: new Date().toISOString(),
                    date: today,
                    status: 'Present'
                })
                .select()
                .single();
            if (error) throw error;
            showToast("Welcome! Have a productive day.", "success");
            if (data) dashboardData.attendance.unshift(data);
        }

        await initDashboard();
        updateAttendanceUI();
    } catch (err) {
        console.error("Attendance error:", err);
        showToast("Action failed. Please check your connection.", "error");
    }
}


// =========================================
// PROFILE EDIT SYSTEM
// =========================================
let isEditing = false;

function toggleProfileEdit() {
    isEditing = !isEditing;
    const displays = document.querySelectorAll('.profile-display-val');
    const inputs = document.querySelectorAll('.profile-edit-input');
    const saveBar = document.getElementById('profile-save-bar');
    const editBtnText = document.getElementById('edit-btn-text');
    const editBtn = document.getElementById('btn-profile-edit');

    if (isEditing) {
        // Show inputs, hide display values
        displays.forEach(el => el.style.display = 'none');
        inputs.forEach(el => {
            el.style.display = 'block';
            el.style.transition = 'border-color 0.2s';
        });
        if (saveBar) saveBar.style.display = 'flex';
        if (editBtnText) editBtnText.textContent = 'Editing...';
        if (editBtn) {
            editBtn.style.background = '#f59e0b';
            editBtn.style.borderColor = '#f59e0b';
        }
    } else {
        // Hide inputs, show display values
        displays.forEach(el => el.style.display = '');
        inputs.forEach(el => el.style.display = 'none');
        if (saveBar) saveBar.style.display = 'none';
        if (editBtnText) editBtnText.textContent = 'Edit';
        if (editBtn) {
            editBtn.style.background = '';
            editBtn.style.borderColor = '';
        }
    }
    lucide.createIcons();
}

async function cancelLeaveRequest(requestId) {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    
    try {
        const { error } = await supabaseClient
            .from('leave_requests')
            .delete()
            .eq('id', requestId)
            .eq('status', 'pending'); // Safety check

        if (error) throw error;
        
        showToast("Leave request cancelled.", "success");
        await initDashboard();
        switchSection('leave');
    } catch (err) {
        console.error("Cancel error:", err);
        showToast("Could not cancel request.", "error");
    }
}

async function updateTaskStatus(taskId, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('tasks')
            .update({ status: newStatus })
            .eq('id', taskId);

        if (error) throw error;
        
        showToast(`Task marked as ${newStatus}`, "success");
        await initDashboard();
        
        // Re-render current section
        const currentId = $('.nav-item.active').data('id');
        switchSection(currentId);
    } catch (err) {
        console.error("Task update error:", err);
        showToast("Failed to update task.", "error");
    }
}

function viewPayslip(payId) {
    const pay = dashboardData.payslips.find(p => p.id === payId);
    if (!pay) return;
    
    const monthName = new Date(pay.year, pay.month - 1).toLocaleString('default', { month: 'long' });
    
    // For demo, we show a detailed toast. For full working, this would be a modal.
    showToast(`Viewing digital payslip for ${monthName} ${pay.year}. Real PDF generation coming soon!`, "info");
}

function cancelProfileEdit() {
    // Reset inputs to original values
    const emp = dashboardData.employee;
    document.querySelectorAll('.profile-edit-input').forEach(input => {
        const key = input.dataset.key;
        input.value = emp[key] || '';
    });
    isEditing = true; // Force toggle back
    toggleProfileEdit();
}

async function saveProfileChanges() {
    const btn = document.getElementById('btn-save-profile');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Saving...';
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { alert('Session expired'); return; }

        // Collect all changed values
        const updates = {};
        let hasChanges = false;
        document.querySelectorAll('.profile-edit-input').forEach(input => {
            const key = input.dataset.key;
            const newVal = input.value.trim();
            const oldVal = (dashboardData.employee[key] || '').toString().trim();
            if (newVal !== oldVal) {
                updates[key] = newVal || null;
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            alert('No changes detected.');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save" style="width:16px;"></i> Save Changes'; lucide.createIcons(); }
            return;
        }

        // Also update legacy combined fields for backward compat
        const getVal = (key) => {
            const el = document.querySelector(`.profile-edit-input[data-key="${key}"]`);
            return el ? el.value : (dashboardData.employee[key] || '');
        };

        updates.address = `${getVal('current_address_line1')}, ${getVal('current_city')}, ${getVal('current_state')} - ${getVal('current_pincode')}`;
        updates.bank_details = `${getVal('bank_name')} | A/C: ${getVal('bank_account_number')} | IFSC: ${getVal('bank_ifsc')}`;
        updates.emergency_contact = `${getVal('emergency_contact_name')} (${getVal('emergency_contact_relationship')}) - ${getVal('emergency_contact_number')}`;

        // Set verification_status to Pending — this triggers real-time notification for employer
        updates.verification_status = 'Pending';

        const { error } = await supabaseClient
            .from('employees')
            .update(updates)
            .eq('user_id', session.user.id);

        if (error) throw error;

        // Update local data
        Object.assign(dashboardData.employee, updates);

        // Show success feedback
        alert('✅ Profile updated! HR has been notified for re-verification.');

        // Exit edit mode and re-render
        isEditing = true;
        toggleProfileEdit();
        switchSection('profile');

    } catch (err) {
        console.error('Save error:', err);
        alert('Error saving profile. Please try again.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="save" style="width:16px;"></i> Save Changes';
            lucide.createIcons();
        }
    }
}

$(document).ready(() => {
    initDashboard();

    $('.nav-item').on('click', function (e) {
        e.preventDefault();
        switchSection($(this).data('id'));
    });

    $('.qa-item').on('click', function () {
        const action = $(this).data('qa');
        switchSection(action);
    });
    
    // Leave Application Logic (Delegation)
    $(document).on('change', '#apply-leave-start, #apply-leave-end', function() {
        updateLeaveDays();
    });

    $(document).on('submit', '#leave-apply-form', function(e) {
        e.preventDefault();
        handleLeaveSubmit();
    });

    // Attendance button click (using delegation because it's in a rendered template)
    $(document).on('click', '#check-in-main', function () {
        handleAttendance();
    });

    // Theme Toggle
    $('#theme-toggle').on('click', function () {
        const isDark = $('body').attr('data-theme') === 'dark';
        $('body').attr('data-theme', isDark ? 'light' : 'dark');
        $(this).html(isDark ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>');
        lucide.createIcons();
    });

    // Live Timer & Attendance Tracking
    setInterval(() => {
        const now = new Date();
        
        // 1. Update Clock (HH:mm:ss format)
        const timeStr = now.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true 
        });
        $('#live-timer').text(timeStr);

        // 2. Update Date (e.g., Monday, 30 March 2026)
        const dateStr = now.toLocaleDateString('en-IN', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        $('#current-date').text(dateStr);

        // 3. Update Attendance Timer (Working Hours)
        updateWorkingHoursTimer();
    }, 1000);
});

function updateLeaveDays() {
    const start = $('#apply-leave-start').val();
    const end = $('#apply-leave-end').val();
    const dayDisplay = $('#apply-leave-days');

    if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (endDate < startDate) {
            dayDisplay.text('Invalid Range').css('color', 'var(--danger)');
            return 0;
        }

        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        dayDisplay.text(`${diffDays} Day${diffDays > 1 ? 's' : ''}`).css('color', 'var(--accent)');
        return diffDays;
    }
    dayDisplay.text('0 Days').css('color', 'var(--text-muted)');
    return 0;
}

// Legacy helper (will be deprecated)
async function showGrievanceDetail(id) {
    return viewGrievanceDetail(id);
}

async function handleLeaveSubmit() {
    console.log("Submit attempt initiated.");
    const btn = $('#btn-submit-leave');
    const originalText = btn.text();
    
    const leaveTypeId = $('#apply-leave-type').val();
    const startDate = $('#apply-leave-start').val();
    const endDate = $('#apply-leave-end').val();
    const reason = $('#apply-leave-reason').val();

    console.log("Field values:", { leaveTypeId, startDate, endDate, reason });
    
    // Validations
    if (!leaveTypeId) { showToast("Please select a leave type.", "error"); return; }
    if (!startDate || !endDate) { showToast("Please select both dates.", "error"); return; }
    if (!reason.trim()) { showToast("Please provide a reason.", "error"); return; }
    
    // Smart Rule: Prevent past dates
    const today = new Date().toISOString().split('T')[0];
    if (startDate < today) {
        showToast("Cannot apply for leave on past dates.", "error");
        return;
    }

    const days = updateLeaveDays();
    if (days <= 0) {
        showToast("Please select a valid date range.", "error");
        return;
    }

    // Smart Rule: Check Balance
    const allocation = dashboardData.leaveAllocations.find(al => al.leave_type_id == leaveTypeId);
    console.log("Found allocation:", allocation);

    if (!allocation) {
        showToast("No leave balance allocation found for this type. Please contact HR.", "error");
        return;
    }

    if (allocation.remaining < days) {
        showToast(`Insufficient balance. You only have ${allocation.remaining} days left.`, "error");
        return;
    }

    try {
        console.log("Proceeding with Supabase insert...");
        btn.prop('disabled', true).text('Submitting...');
        
        const { data, error } = await supabaseClient
            .from('leave_requests')
            .insert({
                employee_id: dashboardData.employee.id,
                leave_type_id: parseInt(leaveTypeId),
                start_date: startDate,
                end_date: endDate,
                reason: reason,
                status: 'pending'
            })
            .select();

        if (error) {
            console.error("DB Error Detail:", error);
            throw error;
        }

        console.log("Insert successful:", data);
        showToast("Leave request submitted successfully! Pending HR approval.", "success");
        
        // Refresh data and UI
        await initDashboard();
        switchSection('leave');

    } catch (err) {
        console.error("Leave submission error:", err);
        showToast(`Submission failed: ${err.message || 'Unknown Error'}`, "error");
    } finally {
        btn.prop('disabled', false).text(originalText);
        lucide.createIcons();
    }
}

function updateWorkingHoursTimer() {
    const today = getLocalDateStr();
    const todayLogs = dashboardData.attendance.filter(log => log.date === today);
    
    let totalMs = 0;
    
    // Add completed sessions
    todayLogs.forEach(log => {
        if (log.check_in && log.check_out) {
            totalMs += (new Date(log.check_out) - new Date(log.check_in));
        }
    });
    
    // Add active session
    const activeLog = todayLogs.find(log => !log.check_out);
    if (activeLog && activeLog.check_in) {
        totalMs += (new Date() - new Date(activeLog.check_in));
    }
    
    // Format to HH:mm:ss
    const totalSeconds = Math.floor(totalMs / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    $('#att-timer').text(timeStr);
}

// =========================================
// GRIEVANCE MODULE HELPER FUNCTIONS
// =========================================

function renderSupportTab(tabId) {
    $('.ticket-tab').removeClass('active');
    $(`.ticket-tab[data-tab="${tabId}"]`).addClass('active');

    const container = $('#grievance-tab-content');
    const allGrievances = dashboardData.grievances || [];

    if (tabId === 'all-requests' || tabId === 'my-tickets') {
        // Show only active tickets in All/My tabs (excluding Resolved/Closed)
        const activeTickets = allGrievances.filter(g => g.status !== 'Closed' && g.status !== 'Resolved');
        container.html(renderGrievanceList(activeTickets, tabId === 'my-tickets' ? "You have no active requests." : "No active requests found."));
    } else if (tabId === 'helpdesk') {
        const filtered = allGrievances.filter(g => g.ticket_type === 'Helpdesk' && g.status !== 'Closed' && g.status !== 'Resolved');
        container.html(renderGrievanceList(filtered, "No active Helpdesk tickets"));
    } else if (tabId === 'grievance') {
        const filtered = allGrievances.filter(g => g.ticket_type === 'Grievance' && g.status !== 'Closed' && g.status !== 'Resolved');
        container.html(renderGrievanceList(filtered, "No active Grievances"));
    } else if (tabId === 'closed') {
        // Show both Closed and Resolved in the closed tab
        const filtered = allGrievances.filter(g => g.status === 'Closed' || g.status === 'Resolved');
        container.html(renderGrievanceList(filtered, "No completed tickets found."));
    }
    lucide.createIcons();
}

function showRequestOptions() {
    const container = $('#grievance-tab-content');
    container.html(`
        <div class="fade-in" style="max-width:800px; margin:0 auto; padding:40px 0; text-align:center;">
            <h2 style="font-weight:900; font-size:2rem; margin-bottom:10px;">How can we help you today?</h2>
            <p style="color:var(--text-muted); margin-bottom:40px;">Select the type of request you want to raise.</p>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px;">
                <div class="option-card" onclick="renderSupportForm('Helpdesk')" style="background:white; border:2px solid var(--border-color); padding:40px; border-radius:24px; cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-align:left;" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 40px rgba(59, 130, 246, 0.1)';" onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <div style="width:60px; height:60px; background:#eff6ff; border-radius:16px; display:flex; align-items:center; justify-content:center; color:var(--brand-blue); margin-bottom:24px;">
                        <i data-lucide="wrench" style="width:30px;"></i>
                    </div>
                    <h3 style="font-weight:800; margin-bottom:10px; color:var(--text-dark);">Helpdesk Request</h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; margin-bottom:20px;">For general issues like IT support, access requests, office admin queries, or payroll clarification.</p>
                    <ul style="padding:0; list-style:none; font-size:0.85rem; color:var(--text-body); display:flex; flex-direction:column; gap:8px;">
                        <li style="display:flex; align-items:center; gap:8px;"><i data-lucide="check-circle" style="width:14px; color:var(--success);"></i> IT & Hardware Issues</li>
                        <li style="display:flex; align-items:center; gap:8px;"><i data-lucide="check-circle" style="width:14px; color:var(--success);"></i> Software Access</li>
                        <li style="display:flex; align-items:center; gap:8px;"><i data-lucide="check-circle" style="width:14px; color:var(--success);"></i> General Admin Support</li>
                    </ul>
                </div>

                <div class="option-card" onclick="renderSupportForm('Grievance')" style="background:white; border:2px solid var(--border-color); padding:40px; border-radius:24px; cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-align:left;" onmouseover="this.style.borderColor='#8b5cf6'; this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 40px rgba(139, 92, 246, 0.1)';" onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <div style="width:60px; height:60px; background:#f5f3ff; border-radius:16px; display:flex; align-items:center; justify-content:center; color:#8b5cf6; margin-bottom:24px;">
                        <i data-lucide="scale" style="width:30px;"></i>
                    </div>
                    <h3 style="font-weight:800; margin-bottom:10px; color:var(--text-dark);">Grievance Request</h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; margin-bottom:20px;">For sensitive issues requiring confidentiality and formal resolution by HR or senior management.</p>
                    <ul style="padding:0; list-style:none; font-size:0.85rem; color:var(--text-body); display:flex; flex-direction:column; gap:8px;">
                        <li style="display:flex; align-items:center; gap:8px;"><i data-lucide="lock" style="width:14px; color:#ef4444;"></i> Confidential Handling</li>
                        <li style="display:flex; align-items:center; gap:8px;"><i data-lucide="check-circle" style="width:14px; color:var(--success);"></i> Harassment Complaints</li>
                        <li style="display:flex; align-items:center; gap:8px;"><i data-lucide="check-circle" style="width:14px; color:var(--success);"></i> Workplace Disputes</li>
                    </ul>
                </div>
            </div>
            
            <button class="btn-premium-outline" onclick="renderSupportTab('all-requests')" style="margin-top:40px;">Cancel</button>
        </div>
    `);
    lucide.createIcons();
}

function renderSupportForm(type) {
    const isHelpdesk = type === 'Helpdesk';
    const categories = isHelpdesk 
        ? ['IT Support', 'Admin & Office', 'Payroll/Salary Query', 'Access Request', 'Other']
        : ['HR Policy', 'Manager Concern', 'Workplace Harassment', 'Salary Dispute', 'Discrimination', 'Other'];

    const container = $('#grievance-tab-content');
    container.html(`
        <div class="grievance-form-container fade-in" style="max-width:800px; margin:0 auto; background:white; padding:40px; border-radius:24px; border:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:30px;">
                <div style="width:48px; height:48px; background:${isHelpdesk ? '#eff6ff' : '#f5f3ff'}; border-radius:12px; display:flex; align-items:center; justify-content:center; color:${isHelpdesk ? 'var(--brand-blue)' : '#8b5cf6'};">
                    <i data-lucide="${isHelpdesk ? 'wrench' : 'scale'}" style="width:24px;"></i>
                </div>
                <div>
                    <h2 style="margin:0; font-weight:900;">New ${type} Request</h2>
                    <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.9rem;">${isHelpdesk ? 'General operational support' : 'Confidential sensitive issue'}</p>
                </div>
            </div>

            <form id="grievance-raise-form" data-type="${type}">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                    <div class="form-group-modern" style="grid-column: span 2;">
                        <label>Subject / Short Title*</label>
                        <input type="text" id="grv-subject" class="form-control-modern" placeholder="${isHelpdesk ? 'e.g. Laptop not starting' : 'e.g. Misbehavior by colleague'}" required>
                    </div>
                    <div class="form-group-modern">
                        <label>Category*</label>
                        <select id="grv-category" class="form-control-modern" required>
                            <option value="">Select Category</option>
                            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group-modern">
                        <label>Priority Level*</label>
                        <select id="grv-priority" class="form-control-modern" required>
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                    ${!isHelpdesk ? `
                    <div class="form-group-modern">
                        <label>Date of Incident*</label>
                        <input type="date" id="grv-incident-date" class="form-control-modern" required>
                    </div>
                    ` : ''}
                </div>

                <div class="form-group-modern" style="margin-bottom:20px;">
                    <label>Detailed Description*</label>
                    <textarea id="grv-description" class="form-control-modern" rows="6" placeholder="Provide as much detail as possible..." required style="resize:none;"></textarea>
                </div>

                <div class="form-group-modern" style="margin-bottom:25px;">
                    <label>Supporting Attachment (Optional)</label>
                    <div style="border: 2px dashed var(--border-color); padding: 30px; border-radius: 16px; text-align: center; background:var(--main-bg); transition:0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-color)'">
                        <i data-lucide="upload-cloud" style="width:32px; color:var(--text-muted); margin-bottom:10px;"></i>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Upload screenshots or documents to support your request</p>
                        <input type="file" id="grv-attachment" style="display:none;">
                        <button type="button" class="btn-premium-outline" onclick="$('#grv-attachment').click()">Choose File</button>
                    </div>
                </div>

                ${!isHelpdesk ? `
                <div class="confidential-box" style="background:#fef2f2; border:1px solid #fee2e2; padding:20px; border-radius:16px; margin-bottom:30px; display:flex; gap:15px; align-items:flex-start;">
                    <input type="checkbox" id="grv-confidential" style="width:20px; height:20px; margin-top:2px; cursor:pointer;" checked>
                    <div>
                        <label for="grv-confidential" style="font-weight:800; color:#991b1b; display:block; margin-bottom:4px; cursor:pointer;">Mark as Confidential</label>
                        <p style="font-size:0.8rem; color:#b91c1c; margin:0; line-height:1.5;">Grievances are handled with strict privacy. Only authorized HR personnel and senior management will have visibility into this request.</p>
                    </div>
                </div>
                ` : ''}

                <div style="display:flex; justify-content:flex-end; gap:15px; border-top:1px solid var(--border-color); padding-top:30px;">
                    <button type="button" class="btn-premium-outline" onclick="showRequestOptions()">Back</button>
                    <button type="submit" class="btn-premium-solid" id="btn-submit-grievance" style="min-width:180px;">
                        Submit ${type} <i data-lucide="send" style="width:16px; margin-left:8px;"></i>
                    </button>
                </div>
            </form>
        </div>
    `);
    lucide.createIcons();
}

let activeGrievanceFilter = { status: 'all', category: 'all' };

function renderGrievanceList(tickets, emptyMsg) {
    if (tickets.length === 0) {
        return `
            <div style="text-align:center; padding:80px 20px; color:var(--text-muted); background:white; border-radius:20px; border:1px solid var(--border-color);">
                <div style="background:var(--main-bg); width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; color:var(--text-muted); opacity:0.5;">
                    <i data-lucide="inbox" style="width:30px; height:30px;"></i>
                </div>
                <h3 style="margin:0; font-size:1.1rem; color:var(--text-dark);">${emptyMsg}</h3>
                <p style="margin:8px 0 0; font-size:0.85rem;">When you raise a request, it will appear here.</p>
            </div>
        `;
    }

    return `
        <div class="support-table-container fade-in">
            <table class="support-table">
                <thead>
                    <tr>
                        <th width="150">Type & ID</th>
                        <th>Subject</th>
                        <th width="150">Category</th>
                        <th width="120">Date</th>
                        <th width="120">Priority</th>
                        <th width="120">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${tickets.map(t => renderGrievanceRow(t)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderGrievanceRow(t) {
    const isHelpdesk = t.ticket_type === 'Helpdesk';
    const typeLabel = t.ticket_type || 'Grievance';
    const typeIcon = isHelpdesk ? 'wrench' : 'scale';
    const typeColor = isHelpdesk ? 'var(--brand-blue)' : '#8b5cf6';
    
    const displayDate = t.incident_date ? new Date(t.incident_date).toLocaleDateString() : new Date(t.created_at).toLocaleDateString();
    const priorityClass = `priority-${t.priority.toLowerCase()}`;
    const statusClass = `status-${t.status.toLowerCase().replace(' ', '-')}`;

    return `
        <tr class="support-row" onclick="viewGrievanceDetail('${t.id}')">
            <td>
                <div class="ticket-type-tag" style="color:${typeColor};">
                    <i data-lucide="${typeIcon}"></i>
                    <span>${typeLabel}</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; font-weight:600;">#${t.id.substring(0, 8).toUpperCase()}</div>
            </td>
            <td>
                <div style="font-weight:700; color:var(--text-dark);">${t.subject}</div>
                ${t.is_confidential ? `<span style="font-size:0.6rem; color:#ef4444; font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:3px; margin-top:4px;"><i data-lucide="lock" style="width:10px;"></i> Confidential</span>` : ''}
            </td>
            <td style="font-weight:600; color:var(--text-body);">${t.category}</td>
            <td style="font-weight:600; color:var(--text-body);">${displayDate}</td>
            <td>
                <span class="priority-badge ${priorityClass}">${t.priority}</span>
            </td>
            <td>
                <span class="status-row-pill ${statusClass}">${t.status}</span>
            </td>
        </tr>
    `;
}

async function viewGrievanceDetail(id) {
    currentGrievanceId = id; // Critical fix: Update active context
    const grievance = dashboardData.grievances.find(g => g.id === id);
    if (!grievance) return;

    const container = $('#grievance-tab-content');
    container.html(`
        <div style="margin-bottom:20px;">
            <button class="btn-premium-outline" onclick="renderSupportTab('all-requests')"><i data-lucide="arrow-left" style="width:16px;"></i> Back to Support Center</button>
        </div>
        <div class="ticket-detail-view fade-in">
            <div class="chat-container">
                <div class="chat-header">
                    <div>
                        <h3 style="margin:0;">Ticket Conversation</h3>
                        <p style="font-size:0.75rem; color:var(--text-muted); margin:4px 0 0;">ID: #${grievance.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <div class="ticket-status-pill status-${grievance.status.toLowerCase().replace(' ', '-')}">
                        ${grievance.status}
                    </div>
                </div>
                <div class="chat-messages" id="grievance-chat-messages">
                    <div style="display:flex; justify-content:center; padding:20px;">
                        <div class="spin" style="width:20px; height:20px; border:2px solid var(--accent); border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></div>
                    </div>
                </div>
                <div class="chat-input-area">
                    <input type="text" id="grievance-message-input" placeholder="Add a comment or update...">
                    <button class="icon-btn" style="width:48px; border-radius:12px; background:var(--accent); color:white;" onclick="sendGrievanceMessage('${grievance.id}')">
                        <i data-lucide="send"></i>
                    </button>
                </div>
            </div>
            <div class="ticket-info-sidebar">
                <div class="info-card">
                    <h4>Ticket Information</h4>
                    <div class="info-row"><label>Type</label><span style="font-weight:700; color:${grievance.ticket_type === 'Helpdesk' ? 'var(--brand-blue)' : '#8b5cf6'};">${grievance.ticket_type || 'Grievance'}</span></div>
                    <div class="info-row"><label>Category</label><span>${grievance.category}</span></div>
                    <div class="info-row"><label>Priority</label><span class="ticket-priority-pill priority-${grievance.priority.toLowerCase()}">${grievance.priority}</span></div>
                    <div class="info-row"><label>Assigned To</label><span>${grievance.assigned_to || 'Support Team'}</span></div>
                    <div class="info-row"><label>Date Created</label><span>${new Date(grievance.created_at).toLocaleDateString()}</span></div>
                </div>
                <div class="info-card">
                    <h4>Description</h4>
                    <p style="font-size:0.85rem; line-height:1.6; color:var(--text-body); white-space:pre-wrap;">${grievance.description}</p>
                </div>
            </div>
        </div>
    `);
    $('#grievance-detail-modal').fadeIn(200).css('display', 'flex');
    setupGrievanceRealtime(id);
    fetchGrievanceMessages(id);
    lucide.createIcons();
}

async function fetchGrievanceMessages(grievanceId) {
    const chatContainer = $('#grievance-chat-messages');
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const currentUserId = session?.user?.id;

        const { data, error } = await supabaseClient
            .from('grievance_messages')
            .select('*')
            .eq('grievance_id', grievanceId)
            .eq('is_internal', false) // Critical Security: Hide internal notes from employees
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            chatContainer.html('<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.85rem;">No comments yet. Start the conversation!</div>');
        } else {
            chatContainer.html(data.map(m => {
                const isEmployer = m.sender_role === 'Employer' || m.sender_role === 'System';
                const isMine = m.sender_id === currentUserId && !isEmployer;
                
                // Get sender name from lookup map
                let senderName = dashboardData.userLookupMap[m.sender_id];
                if (isMine) senderName = 'Me';
                if (m.sender_role === 'System') senderName = 'System';
                if (!senderName) senderName = isEmployer ? 'Personnel' : 'Employee';

                return `
                    <div class="chat-msg" data-id="${m.id}" style="margin-bottom:12px; display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'};">
                        <div class="${isMine ? 'message-employee' : 'message-hr'}" style="max-width:85%; padding:14px 18px; border-radius:${isMine ? '18px 18px 2px 18px' : '18px 18px 18px 2px'}; background:${isMine ? 'var(--accent)' : '#f1f5f9'}; color:${isMine ? 'white' : '#1e293b'}; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                            <div style="font-size:0.95rem; line-height:1.5;">${m.message}</div>
                            <div style="font-size:0.7rem; margin-top:6px; opacity:0.8; text-align:right;">
                                ${senderName} • ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                `;
            }).join(''));
        }
        // Scroll to bottom
        chatContainer.scrollTop(chatContainer[0].scrollHeight);
    } catch (err) {
        console.error("Fetch messages error:", err);
        chatContainer.html('<div style="text-align:center; padding:20px; color:var(--danger);">Failed to load messages.</div>');
    }
}

async function sendGrievanceMessage(grievanceId) {
    const input = $('#grievance-message-input');
    const msg = input.val().trim();
    if (!msg) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const { error } = await supabaseClient
            .from('grievance_messages')
            .insert({
                grievance_id: grievanceId,
                sender_id: session.user.id,
                message: msg
            });

        if (error) throw error;
        input.val('');
        // No need to call fetchGrievanceMessages(grievanceId) here
        // as the setupGrievanceRealtime 'INSERT' listener will handle the display
        // of our own message as well for total sync!
    } catch (err) {
        console.error("Send message error:", err);
        showToast("Failed to send message.", "error");
    }
}

function renderGrievanceSuccess(ticketId) {
    const container = $('#grievance-tab-content');
    container.html(`
        <div class="fade-in" style="max-width:600px; margin:60px auto; text-align:center; background:white; padding:60px 40px; border-radius:32px; border:1px solid var(--border-color); box-shadow: 0 20px 60px rgba(0,0,0,0.05);">
            <div style="width:100px; height:100px; background:#dcfce7; color:#16a34a; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 30px; border:8px solid #f0fdf4;">
                <i data-lucide="check-circle-2" style="width:50px; height:50px;"></i>
            </div>
            
            <h2 style="font-weight:900; font-size:2rem; color:var(--text-dark); margin-bottom:12px;">Submission Successful!</h2>
            <p style="color:var(--text-muted); font-size:1.05rem; line-height:1.6; margin-bottom:30px;">Your request has been recorded and encrypted. Our specialized team will review it shortly.</p>
            
            <div style="background:var(--main-bg); padding:24px; border-radius:20px; margin-bottom:40px; border:1px solid var(--border-color);">
                <span style="display:block; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:8px;">Your Ticket ID</span>
                <span style="display:block; font-size:2rem; font-weight:900; color:var(--accent); font-family:monospace; letter-spacing:2px;">GRV-${ticketId.substring(0, 8).toUpperCase()}</span>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:16px;">
                <button class="btn-premium-solid" onclick="renderSupportTab('my-tickets')" style="width:100%; padding:18px;">
                    Track in My Requests <i data-lucide="arrow-right" style="width:18px; margin-left:8px;"></i>
                </button>
                <button class="btn-premium-outline" onclick="showRequestOptions()" style="width:100%; padding:18px;">
                    Raise Another Request
                </button>
            </div>
        </div>
    `);
    lucide.createIcons();
}

async function handleGrievanceSubmit(e) {
    e.preventDefault();
    const form = $(e.target);
    const type = form.data('type');
    const btn = $('#btn-submit-grievance');
    const originalContent = btn.html();

    const subject = $('#grv-subject').val()?.trim();
    const category = $('#grv-category').val();
    const priority = $('#grv-priority').val();
    const description = $('#grv-description').val()?.trim();
    const is_confidential = $('#grv-confidential').is(':checked') || (type === 'Grievance'); 
    const incident_date = $('#grv-incident-date').val() || null;

    if (!subject || !description || !category) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    btn.prop('disabled', true).html('<i data-lucide="loader" class="spin" style="width:16px; margin-right:8px;"></i> Processing...');
    lucide.createIcons();

    try {
        // 1. Create Grievance
        const { data: grvData, error: grvError } = await supabaseClient
            .from('grievances')
            .insert({
                employee_id: dashboardData.employee.id,
                subject,
                category,
                priority,
                description,
                is_confidential,
                incident_date,
                ticket_type: type,
                status: 'Pending'
            })
            .select()
            .single();

        if (grvError) throw grvError;

        const ticketId = grvData.id;

        // 2. Set Initial Visibility (Auto-Assign to HR and Employer)
        const initialAssignments = [
            { grievance_id: ticketId, role: 'HR' },
            { grievance_id: ticketId, role: 'Employer' }
        ];
        
        await supabaseClient.from('grievance_assignments').insert(initialAssignments);

        // 3. Create Timeline Record (Audit Log)
        await supabaseClient.from('grievance_logs').insert([{
            grievance_id: ticketId,
            action: 'Ticket Created',
            actor_name: `${dashboardData.employee.first_name} ${dashboardData.employee.last_name || ''}`,
            actor_role: 'Employee',
            details: `New ${type} request raised via Employee Self-Service.`
        }]);

        // 4. Send Notification to Admin/Employer
        // (Assuming you have a notifications table for the Employer dashboard)
        await supabaseClient.from('notices').insert([{
            title: `🆘 New ${type} Raised`,
            content: `Employee ID: ${dashboardData.employee.emp_id || 'TBD'} raised a ${priority} priority ${type}: "${subject}"`,
            is_global: false,
            created_at: new Date().toISOString()
        }]);

        // 5. Success
        showToast(`${type} request submitted successfully!`, "success");
        
        // Refresh local data stealthily
        const { data: newData } = await supabaseClient
            .from('grievances')
            .select('*')
            .eq('employee_id', dashboardData.employee.id)
            .order('created_at', { ascending: false });
        
        dashboardData.grievances = newData || [];

        // Show Success UI
        renderGrievanceSuccess(ticketId);

    } catch (err) {
        console.error("Submission error:", err);
        showToast(`Submission failed: ${err.message || 'Unknown error'}`, "error");
    } finally {
        btn.prop('disabled', false).html(originalContent);
        lucide.createIcons();
    }
}

// Event Listeners (ensure they are attached)
$(document).off('submit', '#grievance-raise-form');
$(document).on('submit', '#grievance-raise-form', handleGrievanceSubmit);

$(document).off('click', '.ticket-tab');
$(document).on('click', '.ticket-tab', function() {
    const tabId = $(this).data('tab');
    if (tabId) renderSupportTab(tabId);
});

let grievanceSubscription = null;

function setupGrievanceRealtime(id) {
    if (grievanceSubscription) {
        supabaseClient.removeChannel(grievanceSubscription);
    }

    grievanceSubscription = supabaseClient
        .channel(`grievance-${id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'grievance_messages', 
            filter: `grievance_id=eq.${id}` 
        }, (payload) => {
            appendRealtimeMessage(payload.new);
        })
        .subscribe();
}

async function appendRealtimeMessage(m) {
    const chatContainer = $('#grievance-chat-messages'); // Corrected to match dashboard.js ID
    if (!chatContainer.length) return;
    
    // Check if message already exists (to prevent duplication from async fetch)
    if ($(`.chat-msg[data-id="${m.id}"]`).length) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const currentUserId = session?.user?.id;

    const isEmployer = m.sender_role === 'Employer' || m.sender_role === 'System';
    const isMine = m.sender_id === currentUserId && !isEmployer;

    // Security: Never show internal/private HR notes to employees in real-time
    if (m.is_internal) return;

    // Get sender name from lookup map
    let senderName = dashboardData.userLookupMap[m.sender_id];
    if (isMine) senderName = 'Me';
    if (m.sender_role === 'System') senderName = 'System';
    if (!senderName) senderName = isEmployer ? 'Personnel' : 'Employee';

    chatContainer.append(`
        <div class="chat-msg" data-id="${m.id}" style="margin-bottom:12px; display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'};">
            <div class="${isMine ? 'message-employee' : 'message-hr'}" style="max-width:85%; padding:14px 18px; border-radius:${isMine ? '18px 18px 2px 18px' : '18px 18px 18px 2px'}; background:${isMine ? 'var(--accent)' : '#f1f5f9'}; color:${isMine ? 'white' : '#1e293b'}; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="font-size:0.95rem; line-height:1.5;">${m.message}</div>
                <div style="font-size:0.7rem; margin-top:6px; opacity:0.8; text-align:right;">
                    ${senderName} • ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    `);

    chatContainer.scrollTop(chatContainer[0].scrollHeight);
}

// =========================================
// ANALYTICS & CHARTS LOGIC
// =========================================

function initAnalyticsCharts() {
    const isDark = $('body').attr('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    // 1. Productivity & Attendance (Combined Bar/Line Chart) - GOLD TIER DEMO
    const productivityCtx = document.getElementById('productivityChart');
    if (productivityCtx) {
        new Chart(productivityCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'High-Focus Tasks',
                    data: [6, 8, 7, 9, 8, 2, 1],
                    backgroundColor: '#4D4286',
                    borderRadius: 8,
                    order: 2,
                    barThickness: 28,
                }, {
                    label: 'Logged Hours',
                    data: [9.5, 9.8, 9.0, 9.2, 10.0, 4, 1],
                    borderColor: '#2563eb',
                    borderWidth: 4,
                    pointBackgroundColor: '#2563eb',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    type: 'line',
                    fill: false,
                    tension: 0.4,
                    order: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        padding: 12,
                        backgroundColor: '#1e293b',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 12 },
                        cornerRadius: 8,
                        callbacks: {
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                if (index === 4) return '🚀 Peak Performance on Friday!';
                                if (index >= 5) return '✨ Weekend activity detected';
                                return '✅ Above average consistency';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { weight: '800', size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { color: textColor, font: { weight: '600' } }
                    }
                }
            }
        });
    }

    // 2. Leave Distribution (Pie Chart) - DEMO STATUS
    const leaveCtx = document.getElementById('leavePieChart');
    if (leaveCtx) {
        new Chart(leaveCtx, {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Remaining'],
                datasets: [{
                    data: [3, 12],
                    backgroundColor: ['#4D4286', '#f1f5f9'],
                    borderColor: 'transparent',
                    hoverOffset: 15,
                    weight: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '78%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8
                    }
                }
            }
        });
    }

    // 3. Growth & Skill Radar Chart (Enterprise Level) - DEMO EXPERT
    const growthCtx = document.getElementById('growthRadarChart');
    if (growthCtx) {
        new Chart(growthCtx, {
            type: 'radar',
            data: {
                labels: ['Engineering', 'UX Strategy', 'Leadership', 'Execution', 'Analytical'],
                datasets: [{
                    label: 'Prakash Skillset',
                    data: [92, 88, 75, 95, 90],
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        ticks: { display: false, stepSize: 20 },
                        grid: { color: gridColor, circular: true },
                        angleLines: { color: gridColor },
                        pointLabels: {
                            font: { size: 11, weight: '800', family: 'Plus Jakarta Sans' },
                            color: '#475569'
                        }
                    }
                }
            }
        });
    }
}
// =========================================
// LMS & TRAINING SYSTEM LOGIC (CORE ENGINE)
// =========================================

function viewCourse(courseId) {
    const course = dashboardData.courses.find(c => c.id === courseId);
    if (!course) return;

    $('#dashboard-content').fadeOut(200, function() {
        const html = renderCoursePlayer(courseId);
        $(this).html(html).fadeIn(200);
        
        // Force Reflow
        this.offsetHeight;
        
        lucide.createIcons();
        window.scrollTo(0,0);
    });
}

function renderCoursePlayer(courseId) {
    const course = dashboardData.courses.find(c => c.id === courseId);
    const assignment = dashboardData.courseAssignments.find(a => a.course_id === courseId);
    const courseModules = dashboardData.modules.filter(m => m.course_id === courseId).sort((a, b) => a.order - b.order);
    
    // Default to first module if not started
    let activeModule = courseModules[0];
    
    return `
        <div class="lms-player fade-in" style="display: grid; grid-template-columns: 1fr 350px; gap: 30px; height: calc(100vh - 150px);">
            <!-- Left: Main Content Area -->
            <div class="player-main" style="display: flex; flex-direction: column; gap: 20px;">
                <div class="player-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn-premium-outline" style="border-radius: 50px; padding: 6px 16px; font-size: 0.75rem;" onclick="switchSection('training')">
                        <i data-lucide="chevron-left" style="width: 14px;"></i> Back to Hub
                    </button>
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted);">${course.category} • ${assignment.progress}% Completed</div>
                </div>

                <!-- 1. Video/Content Container -->
                <div class="content-frame" style="background: #000; border-radius: 24px; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                    ${activeModule.type === 'video' ? `
                        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; color: white;">
                             <i data-lucide="play-circle" style="width: 80px; height: 80px; opacity: 0.3; margin-bottom: 20px;"></i>
                             <div style="font-size: 1.2rem; font-weight: 800;">[Video Player Demo: ${activeModule.title}]</div>
                             <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 10px;">Streaming at 1080p • 00:00 / ${activeModule.duration}</div>
                             <div style="margin-top: 30px;">
                                <button class="btn-premium-solid" style="background: white !important; color: black !important; border: none; padding: 12px 30px; border-radius: 12px; font-weight: 900; box-shadow: 0 10px 20px rgba(0,0,0,0.2);" onclick="simulateModuleComplete('${courseId}', '${activeModule.id}')">Simulate Completion</button>
                             </div>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; color: white; padding: 40px;">
                             <i data-lucide="file-text" style="width: 60px; height: 60px; opacity: 0.3; margin-bottom: 20px;"></i>
                             <div style="font-size: 1.2rem; font-weight: 800;">[PDF Document Viewer: ${activeModule.title}]</div>
                             <div style="margin-top: 30px;">
                                <button class="btn-premium-solid" style="background: white !important; color: black !important; border: none; padding: 12px 30px; border-radius: 12px; font-weight: 900;" onclick="simulateModuleComplete('${courseId}', '${activeModule.id}')">Mark as Read</button>
                             </div>
                        </div>
                    `}
                </div>

                <div class="module-info" style="background: white; padding: 25px; border-radius: 20px; border: 1px solid var(--border-color);">
                    <h2 style="font-size: 1.4rem; font-weight: 950; margin: 0; color: var(--text-dark);">${activeModule.title}</h2>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 10px; line-height: 1.6;">Welcome to the first module of the ${course.title} course. In this section, we'll dive deep into core principles and practical applications for enterprise environments.</p>
                </div>
            </div>

            <!-- Right: Module Sidebar -->
            <div class="player-sidebar" style="background: white; border-radius: 24px; border: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.02);">
                <div style="padding: 20px; border-bottom: 1px solid var(--border-color); background: #f8fafc;">
                    <h4 style="margin: 0; font-size: 1rem; font-weight: 900;">Course Content</h4>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${courseModules.length} Modules • ${course.duration}m total</div>
                </div>
                <div class="module-list" style="flex: 1; overflow-y: auto;">
                    ${courseModules.map(m => `
                        <div class="module-item ${m.id === activeModule.id ? 'active' : ''}" style="padding: 15px 20px; display: flex; align-items: start; gap: 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s; background: ${m.id === activeModule.id ? '#eff6ff' : 'white'};">
                             <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: ${assignment.progress > 0 ? '#dcfce7' : '#f1f5f9'}; color: ${assignment.progress > 0 ? '#10b981' : '#94a3b8'};">
                                <i data-lucide="${assignment.progress > 0 ? 'check' : 'circle'}" style="width: 14px;"></i>
                             </div>
                             <div style="flex: 1;">
                                <div style="font-size: 0.85rem; font-weight: 800; color: ${m.id === activeModule.id ? '#1e40af' : 'var(--text-dark)'};">${m.title}</div>
                                <div style="display: flex; align-items: center; gap: 6px; font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
                                    <i data-lucide="${m.type === 'video' ? 'play-circle' : 'file-text'}" style="width: 12px;"></i> ${m.duration}
                                </div>
                             </div>
                        </div>
                    `).join('')}
                </div>
                <div style="padding: 20px; background: #f8fafc; border-top: 1px solid var(--border-color);">
                     <button class="btn-premium-solid" style="width: 100%; border-radius: 12px; padding: 14px;" onclick="showToast('Loading Next Module...', 'info')">Start Assessment</button>
                </div>
            </div>
        </div>
    `;
}

function simulateModuleComplete(courseId, moduleId) {
    const assignment = dashboardData.courseAssignments.find(a => a.course_id === courseId);
    if (assignment) {
        assignment.progress = Math.min(100, assignment.progress + 25);
        if (assignment.progress === 100) assignment.status = 'completed';
        
        showToast("Module Completed! Progress Saved.", "success");
        // Re-render
        const html = renderCoursePlayer(courseId);
        $('#dashboard-content').html(html);
        lucide.createIcons();
    }
}

// =========================================
// ANNOUNCEMENTS & COMMUNICATION HELPERS
// =========================================

function viewAnnouncement(id) {
    const ann = dashboardData.announcements.find(a => a.id === id);
    if (!ann) return;

    // Mark as read immediately
    ann.is_read = true;
    
    const prioColor = ann.priority === 'high' ? '#ef4444' : (ann.priority === 'medium' ? '#f59e0b' : '#3b82f6');
    const prioBg = ann.priority === 'high' ? 'rgba(239,68,68,0.1)' : (ann.priority === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)');
    const typeIcon = ann.type === 'urgent' ? 'alert-triangle' : (ann.type === 'event' ? 'calendar' : (ann.type === 'policy' ? 'shield' : 'info'));

    // Strip basic emojis
    const stripEmojis = str => str ? str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '').trim() : '';
    const cleanTitle = stripEmojis(ann.title);
    const cleanDesc = stripEmojis(ann.description);

    $('#modal-container').html(`
        <div id="ann-modal" class="modal-overlay fade-in" style="position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9000; backdrop-filter:blur(4px);">
            <div class="modal-content scale-in" style="background:white; width:540px; max-width:95%; border-radius:24px; overflow:hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position:relative;">
                
                <!-- Colored Top Border -->
                <div style="height: 6px; width: 100%; background: ${prioColor};"></div>

                <div style="padding: 30px;">
                    <button onclick="closeAnnModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 5px; border-radius: 50%; display: flex; align-items: center; justify-content: center; hover:bg-gray-100;">
                        <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                    </button>

                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: ${prioBg}; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,0.05);">
                            <i data-lucide="${typeIcon}" style="width: 20px; color: ${prioColor};"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.65rem; font-weight: 800; color: ${prioColor}; text-transform: uppercase; letter-spacing: 0.5px;">${ann.priority} Priority</span>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top:2px;">${new Date(ann.created_at).toLocaleDateString()} &middot; internal broadcast</div>
                        </div>
                    </div>
                    
                    <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-dark); margin: 0 0 16px 0; line-height: 1.3;">${cleanTitle}</h2>
                    
                    <div style="font-size: 0.95rem; line-height: 1.6; color: var(--text-body); background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);">
                        ${cleanDesc}
                    </div>

                    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                            <img src="https://ui-avatars.com/api/?name=HR+Admin&background=4D4286&color=fff" style="width: 24px; height: 24px; border-radius: 50%;">
                            <span>Posted by HR Dept</span>
                        </div>
                        <button class="btn-premium-solid" style="padding: 10px 20px; border-radius: 12px; font-size: 0.85rem;" onclick="closeAnnModal()">Close Update</button>
                    </div>
                </div>
            </div>
        </div>
    `).removeClass('hidden');
    lucide.createIcons();
    
    // Refresh the list view in background to show 'read' state
    const hash = window.location.hash.replace('#', '') || 'overview';
    if (hash === 'announcements') {
        // Find if list exists in DOM and just update UI class instead of total re-render if possible
        // but for now re-render handles badges correctly
        const sectionContent = sections.announcements.render();
        $('#dashboard-content').html(sectionContent);
        lucide.createIcons();
    }
}

function closeAnnModal() {
    $('#modal-container').addClass('hidden').empty();
}

function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m";
    return Math.floor(seconds) + "s";
}

// ----------------------------------------------------
// Policy Management Modals
// ----------------------------------------------------
window.viewPolicy = function(policyId) {
    // Mock policy lookup
    const policy = {
        id: policyId,
        title: policyId === 'p1' ? 'Work From Home Policy v2' : (policyId === 'p2' ? 'Employee Code of Conduct' : 'Data Security & IT Policy'),
        content: '<p>This document outlines the rules and expectations regarding work. By acknowledging this policy, you agree to adhere to its principles.</p><ul><li>Maintain professional conduct</li><li>Secure all data</li><li>Report issues immediately</li></ul>',
        status: policyId === 'p1' ? 'pending' : 'acknowledged',
        version: policyId === 'p1' ? 'v2' : 'v1'
    };

    const container = $('#modal-container');
    container.html(`
        <div style="background: white; border-radius: 20px; width: 650px; max-width: 95%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="padding: 24px; border-bottom: 2px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
                <div>
                    <h3 style="margin: 0; font-size: 1.25rem; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; color: #1e293b;">${policy.title}</h3>
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 4px;">Version ${policy.version}</div>
                </div>
                <button onclick="closePolicyModal()" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; transition: 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'"><i data-lucide="x" style="width: 18px;"></i></button>
            </div>
            
            <div style="padding: 30px 24px; overflow-y: auto; color: #334155; font-size: 0.95rem; line-height: 1.6;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <i data-lucide="file-text" style="width: 48px; height: 48px; color: #94a3b8; margin-bottom: 10px;"></i>
                    <div style="font-weight: 700; color: #475569;">PDF Document Attached</div>
                    <button style="margin-top: 10px; background: white; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-weight: 600; color: #1e293b; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;"><i data-lucide="download" style="width:14px;"></i> Download PDF</button>
                </div>
                
                <h4 style="margin-top: 0; color: #1e293b; font-weight: 800; margin-bottom: 10px;">Policy Summary</h4>
                ${policy.content}
            </div>

            ${policy.status === 'pending' ? `
                <div style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #fffbfa;">
                    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                        <input type="checkbox" id="ack-checkbox" style="width: 20px; height: 20px; margin-top: 2px;">
                        <label for="ack-checkbox" style="font-size: 0.85rem; color: #475569; font-weight: 500; line-height: 1.4;">
                            I acknowledge that I have received, read, and fully understand the <strong style="color:#1e293b;">${policy.title}</strong> document. I agree to comply with its terms and conditions.
                        </label>
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button id="btn-acknowledge" onclick="acknowledgePolicy('${policy.id}')" disabled style="background: var(--success); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: 0.2s;">
                            <i data-lucide="check-square" style="width: 16px;"></i> Sign & Acknowledge
                        </button>
                    </div>
                </div>
            ` : `
                <div style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f0fdf4; display: flex; align-items: center; gap: 12px; justify-content: center; color: #166534;">
                    <i data-lucide="shield-check" style="width: 24px;"></i>
                    <div>
                        <div style="font-weight: 800; font-size: 0.95rem;">Digitally Signed & Acknowledged</div>
                        <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.8;">Recorded on ${new Date().toLocaleDateString()}</div>
                    </div>
                </div>
            `}
        </div>
    `);

    // Add event listener to checkbox
    setTimeout(() => {
        const cb = document.getElementById('ack-checkbox');
        const btn = document.getElementById('btn-acknowledge');
        if (cb && btn) {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    btn.removeAttribute('disabled');
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                } else {
                    btn.setAttribute('disabled', 'true');
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                }
            });
        }
    }, 100);

    container.removeClass('hidden').css({
        'display': 'flex',
        'position': 'fixed',
        'inset': '0',
        'z-index': '9999',
        'background-color': 'rgba(15, 23, 42, 0.6)',
        'backdrop-filter': 'blur(10px)',
        'align-items': 'center',
        'justify-content': 'center'
    });
    lucide.createIcons();
};

window.closePolicyModal = function() {
    $('#modal-container').addClass('hidden').empty().removeAttr('style');
};

window.acknowledgePolicy = function(policyId) {
    const btn = $('#btn-acknowledge');
    btn.html('<i data-lucide="loader" class="spin" style="width: 16px;"></i> Signing...').css('opacity', '0.8');
    lucide.createIcons();
    
    // Simulate API call
    setTimeout(() => {
        closePolicyModal();
        // Force refresh UI (mock logic)
        alert('Policy acknowledged successfully! Your compliance record has been updated.');
        // In real app, we would update state and re-render
        if(window.location.hash.replace('#', '') === 'policies') {
           const sectionContent = sections.policies.render();
           $('#dashboard-content').html(sectionContent);
           lucide.createIcons();
        }
    }, 1000);
};
