// Supabase Configuration
const supabaseUrl = 'https://rrbbbhvethxtbvupolqo.supabase.co';
const supabaseKey = 'sb_publishable_5zK8zx6xnGkD_-QIoOGZAg_5uBOEVv2';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Helper for XSS Prevention
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

// Data store
let dashboardData = {
    employees: [],
    attendanceLogs: [],
    leaveRequests: [],
    grievances: [],
    userLookupMap: {} // Cache for sender names
};
let currentUserId = null; // Global for sessions

async function initEmployerDashboard() {
    try {
        const isNewAccount = localStorage.getItem('salarite_new_employer') === 'true' || new URLSearchParams(window.location.search).get('onboarding') === 'true';

        // 1. Fetch all employees (Real data)
        const { data: employees, error: empErr } = await supabaseClient.from('employees').select('*');
        if (empErr) throw empErr;
        dashboardData.employees = employees || [];
        
        // Build User Lookup Map
        dashboardData.userLookupMap = {};
        dashboardData.employees.forEach(u => {
            const name = `${u.first_name} ${u.last_name || ''}`.trim();
            if (u.user_id) dashboardData.userLookupMap[u.user_id] = name;
            if (u.id) dashboardData.userLookupMap[u.id] = name;
        });

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            currentUserId = user.id; // Correctly track current admin
            const { data: userEmp } = await supabaseClient.from('employees').select('role').eq('user_id', user.id).single();
            dashboardData.userRole = userEmp?.role || 'Employer'; // fallback
        }

        if (isNewAccount) {
            setupEmptyDashboard();
        } else {
            // 2. Fetch today's attendance logs
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: attendanceLogs, error: attErr } = await supabaseClient
                .from('attendance_logs')
                .select('*')
                .eq('date', todayStr);
            if (attErr) throw attErr;
            dashboardData.attendanceLogs = attendanceLogs || [];

            // 3. Fetch pending leave requests
            const { data: leaveRequests, error: leaveErr } = await supabaseClient
                .from('leave_requests')
                .select('*, employees(first_name, last_name, profile_photo_url), leave_types(name)')
                .eq('status', 'pending');
            if (leaveErr) throw leaveErr;
            dashboardData.leaveRequests = leaveRequests || [];

            renderOverviewCards();
            renderVerificationTable();
            renderEmployeeTable();
            renderPendingLeaves();
            renderAttendanceOverview();
            renderAttendanceRecords();
            renderGrievanceTable();
        if (typeof Chart !== 'undefined') {
            initCharts();
        }
        }

        initKanbanAndQuill();
        lucide.createIcons();

    } catch (e) {
        console.error('Error fetching dashboard data: ', e);
    }
}

function setupEmptyDashboard() {
    // Zero-data state for new employers
    $('#val-total-emp').text('0');
    $('#val-present').text('0');
    $('#val-leave').text('0');
    $('#val-positions').text('0');

    $('#employee-table-body').html('<tr><td colspan="6" style="text-align:center; padding:50px; color:#64748b;">No employees added yet. <button class="btn-primary" style="display:inline-flex; margin-left:10px;" onclick="$(\'#add-employee-modal\').css(\'display\',\'flex\')">Add First Employee</button></td></tr>');
    $('#pending-leaves-list').html('<p style="text-align:center; padding:20px; color:#64748b;">Waiting for first employee request...</p>');

    // Fill profile placeholders from onboarding state
    $('#display-gst').text(localStorage.getItem('salarite_gst') || 'Pending');
    $('#display-signatory').text(localStorage.getItem('salarite_founder') || localStorage.getItem('salarite_employer_name') || 'Pending');
    $('#display-year').text(localStorage.getItem('salarite_founded_year') || 'Pending');
    $('#display-website').text(localStorage.getItem('salarite_website') || 'Pending');
}

function renderOverviewCards() {
    // Total Employees
    const totalEmployees = dashboardData.employees.length || 128;
    
    // Present Today (Active logs for today)
    const presentToday = dashboardData.attendanceLogs.length || 112; 
    
    const onLeave = 9; 
    const openPositions = 6;

    if ($('#val-total-emp').length) $('#val-total-emp').text(totalEmployees);
    if ($('#val-present').length) $('#val-present').text(presentToday);
    if ($('#val-leave').length) $('#val-leave').text(onLeave);
    if ($('#val-positions').length) $('#val-positions').text(openPositions);
}

function renderEmployeeTable() {
    const tbody = $('#employee-table-body');
    if (!tbody.length) return;
    tbody.empty();

    // 50 Demo Employees as requested
    const demoEmps = [
        { first_name: "Aarav", last_name: "Sharma", emp_id: "EMP-1001", department: "Engineering", designation: "Software Engineer" },
        { first_name: "Vivaan", last_name: "Verma", emp_id: "EMP-1002", department: "Marketing", designation: "Brand Manager" },
        { first_name: "Aditya", last_name: "Singh", emp_id: "EMP-1003", department: "HR", designation: "HR Specialist" },
        { first_name: "Arjun", last_name: "Mehta", emp_id: "EMP-1004", department: "Finance", designation: "Accountant" },
        { first_name: "Reyansh", last_name: "Gupta", emp_id: "EMP-1005", department: "Sales", designation: "Senior Executive" },
        { first_name: "Krish", last_name: "Patel", emp_id: "EMP-1006", department: "Engineering", designation: "QA Engineer" },
        { first_name: "Ishan", last_name: "Yadav", emp_id: "EMP-1007", department: "Marketing", designation: "Content Strategist" },
        { first_name: "Kabir", last_name: "Jain", emp_id: "EMP-1008", department: "HR", designation: "Recruiter" },
        { first_name: "Rohan", last_name: "Bansal", emp_id: "EMP-1009", department: "Finance", designation: "Analyst" },
        { first_name: "Siddharth", last_name: "Kapoor", emp_id: "EMP-1010", department: "Sales", designation: "Sales Manager" },
        { first_name: "Ananya", last_name: "Sharma", emp_id: "EMP-1011", department: "HR", designation: "Assistant" },
        { first_name: "Diya", last_name: "Verma", emp_id: "EMP-1012", department: "Marketing", designation: "Marketing Exec" },
        { first_name: "Isha", last_name: "Singh", emp_id: "EMP-1013", department: "Engineering", designation: "Frontend dev" },
        { first_name: "Meera", last_name: "Mehta", emp_id: "EMP-1014", department: "Finance", designation: "Auditor" },
        { first_name: "Riya", last_name: "Gupta", emp_id: "EMP-1015", department: "Sales", designation: "Territory Lead" },
        { first_name: "Sanya", last_name: "Patel", emp_id: "EMP-1016", department: "HR", designation: "Operations" },
        { first_name: "Kavya", last_name: "Yadav", emp_id: "EMP-1017", department: "Marketing", designation: "Social Media" },
        { first_name: "Pooja", last_name: "Jain", emp_id: "EMP-1018", department: "Engineering", designation: "System Admin" },
        { first_name: "Neha", last_name: "Bansal", emp_id: "EMP-1019", department: "Finance", designation: "Accounts" },
        { first_name: "Priya", last_name: "Kapoor", emp_id: "EMP-1020", department: "Sales", designation: "Assistant" },
        { first_name: "Rahul", last_name: "Sharma", emp_id: "EMP-1021", department: "Engineering", designation: "Developer" },
        { first_name: "Karan", last_name: "Verma", emp_id: "EMP-1022", department: "Marketing", designation: "Manager" },
        { first_name: "Aman", last_name: "Singh", emp_id: "EMP-1023", department: "HR", designation: "Executive" },
        { first_name: "Deepak", last_name: "Mehta", emp_id: "EMP-1024", department: "Finance", designation: "Specialist" },
        { first_name: "Mohit", last_name: "Gupta", emp_id: "EMP-1025", department: "Sales", designation: "Lead" },
        { first_name: "Nikhil", last_name: "Patel", emp_id: "EMP-1026", department: "Engineering", designation: "Lead Engineer" },
        { first_name: "Varun", last_name: "Yadav", emp_id: "EMP-1027", department: "Marketing", designation: "Sr. Executive" },
        { first_name: "Sahil", last_name: "Jain", emp_id: "EMP-1028", department: "HR", designation: "HR Manager" },
        { first_name: "Tarun", last_name: "Bansal", emp_id: "EMP-1029", department: "Finance", designation: "Clerk" },
        { first_name: "Rohit", last_name: "Kapoor", emp_id: "EMP-1030", department: "Sales", designation: "Exec" },
        { first_name: "Akash", last_name: "Kumar", emp_id: "EMP-1031", department: "Engineering", designation: "Developer" },
        { first_name: "Sumit", last_name: "Roy", emp_id: "EMP-1032", department: "Marketing", designation: "Coordinator" },
        { first_name: "Vikas", last_name: "Das", emp_id: "EMP-1033", department: "HR", designation: "HR Generalist" },
        { first_name: "Ajay", last_name: "Nair", emp_id: "EMP-1034", department: "Finance", designation: "Sr Accountant" },
        { first_name: "Manoj", last_name: "Iyer", emp_id: "EMP-1035", department: "Sales", designation: "Account Exec" },
        { first_name: "Sanjay", last_name: "Pillai", emp_id: "EMP-1036", department: "Engineering", designation: "Sr. Dev" },
        { first_name: "Ravi", last_name: "Reddy", emp_id: "EMP-1037", department: "Marketing", designation: "Digital Lead" },
        { first_name: "Tejas", last_name: "Patil", emp_id: "EMP-1038", department: "HR", designation: "HR Admin" },
        { first_name: "Gaurav", last_name: "Mishra", emp_id: "EMP-1039", department: "Finance", designation: "Finance Lead" },
        { first_name: "Lokesh", last_name: "Choudhary", emp_id: "EMP-1040", department: "Sales", designation: "BDM" },
        { first_name: "Sneha", last_name: "Sharma", emp_id: "EMP-1041", department: "HR", designation: "Sr HR" },
        { first_name: "Tanya", last_name: "Verma", emp_id: "EMP-1042", department: "Marketing", designation: "Designer" },
        { first_name: "Aditi", last_name: "Singh", emp_id: "EMP-1043", department: "Engineering", designation: "Intern" },
        { first_name: "Muskan", last_name: "Mehta", emp_id: "EMP-1044", department: "Finance", designation: "Accountant" },
        { first_name: "Simran", last_name: "Gupta", emp_id: "EMP-1045", department: "Sales", designation: "Sales Lead" },
        { first_name: "Ritu", last_name: "Patel", emp_id: "EMP-1046", department: "HR", designation: "Officer" },
        { first_name: "Nisha", last_name: "Yadav", emp_id: "EMP-1047", department: "Marketing", designation: "PR Lead" },
        { first_name: "Komal", last_name: "Jain", emp_id: "EMP-1048", department: "Engineering", designation: "Engineer" },
        { first_name: "Bhavna", last_name: "Bansal", emp_id: "EMP-1049", department: "Finance", designation: "Auditor" },
        { first_name: "Pooja", last_name: "Kapoor", emp_id: "EMP-1050", department: "Sales", designation: "Manager" }
    ];

    // Combine with real data from Supabase
    const allEmployees = [...dashboardData.employees, ...demoEmps];

    allEmployees.forEach(emp => {
        const photo = emp.profile_photo_url || `https://ui-avatars.com/api/?name=${emp.first_name}+${emp.last_name || ''}&background=e2e8f0`;
        const email = emp.email || `${emp.first_name.toLowerCase()}.${(emp.last_name || '').toLowerCase() || 'user'}@tempmail.com`;
        tbody.append(`
            <tr>
                <td>
                    <div class="employee-col">
                        <img src="${photo}" alt="${escapeHTML(emp.first_name)}">
                        <div>
                            <span class="name">${escapeHTML(emp.first_name)} ${escapeHTML(emp.last_name || '')}</span>
                            <span class="email">${escapeHTML(email)}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(emp.emp_id || '-')}</td>
                <td>${escapeHTML(emp.department || 'Unassigned')}</td>
                <td>${escapeHTML(emp.designation || 'Employee')}</td>
                <td><span class="status-badge status-active">Active</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon" title="View"><i data-lucide="eye" style="width: 16px;"></i></button>
                        <button class="btn-icon" title="Edit"><i data-lucide="edit-2" style="width: 16px;"></i></button>
                    </div>
                </td>
            </tr>
        `);
    });

    // Initialize Directory Table correctly by ID with 50 entries per page as requested
    $('#employee-table').DataTable({
        paging: true,
        searching: true,
        info: true,
        lengthChange: false,
        pageLength: 50,
        language: {
            search: "",
            searchPlaceholder: "Search employees...",
            emptyTable: "No employees found."
        },
        destroy: true
    });
}


function renderPendingLeaves() {
    const leaveContainer = $('#pending-leaves-list');
    leaveContainer.empty();

    const count = dashboardData.leaveRequests.length;
    $('#pending-leave-count').text(count);

    if (count > 0) {
        dashboardData.leaveRequests.forEach(req => {
            const emp = req.employees;
            const photo = emp?.profile_photo_url || `https://ui-avatars.com/api/?name=${emp?.first_name || 'U'}&background=e2e8f0`;
            const leaveName = req.leave_types?.name || 'Leave';
            const duration = Math.ceil((new Date(req.end_date) - new Date(req.start_date)) / (1000 * 60 * 60 * 24)) + 1;

            leaveContainer.append(`
                <div class="list-item">
                    <div class="list-info">
                        <img src="${photo}" alt="user">
                        <div class="list-text">
                            <h5>${escapeHTML(emp?.first_name || 'Unknown')} ${escapeHTML(emp?.last_name || '')}</h5>
                            <p>${escapeHTML(leaveName)} (${duration} Day${duration > 1 ? 's' : ''})</p>
                        </div>
                    </div>
                    <div class="action-btns">
                        <button class="btn-primary btn-sm btn-approve-leave" data-id="${req.id}">Approve</button>
                    </div>
                </div>
            `);
        });
    } else {
        leaveContainer.html('<p style="font-size:0.8rem; color:var(--text-muted); padding:10px 0; text-align:center;">No pending leave requests.</p>');
    }
}

function initCharts() {
    // 1. Department Distribution (Donut Chart)
    const ctxDept = document.getElementById('deptChart');
    if (Chart.getChart(ctxDept)) Chart.getChart(ctxDept).destroy();

    new Chart(ctxDept.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Tech Engineering', 'Marketing', 'HR', 'Sales', 'Finance & Admin'],
            datasets: [{
                data: [40, 20, 10, 20, 10],
                backgroundColor: ['#2563eb', '#f59e0b', '#8b5cf6', '#10b981', '#64748b'],
                hoverOffset: 15,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, padding: 20, font: { family: 'Inter', size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function (item) {
                            return `${item.label}: ${item.raw}%`;
                        }
                    }
                }
            }
        }
    });

    // 2. Employee Growth & Attendance Trend (Graph Data)
    const ctxGrowth = document.getElementById('growthChart');
    if (Chart.getChart(ctxGrowth)) Chart.getChart(ctxGrowth).destroy();

    new Chart(ctxGrowth.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: 'Employees',
                    data: [85, 92, 98, 110, 120, 128],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Attendance %',
                    data: [88, 91, 89, 94, 95, 93],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#1e293b',
                    padding: 12,
                    bodyFont: { family: 'Inter' },
                    titleFont: { family: 'Inter', weight: 'bold' }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { drawOnChartArea: true },
                    ticks: { font: { family: 'Inter', size: 10 } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 80,
                    max: 100,
                    grid: { drawOnChartArea: false },
                    ticks: { font: { family: 'Inter', size: 10 }, callback: value => value + '%' }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 10 } }
                }
            }
        }
    });

    // 3. Attendance Snapshot (Circle Graph)
    const ctxAttendance = document.getElementById('attendanceSnapshotChart');
    if (ctxAttendance) {
        if (Chart.getChart(ctxAttendance)) Chart.getChart(ctxAttendance).destroy();
        new Chart(ctxAttendance.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['On Time', 'Late', 'Absent'],
                datasets: [{
                    data: [95, 12, 6],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    hoverOffset: 10,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#1e293b',
                        padding: 12,
                        bodyFont: { family: 'Inter' }
                    }
                }
            }
        });
    }
}

function initKanbanAndQuill() {
    // Init SortableJS Kanban
    const kanbanLists = document.querySelectorAll('.kanban-list');
    kanbanLists.forEach(list => {
        new Sortable(list, {
            group: 'shared',
            animation: 150,
            ghostClass: 'kanban-ghost'
        });
    });

    // Init Quill.js for Announcements
    if (document.querySelector('#quill-editor') && !document.querySelector('#quill-editor .ql-toolbar')) {
        new Quill('#quill-editor', {
            theme: 'snow',
            placeholder: 'Write an announcement...',
            modules: {
                toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['clean']]
            }
        });
    }

    // Init Quill.js for Company Profile
    if (document.querySelector('#company-quill-editor') && !document.querySelector('#company-quill-editor .ql-toolbar')) {
        window.companyEditor = new Quill('#company-quill-editor', {
            theme: 'snow',
            placeholder: 'Describe your company culture, mission, and history...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link', 'clean']
                ]
            }
        });
    }
}

// Action Listeners
$(document).on('click', '.btn-approve-leave', async function () {
    const leaveId = $(this).data('id');
    try {
        $(this).html('<i data-lucide="loader" class="spin"></i>');
        const { error } = await supabaseClient
            .from('leave_requests')
            .update({ status: 'approved' })
            .eq('id', leaveId);
        if (error) throw error;

        alert('Leave Request Approved successfully!');
        // Refresh dashboard data
        initEmployerDashboard();
    } catch (e) {
        console.error('Error approving leave:', e);
        $(this).text('Approve');
        alert('Failed to approve leave.');
    }
});

// --- User Management Logic ---
function renderUserTable() {
    // For now, initializing with the existing dummy data in HTML
    $('#user-accounts-table').DataTable({
        paging: true,
        searching: true,
        info: false,
        lengthChange: false,
        pageLength: 10,
        destroy: true,
        language: { search: "", searchPlaceholder: "Search users..." }
    });
}

$(document).on('click', '.btn-icon[title="Deactivate"]', function () {
    if (confirm('Are you sure you want to deactivate this user account? They will lose all access immediately.')) {
        $(this).closest('tr').css('opacity', '0.5');
        $(this).html('<i data-lucide="user-plus" style="width: 16px;"></i>').attr('title', 'Activate');
        lucide.createIcons();
    }
});

$(document).on('click', '.btn-icon[title="Reset Password"]', function () {
    const email = $(this).closest('tr').find('.email').text();
    const newPass = prompt("Enter new password for " + email, "Salarite@2026");
    if (newPass) {
        alert("Password reset successfully for " + email);
    }
});

// --- Modal Add Employee Logic ---
$(document).on('click', '#btn-open-add-modal', function () {
    $('#add-employee-modal').css('display', 'flex');
});
$(document).on('click', '#btn-close-modal', function () {
    $('#add-employee-modal').hide();
});

$(document).on('submit', '#add-employee-form', async function (e) {
    e.preventDefault();
    const btn = $('#btn-submit-employee');
    btn.text('Creating...').prop('disabled', true);

    try {
        const email = $('#add-email').val();
        const password = $('#add-password').val();
        const fname = $('#add-fname').val();
        const lname = $('#add-lname').val();
        const empid = $('#add-empid').val();
        const dept = $('#add-dept').val();

        // Directly invoke our custom secure database RPC to bypass GoTrue email systems entirely!
        const { data: rpcData, error: rpcErr } = await supabaseClient.rpc('admin_create_employee', {
            p_email: email,
            p_password: password,
            p_first_name: fname,
            p_last_name: lname,
            p_emp_id: empid,
            p_department: dept
        });

        if (rpcErr) {
            // Check for our custom SQL Error
            if (rpcErr.message.includes("already in use")) {
                throw new Error("This email address is already taken. Please use a different one.");
            }
            throw rpcErr;
        }

        alert(`Employee ${fname} ${lname} successfully created! They can now log in using their email.`);
        $('#add-employee-modal').hide();
        $('#add-employee-form')[0].reset();

        // Refresh table!
        initEmployerDashboard();

    } catch (error) {
        console.error('Failed to create user:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.text('Create').prop('disabled', false);
    }
});

// --- Verification Table Logic ---
function renderVerificationTable() {
    const tbody = $('#verification-table-body');
    if (!tbody.length) return;

    // Clear the table and destroy old DataTable instance if any
    if ($.fn.DataTable.isDataTable('#verification-table')) {
        $('#verification-table').DataTable().destroy();
    }
    tbody.empty();

    // Filter employees by "Pending" status
    const pendingEmps = dashboardData.employees.filter(e => e.verification_status === 'Pending');

    if (pendingEmps.length === 0) {
        $('#verification-panel').hide();
        return;
    }

    $('#verification-panel').show();

    pendingEmps.forEach(emp => {
        tbody.append(`
            <tr>
                <td>
                    <div class="employee-col">
                        <img src="${emp.profile_photo_url || 'https://i.pravatar.cc/150?u=' + emp.id}" alt="User">
                        <div>
                            <span class="name">${escapeHTML(emp.first_name)} ${escapeHTML(emp.last_name || '')}</span>
                            <span class="email">${escapeHTML(emp.emp_id || 'ID Pending')}</span>
                        </div>
                    </div>
                </td>
                <td><span class="status-badge status-pending" style="background:#fef3c7; color:#d97706; padding: 6px 12px; border-radius: 8px;">Pending Review</span></td>
                <td>
                    <button class="btn-verify-docs btn-view-docs" data-id="${emp.id}">
                        <i data-lucide="eye" style="width: 14px;"></i> View Documents
                    </button>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn-verify-approve-quick btn-verify-quick" data-action="approve" data-id="${emp.id}">
                            <i data-lucide="check" style="width: 16px;"></i> Approve
                        </button>
                    </div>
                </td>
            </tr>
        `);
    });


    // Initialize Verification Table correctly by ID
    $('#verification-table').DataTable({
        paging: false,
        searching: false,
        info: false,
        destroy: true,
        language: { emptyTable: "No profiles pending." }
    });

    lucide.createIcons();
}

// Verification Actions
$(document).on('click', '.btn-view-docs', function () {
    const empId = $(this).data('id');
    const emp = dashboardData.employees.find(e => e.id === empId);
    if (!emp) return;

    $('#verify-emp-id').val(emp.id);
    $('#verify-modal-title').text(`Verify: ${emp.first_name || ''} ${emp.last_name || ''}`);
    $('#verify-notes').val('');

    // Helper: render a detail row
    const row = (label, value, icon = 'minus') => {
        const val = value ? `<span style="font-weight:600; color:var(--text-main);">${value}</span>` : `<span style="color:#94a3b8; font-style:italic;">Not provided</span>`;
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:var(--text-muted); font-size:0.88rem; display:flex; align-items:center; gap:6px;"><i data-lucide="${icon}" style="width:15px; flex-shrink:0;"></i>${label}</span>
            ${val}
        </div>`;
    };

    // Helper: render a document link card
    const docCard = (label, url, icon = 'file-text') => {
        if (!url) return `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px; opacity:0.6;">
            <span style="display:flex; align-items:center; gap:10px; color:var(--text-muted); font-size:0.85rem;"><i data-lucide="${icon}" style="width:16px;"></i> ${label}</span>
            <span style="color:#94a3b8; font-style:italic; font-size:0.75rem;">Not provided</span>
        </div>`;

        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);

        // Secure viewer (No download attribute used)
        return `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:white; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:10px; transition:all 0.2s;" onmouseover="this.style.borderColor='#4D4286'; this.style.backgroundColor='#f5f3ff';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white';">
            <span style="display:flex; align-items:center; gap:10px; font-weight:600; color:var(--text-dark); font-size:0.85rem;">
                <i data-lucide="${isImage ? 'image' : icon}" style="width:16px; color:#4D4286;"></i> ${label}
            </span>
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:0.7rem; color:#10b981; font-weight:700; background:#d1fae5; padding:2px 8px; border-radius:10px;">Safe View Only</span>
                <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; gap:6px; color:#4D4286; text-decoration:none; font-weight:700; font-size:0.8rem; padding:6px 14px; border:1px solid #4D4286; border-radius:6px; background:white; transition:all 0.2s;" onmouseover="this.style.background='#4D4286'; this.style.color='white';" onmouseout="this.style.background='white'; this.style.color='#4D4286';">
                    <i data-lucide="external-link" style="width:14px;"></i> View Full
                </a>
            </div>
        </div>`;
    };


    // Build multi-doc cards (for arrays)
    const multiDocCards = (label, urls, icon = 'files') => {
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return docCard(label, null, icon);
        }
        return urls.map((url, i) => docCard(`${label} (${i + 1})`, url, icon)).join('');
    };

    // Photo preview
    const photoUrl = emp.doc_photo_url || emp.profile_photo_url;
    const photoPreview = photoUrl
        ? `<div style="text-align:center; margin-bottom:16px;">
            <img src="${photoUrl}" alt="Employee Photo" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
           </div>`
        : '';

    // Full address formatter
    const fmtAddr = (l1, l2, pin, city, state) => {
        const parts = [l1, l2, city, state].filter(Boolean);
        return parts.length > 0 ? `${parts.join(', ')}${pin ? ' - ' + pin : ''}` : null;
    };

    const currentAddr = fmtAddr(emp.current_address_line1, emp.current_address_line2, emp.current_pincode, emp.current_city, emp.current_state);
    const permanentAddr = fmtAddr(emp.permanent_address_line1, emp.permanent_address_line2, emp.permanent_pincode, emp.permanent_city, emp.permanent_state);

    $('#verify-doc-content').html(`
        <!-- PERSONAL TAB -->
        <div class="verify-tab-content" id="vtab-personal" style="display:block;">
            ${photoPreview}
            <div style="background:#f8fafc; border-radius:12px; padding:4px 20px; border:1px solid #e2e8f0;">
                ${row('Employee ID', emp.emp_id, 'hash')}
                ${row('Full Name', `${emp.first_name || ''} ${emp.last_name || ''}`.trim(), 'user')}
                ${row('Phone', emp.contact_number, 'phone')}
                ${row('Gender', emp.gender, 'users')}
                ${row('Date of Birth', emp.date_of_birth, 'calendar')}
                ${row('Marital Status', emp.marital_status, 'heart')}
            </div>
        </div>

        <!-- ADDRESS TAB -->
        <div class="verify-tab-content" id="vtab-address" style="display:none;">
            <div style="margin-bottom:16px;">
                <h4 style="font-size:0.95rem; color:var(--text-dark); margin:0 0 10px 0; display:flex; align-items:center; gap:6px;">
                    <i data-lucide="home" style="width:16px; color:#6366f1;"></i> Current Address
                </h4>
                <div style="background:#f8fafc; border-radius:12px; padding:16px 20px; border:1px solid #e2e8f0; line-height:1.7; font-size:0.92rem;">
                    ${currentAddr ? `<span style="font-weight:500; color:var(--text-main);">${currentAddr}</span>` : '<span style="color:#94a3b8; font-style:italic;">Not provided</span>'}
                </div>
            </div>
            <div>
                <h4 style="font-size:0.95rem; color:var(--text-dark); margin:0 0 10px 0; display:flex; align-items:center; gap:6px;">
                    <i data-lucide="map-pin" style="width:16px; color:#6366f1;"></i> Permanent Address
                </h4>
                <div style="background:#f8fafc; border-radius:12px; padding:16px 20px; border:1px solid #e2e8f0; line-height:1.7; font-size:0.92rem;">
                    ${permanentAddr ? `<span style="font-weight:500; color:var(--text-main);">${permanentAddr}</span>` : '<span style="color:#94a3b8; font-style:italic;">Not provided</span>'}
                </div>
            </div>
        </div>

        <!-- EMPLOYMENT TAB -->
        <div class="verify-tab-content" id="vtab-employment" style="display:none;">
            <div style="background:#f8fafc; border-radius:12px; padding:4px 20px; border:1px solid #e2e8f0;">
                ${row('Department', emp.department, 'building')}
                ${row('Designation', emp.designation, 'award')}
                ${row('Reporting Manager', emp.reporting_manager, 'user-check')}
                ${row('Employment Type', emp.employment_type, 'clock')}
                ${row('Date of Joining', emp.joining_date, 'calendar')}
                ${row('Work Location', emp.work_location, 'map')}
            </div>
        </div>

        <!-- BANK TAB -->
        <div class="verify-tab-content" id="vtab-bank" style="display:none;">
            <div style="background:linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%); border-radius:12px; padding:4px 20px; border:1px solid #e0e7ff;">
                ${row('Bank Name', emp.bank_name, 'landmark')}
                ${row('Account Holder', emp.bank_holder_name, 'user')}
                ${row('Account Number', emp.bank_account_number, 'credit-card')}
                ${row('IFSC Code', emp.bank_ifsc, 'key')}
                ${row('Branch', emp.bank_branch, 'git-branch')}
            </div>
            <div style="margin-top:10px; background:#fef2f2; border-radius:10px; padding:4px 20px; border:1px solid #fecaca;">
                <h4 style="font-size:0.9rem; color:#b91c1c; margin:10px 0 6px; display:flex; align-items:center; gap:6px;">
                    <i data-lucide="alert-triangle" style="width:15px;"></i> Emergency Contact
                </h4>
                ${row('Contact Name', emp.emergency_contact_name, 'user')}
                ${row('Relationship', emp.emergency_contact_relationship, 'heart')}
                ${row('Phone', emp.emergency_contact_number, 'phone')}
            </div>
        </div>

        <!-- DOCUMENTS TAB -->
        <div class="verify-tab-content" id="vtab-documents" style="display:none;">
            <p style="font-size:0.85rem; color:var(--text-muted); margin:0 0 14px; display:flex; align-items:center; gap:6px;">
                <i data-lucide="info" style="width:14px;"></i> Click "View" to open the document in a new tab.
            </p>
            ${docCard('Aadhaar Card', emp.doc_aadhaar_url, 'file-badge')}
            ${docCard('PAN Card', emp.doc_pan_url, 'file-badge-2')}
            ${docCard('Resume / CV', emp.doc_resume_url, 'file-text')}
            ${docCard('Passport Photo', emp.doc_photo_url || emp.profile_photo_url, 'image')}
            ${docCard('Offer Letter', emp.doc_offer_url, 'file-check')}
            ${multiDocCards('Educational Certificate', emp.doc_education_urls, 'graduation-cap')}
            ${multiDocCards('Employment Document', emp.doc_employment_urls, 'briefcase')}
        </div>
    `);

    // Activate the first tab
    const firstTab = document.querySelector('.verify-tab[data-tab="personal"]');
    if (firstTab) switchVerifyTab(firstTab, 'personal');
    lucide.createIcons();

    $('#verify-revision-box').hide();
    $('#btn-verify-reject-confirm').hide();
    $('#btn-verify-reject').show();
    $('#btn-verify-revise').show();
    $('#verify-doc-modal').css('display', 'flex');
});

$(document).on('click', '#btn-close-verify-modal', function () {
    $('#verify-doc-modal').hide();
});

// Reject Mode toggle
$(document).on('click', '#btn-verify-reject', function () {
    $('#verify-revision-box').slideDown();
    $(this).hide();
    $('#btn-verify-revise').hide(); // hide revise if actively rejecting
    $('#btn-verify-reject-confirm').show();
});

// Generic async status update function with automated notifications
async function processVerification(empId, status, notes = '') {
    try {
        const { error } = await supabaseClient.from('employees')
            .update({
                verification_status: status,
                verification_notes: notes,
                profile_completed: (status === 'Active' || status === 'Pending')
            }).eq('id', empId);

        if (error) throw error;

        // Trigger Notification
        let title = "";
        let body = "";
        const emp = dashboardData.employees.find(e => e.id === empId);
        const name = emp ? `${emp.first_name} ${emp.last_name || ''}` : "Employee";

        if (status === 'Active') {
            title = "✅ Profile Approved";
            body = `Full dashboard access has been granted to ${name}.`;
        } else if (status === 'Revision Required') {
            title = "🔁 Revision Requested";
            body = `Sent follow-up to ${name} for field updates.`;
        } else if (status === 'Rejected') {
            title = "❌ Profile Rejected";
            body = `Profile for ${name} has been rejected (Reason: ${notes}).`;
        }

        showRealtimeToast(title, body);
        addNotification(title, body, status === 'Active' ? 'check-circle' : 'alert-circle');

        $('#verify-doc-modal').hide();
        // Force refresh data
        await initEmployerDashboard();

    } catch (e) {
        console.error("Verification update error:", e);
        alert('Action failed: ' + e.message);
    }
}

// Approve
$(document).on('click', '#btn-verify-approve, .btn-verify-quick[data-action="approve"]', function () {
    const empId = $('#verify-emp-id').val() || $(this).data('id');
    if (confirm('Approve this profile? This will grant full access to Attendance, Leaves, and Payroll.')) {
        processVerification(empId, 'Active');
    }
});

// Revise (Highlighting specific field issues)
$(document).on('click', '#btn-verify-revise', function () {
    const empId = $('#verify-emp-id').val();
    const notes = $('#verify-notes').val();

    if (!$('#verify-revision-box').is(':visible')) {
        $('#verify-revision-box').slideDown();
        $('#verify-notes').attr('placeholder', 'List specific fields (e.g., IFSC Code is wrong, Aadhaar blurry)...');
        return;
    }

    if (!notes.trim() || notes.length < 5) {
        alert("Please provide specific feedback so the employee knows what to fix.");
        return;
    }
    processVerification(empId, 'Revision Required', notes);
});

// Reject (Mandatory Reason)
$(document).on('click', '#btn-verify-reject-confirm', function () {
    const empId = $('#verify-emp-id').val();
    const notes = $('#verify-notes').val();
    if (!notes.trim() || notes.length < 10) {
        alert("A detailed rejection reason is mandatory for a 'Hard Stop' rejection.");
        return;
    }
    if (confirm('REJECT Profile? The employee will need to start the verification process from scratch.')) {
        processVerification(empId, 'Rejected', notes);
    }
});


// =========================================
// REAL-TIME NOTIFICATION SYSTEM
// =========================================
let notifications = [];
let realtimeChannel = null;

function showRealtimeToast(title, body) {
    const toast = document.getElementById('realtime-toast');
    const titleEl = document.getElementById('toast-title');
    const bodyEl = document.getElementById('toast-body');
    if (!toast) return;

    titleEl.textContent = title;
    bodyEl.textContent = body;
    toast.style.display = 'block';

    // Play subtle sound (optional, browser may block)
    try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgkKadhWM3MGGFoJV8Xj1Vf5eTf2lJQ2uCkYl0WDhKXHt/c1hBOFFwd3RcSTxOYXBqWks/UWRpYlRHRldhYF1VTU1ZYGBdVlBTXGFgXldTVl5hYV9aV1heYmJhXVtbYGRkY2BeXmFkZWRhYGBiZGVkYmFhYmRlZGNiYmNkZWRjY2NkZWVkZGRkZWVlZGRk').play(); } catch (e) { }

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Auto-hide after 6 seconds
    setTimeout(() => hideRealtimeToast(), 6000);
}

function hideRealtimeToast() {
    const toast = document.getElementById('realtime-toast');
    if (!toast) return;
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => { toast.style.display = 'none'; }, 400);
}

function addNotification(title, body, icon = 'user-check') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    notifications.unshift({ title, body, time: timeStr, icon });
    updateNotifUI();
}

function updateNotifUI() {
    const count = notifications.length;
    const badge = document.getElementById('notif-count-badge');
    const dot = document.getElementById('notif-badge-dot');
    const list = document.getElementById('notif-list');

    if (count > 0) {
        if (badge) { badge.style.display = 'flex'; badge.textContent = count > 9 ? '9+' : count; }
        if (dot) dot.style.display = 'block';
    } else {
        if (badge) badge.style.display = 'none';
        if (dot) dot.style.display = 'none';
    }

    if (list) {
        if (count === 0) {
            list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;">
                <i data-lucide="bell-off" style="width:28px; margin-bottom:8px; opacity:0.4;"></i><br>
                No new notifications
            </div>`;
        } else {
            list.innerHTML = notifications.map(n => `
                <div style="display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:8px; transition:background 0.2s; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <div style="width:32px; height:32px; border-radius:50%; background:#eef2ff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="${n.icon}" style="width:15px; color:#4D4286;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <p style="margin:0; font-weight:600; font-size:0.85rem; color:var(--text-dark);">${n.title}</p>
                        <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.body}</p>
                    </div>
                    <span style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap; padding-top:2px;">${n.time}</span>
                </div>
            `).join('');
        }
        lucide.createIcons();
    }
}

function toggleNotifPanel() {
    const dd = document.getElementById('notif-dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function clearNotifications() {
    notifications = [];
    updateNotifUI();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notif-wrapper');
    const dd = document.getElementById('notif-dropdown');
    if (wrapper && dd && !wrapper.contains(e.target)) {
        dd.style.display = 'none';
    }
});

function setupRealtimeSubscription() {
    // Broaden subscription to catch any change that results in a 'Pending' status
    realtimeChannel = supabaseClient
        .channel('employee-updates')
        .on('postgres_changes', {
            event: '*', // Listen to ALL events (INSERT, UPDATE, etc.)
            schema: 'public',
            table: 'employees'
        }, (payload) => {
            const emp = payload.new;
            // Only notify if the new state is 'Pending'
            if (emp && emp.verification_status === 'Pending') {
                const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'An employee';

                showRealtimeToast(
                    '📋 Verification Required',
                    `${name} has submitted profile updates for your review.`
                );

                addNotification(
                    `Action Required: ${name}`,
                    'Employee profile submitted for verification.',
                    'shield-alert'
                );
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'grievances'
        }, (payload) => {
            const grv = payload.new;
            if (grv) {
                const isGrievance = grv.ticket_type === 'Grievance';
                const toastTitle = isGrievance ? '🆘 New Grievance Raised' : '🆘 New Support Request';
                const toastMsg = isGrievance 
                    ? `A confidential ${grv.priority} Priority grievance has been submitted.` 
                    : `New ${grv.category} ticket (${grv.priority}) has been submitted: "${grv.subject}"`;

                showRealtimeToast(toastTitle, toastMsg);

                addNotification(
                    isGrievance ? '🆘 Confidential Grievance' : '🆘 Support Request',
                    isGrievance ? `New ${grv.category} grievance raised.` : `${grv.category}: ${grv.subject}`,
                    'shield-alert'
                );

                // Auto-refresh the grievance table if it's visible
                if ($('#section-grievances').is(':visible')) {
                    renderGrievanceTable();
                }
            }
        })
        .subscribe();
}


$(document).ready(() => {
    lucide.createIcons();
    initEmployerDashboard();
    setupRealtimeSubscription();

    // Add Demo Notifications after a short delay
    setTimeout(() => {
        addNotification("3 employees on leave today", "Priya, Aman, and Neha have approved leaves.", "calendar");
        addNotification("New applicant for React Developer", "8 new candidates Applied in the last 24 hours.", "user-plus");
        addNotification("Payroll processed for March", "All 128 employees have been paid successfully.", "dollar-sign");
    }, 2000);

    // Sidebar navigation logic
    $(document).on('click', '.nav-item', function (e) {
        const href = $(this).attr('href');
        if (!href) return;

        // Let actual page links (ending in .html) work naturally
        if (href.includes('.html') || href === 'index.html') return;
        if ($(this).hasClass('no-nav')) return;

        e.preventDefault();

        // Handle active state
        $('.nav-item').removeClass('active');
        $(this).addClass('active');

        // Handle section toggling for internal hashes
        const sectionId = $(this).data('id') || href.substring(1);

        // Hide all sections first
        $('.dashboard-section').hide();

        // Show target section if it exists
        if ($(`#section-${sectionId}`).length > 0) {
            $(`#section-${sectionId}`).fadeIn(200);
            history.replaceState(null, null, `#${sectionId}`);
            
            // Context-specific updates
            if (sectionId === 'grievances') {
                renderGrievanceTable();
            }
        } else {
            console.warn('Section not found: ', sectionId);
            $('#section-overview').fadeIn(200);
        }

        lucide.createIcons(); // ensure icons in new section are rendered
    });

    // Handle initial load from hash
    if (window.location.hash) {
        const hashId = window.location.hash.substring(1);
        const targetNav = $(`.nav-item[data-id="${hashId}"]`);
        if (targetNav.length > 0) {
            targetNav.click();
        }
    }
});

function switchHRTab(tabId) {
    // Update button states
    $('#section-hr-policies .nav-item').removeClass('active').css('background', 'none');
    
    // Find the button that was clicked
    const activeBtn = event.currentTarget;
    if (activeBtn) {
        $(activeBtn).addClass('active').css('background', '#eef2ff');
    }

    // Update panel visibility
    $('.hr-tab-panel').hide();
    const targetId = `hrtab-${tabId}`;
    $(`#${targetId}`).fadeIn(200);

    // Refresh icons
    lucide.createIcons();
}

// --- Attendance Module Logic ---

function renderAttendanceOverview() {
    const logs = dashboardData.attendanceLogs;
    const emps = dashboardData.employees;
    
    const present = logs.length;
    const lateCount = logs.filter(l => l.is_late).length;
    const absent = Math.max(0, emps.length - present);
    
    // Calculate Avg Working Hours
    let totalMinutes = 0;
    let countWithHours = 0;
    logs.forEach(l => {
        if (l.check_in && l.check_out) {
            const diff = (new Date(`2000-01-01T${l.check_out}`) - new Date(`2000-01-01T${l.check_in}`)) / 60000;
            if (diff > 0) {
                totalMinutes += diff;
                countWithHours++;
            }
        }
    });
    
    const avgHrs = countWithHours > 0 ? (totalMinutes / countWithHours / 60).toFixed(1) : '0';

    $('#att-val-present').text(present || 112); // Fallback for demo
    $('#att-val-late').text(lateCount || 12);
    $('#att-val-absent').text(absent || 6);
    $('#att-val-avg').text(`${avgHrs || '8.2'}h`);
}

function renderAttendanceRecords() {
    const tbody = $('#attendance-table-body');
    if (!tbody.length) return; // Not on the attendance module table
    tbody.empty();

    const logs = dashboardData.attendanceLogs;
    const emps = dashboardData.employees;

    // Create a map for quick lookup
    const empMap = new Map(emps.map(e => [e.id, e]));

    if (logs.length === 0) {
        // Load demo data if no real logs yet
        const demoAtt = [
            { id: 1, emp_name: "Aarav Sharma", emp_id: "EMP-1001", dept: "Engineering", in: "09:05 AM", out: "06:30 PM", status: "Present", late: "Yes", duration: "9.5h" },
            { id: 2, emp_name: "Vivaan Verma", emp_id: "EMP-1002", dept: "Marketing", in: "08:55 AM", out: "06:05 PM", status: "Present", late: "No", duration: "9.1h" },
            { id: 3, emp_name: "Aditya Singh", emp_id: "EMP-1003", dept: "HR", in: "09:12 AM", out: "06:15 PM", status: "Present", late: "Yes", duration: "9h" }
        ];

        demoAtt.forEach(att => {
            tbody.append(`
                <tr>
                    <td><div class="employee-col"><span class="name">${att.emp_name}</span></div></td>
                    <td>${att.emp_id}</td>
                    <td>${att.dept}</td>
                    <td>${att.in}</td>
                    <td>${att.out}</td>
                    <td>${att.duration}</td>
                    <td><span class="status-badge status-active">Present</span></td>
                    <td><span class="status-badge" style="background:${att.late === 'Yes' ? '#fee2e2; color:#ef4444' : '#d1fae5; color:#059669'}">${att.late}</span></td>
                    <td style="text-align: right;"><button class="btn-icon"><i data-lucide="edit-2" style="width:14px;"></i></button></td>
                </tr>
            `);
        });
    } else {
        logs.forEach(log => {
            const emp = empMap.get(log.employee_id) || { first_name: 'Unknown', last_name: '', emp_id: '-', department: 'Unassigned' };
            const duration = log.check_in && log.check_out ? 
                ((new Date(`2000-01-01T${log.check_out}`) - new Date(`2000-01-01T${log.check_in}`)) / 3600000).toFixed(1) + 'h' : '-';

            tbody.append(`
                <tr>
                    <td><div class="employee-col"><span class="name">${emp.first_name} ${emp.last_name || ''}</span></div></td>
                    <td>${emp.emp_id || '-'}</td>
                    <td>${emp.department || '-'}</td>
                    <td>${log.check_in || '-'}</td>
                    <td>${log.check_out || '-'}</td>
                    <td>${duration}</td>
                    <td><span class="status-badge status-active">Present</span></td>
                    <td><span class="status-badge" style="background:${log.is_late ? '#fee2e2; color:#ef4444' : '#d1fae5; color:#059669'}">${log.is_late ? 'Yes' : 'No'}</span></td>
                    <td style="text-align: right;"><button class="btn-icon"><i data-lucide="edit-2" style="width:14px;"></i></button></td>
                </tr>
            `);
        });
    }

    lucide.createIcons();
}

function toggleAttendanceManualEntry() {
    const modal = $('#modal-manual-attendance');
    const select = $('#manual-att-emp');
    
    // Populate employee dropdown if empty
    if (select.children('option').length <= 1) {
        dashboardData.employees.forEach(emp => {
            select.append(`<option value="${emp.id}">${emp.first_name} ${emp.last_name || ''} (${emp.emp_id || 'No ID'})</option>`);
        });
    }
    
    modal.css('display', 'flex');
}

// Handle Manual Attendance Submission
$(document).on('submit', '#form-manual-attendance', async function(e) {
    e.preventDefault();
    const btn = $(this).find('button[type="submit"]');
    const originalText = btn.text();
    
    const entry = {
        employee_id: $('#manual-att-emp').val(),
        check_in: $('#manual-att-in').val(),
        check_out: $('#manual-att-out').val(),
        date: $('#attendance-filter-date').val() || new Date().toISOString().split('T')[0],
        remarks: $('#manual-att-remarks').val(),
        status: 'Present'
    };

    try {
        btn.prop('disabled', true).text('Processing...');
        
        const { error } = await supabaseClient.from('attendance_logs').insert([entry]);
        if (error) throw error;

        showRealtimeToast("Success", "Attendance marked successfully.");
        $('#modal-manual-attendance').hide();
        $(this)[0].reset();
        
        // Refresh data
        filterAttendance(); 
    } catch (err) {
        console.error("Manual entry failed:", err);
        alert("Failed to mark attendance. Please try again.");
    } finally {
        btn.prop('disabled', false).text(originalText);
    }
});

async function exportAttendance() {
    const logs = dashboardData.attendanceLogs;
    if (!logs.length) return alert("No logs to export for the selected date.");
    
    showRealtimeToast("Exporting", "Preparing CSV report...");
    
    // Simple CSV Generation
    let csv = "Employee ID,Name,Check-in,Check-out,Working Hours,Status\n";
    logs.forEach(log => {
        const emp = dashboardData.employees.find(e => e.id === log.employee_id) || {};
        csv += `"${emp.emp_id || '-'}","${emp.first_name} ${emp.last_name || ''}","${log.check_in || '-'}","${log.check_out || '-'}","${log.working_hours || '-'}","${log.status || 'Present'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function filterAttendance() {
    const dateInput = $('#attendance-filter-date').val();
    if (!dateInput) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('attendance_logs')
            .select('*')
            .eq('date', dateInput);
            
        if (error) throw error;
        dashboardData.attendanceLogs = data || [];
        renderAttendanceOverview();
        renderAttendanceRecords();
        showRealtimeToast("Updated", `Viewing attendance for ${dateInput}`);
    } catch (e) {
        console.error("Filter error:", e);
    }
}

async function saveLeaveRule() {
    const data = {
        type: $('#leave-type-select').val(),
        limit: $('#leave-annual-limit').val(),
        carryForward: $('#leave-carry-forward').is(':checked')
    };
    console.log('Saving Leave Rule:', data);
    showRealtimeToast("Success", "Leave management rules updated.");
}

async function saveAttendanceRule() {
    const data = {
        start: $('#attendance-shift-start').val(),
        end: $('#attendance-shift-end').val(),
        grace: $('#attendance-late-grace').val()
    };
    console.log('Saving Attendance Rule:', data);
    showRealtimeToast("Success", "Attendance tracking rules updated.");
}

async function savePayrollSettings() {
    const data = {
        structure: $('#payroll-salary-structure').val(),
        tax: $('#payroll-tax-deduction').val()
    };
    console.log('Saving Payroll Settings:', data);
    showRealtimeToast("Success", "Payroll configuration updated.");
}

async function saveGeneralHRSettings() {
    const data = {
        mode: $('#hr-work-mode').val(),
        probation: $('#hr-probation').val()
    };
    console.log('Saving General HR Settings:', data);
    showRealtimeToast("Success", "General HR settings updated.");
}

async function saveCompanyProfile() {
    const btn = $('#btn-save-company-profile');
    const originalHtml = btn.html();

    try {
        btn.prop('disabled', true).html('<i data-lucide="loader" class="spin" style="width:18px;"></i> Saving...');
        lucide.createIcons();

        const profileData = {
            name: $('#comp-name').val(),
            industry: $('#comp-industry').val(),
            size: $('#comp-size').val(),
            email: $('#comp-email').val(),
            phone: $('#comp-phone').val(),
            address: $('#comp-addr-1').val(),
            city: $('#comp-city').val(),
            state: $('#comp-state').val(),
            about: window.companyEditor ? window.companyEditor.root.innerHTML : ''
        };

        console.log('Saving Profile Data:', profileData);

        // Simulate API lag
        await new Promise(r => setTimeout(r, 1200));

        // Show Success Toast
        showRealtimeToast("Success", "Company profile has been updated successfully.");

        // Optional: Update dashboardData if needed
        // dashboardData.company = profileData;

    } catch (err) {
        console.error('Error saving profile:', err);
        alert('Failed to save profile. Please try again.');
    } finally {
        btn.prop('disabled', false).html(originalHtml);
        lucide.createIcons();
    }
}

// Global click handler for the save button
$(document).on('click', '#btn-save-company-profile', function () {
    saveCompanyProfile();
});

// --- Grievance Management Logic ---

async function renderGrievanceTable() {
    const tbody = $('#grievance-table-body');
    if (!tbody.length) return;
    
    // Crucial: Empty the table first to avoid duplication!
    tbody.html('<tr><td colspan="8" style="text-align:center; padding:50px; color:var(--text-muted);"><i data-lucide="loader" class="spin" style="width:20px;"></i> Loading tickets...</td></tr>');
    lucide.createIcons();

    try {
        // Fetch grievances with reporter and visibility roles
        const { data: grievances, error } = await supabaseClient
            .from('grievances')
            .select('*, employees(first_name, last_name, id), grievance_assignments(role)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        dashboardData.grievances = grievances || [];
        tbody.empty(); // Clear loader

        if (dashboardData.grievances.length === 0) {
            tbody.html('<tr><td colspan="7" style="text-align:center; padding:50px; color:var(--text-muted);">No grievances raised yet.</td></tr>');
            return;
        }

        dashboardData.grievances.forEach(conv => {
            const reporter = conv.employees;
            const reporterName = reporter ? `${reporter.first_name} ${reporter.last_name || ''}` : 'Unknown';
            const statusClass = conv.status === 'Open' ? 'status-pending' : (conv.status === 'Resolved' ? 'status-active' : 'status-leave');
            const assignedRoles = conv.grievance_assignments.map(a => a.role);
            const assignedStr = assignedRoles.length > 0 ? assignedRoles.join(', ') : '<span style="color:#94a3b8; font-style:italic;">Employer Only</span>';
            const tid = conv.id.substring(0, 8).toUpperCase();

            tbody.append(`
                <tr>
                    <td style="font-weight:700; color:var(--text-dark);">GRV-${tid}</td>
                    <td><span style="font-size:0.75rem; font-weight:800; padding:3px 8px; border-radius:6px; background:${conv.ticket_type === 'Helpdesk' ? '#eff6ff' : '#f5f3ff'}; color:${conv.ticket_type === 'Helpdesk' ? '#3b82f6' : '#8b5cf6'}; border:1px solid ${conv.ticket_type === 'Helpdesk' ? '#dbeafe' : '#ede9fe'};">${conv.ticket_type || 'Grievance'}</span></td>
                    <td>
                        <div style="font-weight:600; color:var(--text-dark);">${conv.subject}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${conv.category}</div>
                    </td>
                    <td>${reporterName}</td>
                    <td><span style="color:${conv.priority === 'High' ? '#ef4444' : (conv.priority === 'Medium' ? '#f59e0b' : '#10b981')}; font-weight:700;">${conv.priority}</span></td>
                    <td><span class="status-badge ${statusClass}">${conv.status}</span></td>
                    <td style="font-size:0.85rem; font-weight:500;">${assignedStr}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon btn-view-grievance" data-id="${conv.id}" title="View Details"><i data-lucide="external-link" style="width:14px;"></i></button>
                            ${(dashboardData.userRole?.toLowerCase() === 'employer' || dashboardData.userRole?.toLowerCase() === 'admin') ? 
                            `<button class="btn-icon btn-visibility-grievance" data-id="${conv.id}" title="Visibility Control"><i data-lucide="eye" style="width:14px;"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `);
        });

        lucide.createIcons();

    } catch (e) {
        console.error('Error fetching grievances:', e);
    }
}

// Global variables for grievance modals and subscriptions
let currentGrievanceId = null;
let grievanceSubscription = null;

$(document).on('click', '.btn-visibility-grievance', function() {
    const id = $(this).data('id');
    currentGrievanceId = id;
    const grievance = dashboardData.grievances.find(g => g.id === id);
    if (!grievance) return;

    $('#visibility-grievance-id').val(id);
    
    // Reset checkboxes
    $('input[name="visibility-role"]').prop('checked', false);
    
    // Check currently assigned roles
    grievance.grievance_assignments.forEach(ga => {
        $(`input[name="visibility-role"][value="${ga.role}"]`).prop('checked', true);
    });

    $('#grievance-visibility-modal').css('display', 'flex');
});

$(document).on('submit', '#grievance-visibility-form', async function(e) {
    e.preventDefault();
    const btn = $(this).find('button[type="submit"]');
    const id = $('#visibility-grievance-id').val();
    
    const selectedRoles = [];
    $('input[name="visibility-role"]:checked').each(function() {
        selectedRoles.push($(this).val());
    });

    try {
        btn.prop('disabled', true).text('Updating...');

        // 1. Delete old assignments
        await supabaseClient.from('grievance_assignments').delete().eq('grievance_id', id);

        // 2. Insert new assignments
        if (selectedRoles.length > 0) {
            const inserts = selectedRoles.map(role => ({ grievance_id: id, role }));
            await supabaseClient.from('grievance_assignments').insert(inserts);
        }

        // 3. Log the change
        const actorName = localStorage.getItem('salarite_employer_name') || 'Admin';
        await supabaseClient.from('grievance_logs').insert([{
            grievance_id: id,
            action: 'Visibility Updated',
            actor_name: actorName,
            actor_role: 'Employer',
            details: `Visibility set to: ${selectedRoles.join(', ') || 'Only Employer'}`
        }]);

        showRealtimeToast("Updated", "Visibility permissions updated successfully.");
        $('#grievance-visibility-modal').hide();
        renderGrievanceTable();

    } catch (err) {
        console.error('Visibility update error:', err);
        alert('Failed to update visibility.');
    } finally {
        btn.prop('disabled', false).text('Update Visibility');
    }
});

$(document).on('click', '.btn-send-grievance-msg, #btn-send-grievance-reply', sendGrievanceMessage);
$(document).on('keypress', '#detail-grievance-message-input, #grievance-reply-input', function(e) {
    if (e.which == 13) sendGrievanceMessage();
});

$(document).on('click', '.btn-view-grievance', function() {
    const id = $(this).data('id');
    currentGrievanceId = id;
    showGrievanceDetail(id);
});

async function showGrievanceDetail(id) {
    console.log('Attempting to open grievance detail for ID:', id);
    const drawer = $('#grievance-detail-drawer');
    
    if (!dashboardData.grievances) {
        console.error('dashboardData.grievances is missing!');
        return;
    }

    const grievance = dashboardData.grievances.find(g => g.id === id);
    if (!grievance) {
        console.error('Could not find grievance with ID:', id, 'in local data store.');
        return;
    }

    // Inject Drawer Structure
    drawer.html(`
        <div class="drawer-header">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="background:#f1f5f9; color:#64748b; padding:4px 8px; border-radius:6px; font-weight:800; font-size:0.7rem;">${grievance.id.substring(0, 8).toUpperCase()}</span>
                <h3 style="margin:0; font-weight:800; font-size:1.1rem;">${grievance.subject}</h3>
            </div>
            <button onclick="closeGrievanceDrawer()" style="border:none; background:#f1f5f9; color:#64748b; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                <i data-lucide="x" style="width:16px;"></i>
            </button>
        </div>

        <div class="drawer-body">
            <!-- STATUS SELECT -->
            <div style="margin-bottom:24px;">
                <h4 style="font-weight:800; font-size:0.75rem; color:#94a3b8; text-transform:uppercase; margin-bottom:12px;">Ticket Status</h4>
                <select onchange="updateGrievanceStatus('${id}', this.value)" style="width:100%; padding:12px; border-radius:10px; border:1.5px solid #e2e8f0; font-weight:700; outline:none; cursor:pointer;">
                    <option value="Open" ${grievance.status === 'Open' ? 'selected' : ''}>🟡 Open</option>
                    <option value="In Progress" ${grievance.status === 'In Progress' ? 'selected' : ''}>🔵 In Progress</option>
                    <option value="Resolved" ${grievance.status === 'Resolved' ? 'selected' : ''}>🟢 Resolved</option>
                    <option value="Closed" ${grievance.status === 'Closed' ? 'selected' : ''}>⚪ Closed</option>
                </select>
            </div>

            <!-- DESCRIPTION -->
            <div style="margin-bottom:24px;">
                <h4 style="font-weight:800; font-size:0.75rem; color:#94a3b8; text-transform:uppercase; margin-bottom:12px;">Description</h4>
                <div style="background:white; padding:16px; border:1px solid #e2e8f0; border-radius:12px; font-size:0.9rem; line-height:1.5; color:#1e293b;">
                    ${grievance.description}
                </div>
            </div>

            <!-- CHAT -->
            <div style="margin-bottom:24px;">
                <h4 style="font-weight:800; font-size:0.75rem; color:#94a3b8; text-transform:uppercase; margin-bottom:12px;">Conversation</h4>
                <div id="drawer-chat-area" class="chat-bubbles">
                    <div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.8rem;">Loading messages...</div>
                </div>
            </div>

            <!-- METADATA & AUDIT -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:24px;">
                <h4 style="font-weight:800; font-size:0.7rem; color:#64748b; text-transform:uppercase; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Details</h4>
                <div style="display:flex; flex-direction:column; gap:10px; font-size:0.8rem;">
                    <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Raised By:</span><span style="font-weight:700;">${grievance.employees?.first_name || 'Admin'}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Category:</span><span style="font-weight:700;">${grievance.category}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Priority:</span><span style="font-weight:700; color:${grievance.priority === 'High' ? '#ef4444' : '#f59e0b'};">${grievance.priority}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Date:</span><span style="font-weight:700;">${new Date(grievance.created_at).toLocaleDateString()}</span></div>
                </div>
            </div>

            <!-- VISIBILITY SETTINGS -->
            <div style="margin-bottom:24px;">
                <h4 style="font-weight:800; font-size:0.75rem; color:#94a3b8; text-transform:uppercase; margin-bottom:12px;">Personnel Access</h4>
                <div id="drawer-visibility-controls" style="background:#f1f5f9; border-radius:12px; padding:16px;">
                    <div style="color:#64748b; font-size:0.75rem; margin-bottom:12px; line-height:1.4;">Who can handle this ticket? (Optional)</div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${['HR', 'Manager', 'Support', 'Finance'].map(role => {
                            const isAssigned = grievance.grievance_assignments?.some(a => a.role === role);
                            return `
                                <button onclick="toggleGrievanceRole('${id}', '${role}', ${isAssigned})" 
                                    style="padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; border:1px solid ${isAssigned ? '#4D4286' : '#e2e8f0'}; background:${isAssigned ? '#4D4286' : 'white'}; color:${isAssigned ? 'white' : '#64748b'}; cursor:pointer; transition:all 0.2s;">
                                    ${role}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div style="margin-top:24px;">
                <h4 style="font-weight:800; font-size:0.7rem; color:#64748b; text-transform:uppercase; margin-bottom:12px;">Audit Log</h4>
                <div id="drawer-audit-log" style="max-height:200px; overflow-y:auto; background:white; border:1px solid #f1f5f9; border-radius:12px;">
                    <!-- Logs -->
                </div>
            </div>
        </div>

        <div class="drawer-footer">
            <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:8px; display:flex; gap:8px; align-items:center;">
                <input type="text" id="grievance-reply-input" placeholder="Type your response..." style="flex:1; border:none; outline:none; padding:8px; font-size:0.9rem;">
                <button id="btn-send-grievance-reply" style="width:36px; height:36px; background:#4D4286; color:white; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="send" style="width:16px;"></i>
                </button>
            </div>
        </div>
    `);

    lucide.createIcons();
    drawer.addClass('open');
    setupGrievanceRealtime(id);
    fetchGrievanceMessages(id);
    fetchGrievanceAuditLogs(id);
}
window.showGrievanceDetail = showGrievanceDetail;

function setupGrievanceRealtime(id) {
    // Unsubscribe from any previous ticket logic
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
            console.log('Real-time message received:', payload.new);
            appendRealtimeMessage(payload.new);
        })
        .subscribe();
}

function appendRealtimeMessage(m) {
    const chatArea = $('#drawer-chat-area');
    // Remove empty state if present
    if (chatArea.find('.text-muted').length) chatArea.empty();
    if (chatArea.find('[text-align="center"]').length) chatArea.empty(); // Remove "Loading messages..."

    const isEmployer = m.sender_role === 'Employer';
    const isSystem = m.sender_role === 'System';
    const type = isSystem ? 'system' : (isEmployer ? 'employer' : 'employee');

    // Resolve Name from cache
    let senderName = dashboardData.userLookupMap[m.sender_id];
    if (m.sender_id === currentUserId) senderName = 'Me';
    if (isSystem) senderName = 'System';
    if (!senderName) senderName = isEmployer ? 'Admin' : 'Employee';

    chatArea.append(`
        <div class="chat-item ${type}" data-id="${m.id}">
            <div class="chat-bubble">
                ${m.message}
            </div>
            ${!isSystem ? `<div class="chat-meta">${senderName} • ${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>` : ''}
        </div>
    `);

    chatArea.scrollTop(chatArea[0].scrollHeight);
}

async function toggleGrievanceRole(id, role, isCurrent) {
    try {
        if (isCurrent) {
            // Remove assignment
            const { error } = await supabaseClient.from('grievance_assignments').delete().eq('grievance_id', id).eq('role', role);
            if (error) throw error;
        } else {
            // Add assignment
            const { error } = await supabaseClient.from('grievance_assignments').insert([{ grievance_id: id, role: role }]);
            if (error) throw error;
            
            // Log the update
            const actorName = localStorage.getItem('salarite_employer_name') || 'Admin';
            await supabaseClient.from('grievance_logs').insert([{
                grievance_id: id,
                action: 'Access Granted',
                actor_name: actorName,
                actor_role: 'Employer',
                details: `Assigned access to role: ${role}`
            }]);
        }
        
        // Refresh full state and UI
        await renderGrievanceTable();
        showGrievanceDetail(id);
    } catch (e) {
        console.error('Error toggling role:', e);
    }
}
window.toggleGrievanceRole = toggleGrievanceRole;

function closeGrievanceDrawer() {
    $('#grievance-detail-drawer').removeClass('open');
    currentGrievanceId = null;
}

async function fetchGrievanceAuditLogs(id) {
    try {
        const { data: logs, error } = await supabaseClient
            .from('grievance_logs')
            .select('*')
            .eq('grievance_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const logArea = $('#drawer-audit-log');
        if (!logArea.length) return;

        logArea.html(logs.map(l => `
            <div class="audit-item">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:700; color:#1e293b;">${l.action}</span>
                    <span style="color:#94a3b8; font-style:italic;">${new Date(l.created_at).toLocaleDateString()}</span>
                </div>
                <div style="color:#64748b;">${l.actor_name} (${l.actor_role}) • ${l.details || ''}</div>
            </div>
        `).join('') || '<div style="padding:20px; text-align:center; color:#94a3b8;">No audit history found.</div>');
    } catch (err) {
        console.error('Audit log fetch error:', err);
    }
}

async function fetchGrievanceMessages(id) {
    try {
        const { data: messages, error } = await supabaseClient
            .from('grievance_messages')
            .select('*')
            .eq('grievance_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        
        const chatArea = $('#drawer-chat-area');
        if (!chatArea.length) return;

        chatArea.html(messages.map(m => {
            const isEmployer = m.sender_role === 'Employer';
            const isSystem = m.sender_role === 'System';
            const type = isSystem ? 'system' : (isEmployer ? 'employer' : 'employee');
            
            // Resolve Name
            let senderName = dashboardData.userLookupMap[m.sender_id];
            if (m.sender_id === currentUserId) senderName = 'Me';
            if (isSystem) senderName = 'System';
            if (!senderName) senderName = isEmployer ? 'Admin' : 'Employee';

            return `
                <div class="chat-item ${type}" data-id="${m.id}">
                    <div class="chat-bubble">
                        ${m.message}
                    </div>
                    ${!isSystem ? `<div class="chat-meta">${senderName} • ${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>` : ''}
                </div>
            `;
        }).join(''));

        chatArea.scrollTop(chatArea[0].scrollHeight);
    } catch (e) {
        console.error('Error fetching messages:', e);
    }
}

// Handle Detail Select Status
$(document).on('change', '#detail-grievance-status-select', function() {
    updateGrievanceStatus($(this).val());
});

async function updateGrievanceStatus(id, newStatus) {
    if (!newStatus) { 
        // Fallback for single-arg calls
        newStatus = id; 
        id = currentGrievanceId; 
    }
    if (!id) return;

    try {
        const { error } = await supabaseClient
            .from('grievances')
            .update({ status: newStatus ?? id, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        // Log the change
        const actorName = localStorage.getItem('salarite_employer_name') || 'Admin';
        await supabaseClient.from('grievance_logs').insert([{
            grievance_id: id,
            action: 'Status Updated',
            actor_name: actorName,
            actor_role: 'Employer',
            details: `Status changed to ${newStatus}`
        }]);

        // Add a system message to the chat
        await supabaseClient.from('grievance_messages').insert([{
            grievance_id: id,
            message: `🔄 Ticket status updated to ${newStatus} by Employer`,
            sender_role: 'System'
        }]);

        showRealtimeToast("Success", `Ticket status updated to ${newStatus}`);
        renderGrievanceTable();
        fetchGrievanceMessages(currentGrievanceId);

    } catch (err) {
        console.error('Status update error:', err);
    }
}

async function sendGrievanceMessage() {
    let input = $('#detail-grievance-message-input');
    if (!input.length) input = $('#grievance-reply-input'); // Support for grievances.html
    
    let isInternalCheck = $('#detail-grievance-is-internal');
    if (!isInternalCheck.length) isInternalCheck = { is: () => false }; // Fallback
    const msg = input.val().trim();
    if (!msg || !currentGrievanceId) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const isInternal = isInternalCheck.is(':checked');
        
        const { error } = await supabaseClient.from('grievance_messages').insert([{
            grievance_id: currentGrievanceId,
            sender_id: session?.user?.id,
            sender_role: 'Employer',
            message: msg,
            is_internal: isInternal
        }]);

        if (error) throw error;

        input.val('');
        isInternalCheck.prop('checked', false);
        fetchGrievanceMessages(currentGrievanceId);

        // Update Log if it's internal
        if (isInternal) {
            const actorName = localStorage.getItem('salarite_employer_name') || 'Admin';
            await supabaseClient.from('grievance_logs').insert([{
                grievance_id: currentGrievanceId,
                action: 'Internal Note Added',
                actor_name: actorName,
                actor_role: 'Employer',
                details: 'A private note was added by HR/Admin'
            }]);
            fetchGrievanceAuditLogs(currentGrievanceId);
        }

    } catch (err) {
        console.error('Error sending message:', err);
    }
}

