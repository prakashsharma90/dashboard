/**
 * Salarite Analytics & Reports Central Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCharts();
    populateTables();
    populateDeptAnalytics();
    setupFilters();
    initLucide();
});

function initLucide() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// 1. Tab Switching Logic
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');

            // Toggle Tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Toggle Content
            contents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${target}-tab`) {
                    content.classList.add('active');
                }
            });

            // Re-render charts in case of sizing issues on hidden tabs
            // (Chart.js handles this mostly fine now, but good practice)
        });
    });
}

// 2. Chart Initialization
let charts = {};

function initCharts() {
    // Shared Chart Options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', size: 11 } } },
            tooltip: { backgroundColor: '#1e293b', titleFont: { size: 14 }, bodyFont: { size: 13 }, padding: 12 }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Inter' } } }
        }
    };

    // --- Overview Tab ---
    
    // Productivity Trend (Line)
    const ctxProd = document.getElementById('productivityChart');
    if (ctxProd) {
        charts.productivity = new Chart(ctxProd, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Efficiency %',
                    data: [82, 85, 84, 89, 92, 91, 95],
                    borderColor: '#4D4286',
                    backgroundColor: 'rgba(77, 66, 134, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: commonOptions
        });
    }

    // Dept Distribution (Doughnut)
    const ctxDept = document.getElementById('deptDistributionChart');
    if (ctxDept) {
        charts.deptDist = new Chart(ctxDept, {
            type: 'doughnut',
            data: {
                labels: ['Engineering', 'Marketing', 'Sales', 'HR', 'Operations'],
                datasets: [{
                    data: [45, 15, 20, 10, 34],
                    backgroundColor: ['#4D4286', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 12
                }]
            },
            options: {
                ...commonOptions,
                cutout: '70%',
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }

    // Headcount Growth (Bar)
    const ctxGrowth = document.getElementById('growthChart');
    if (ctxGrowth) {
        charts.growth = new Chart(ctxGrowth, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'New Hires',
                    data: [4, 8, 5, 10, 6, 9],
                    backgroundColor: '#4D4286',
                    borderRadius: 6
                }]
            },
            options: commonOptions
        });
    }

    // --- Performance Tab ---
    
    // Dept Performance (Radar)
    const ctxPerfDept = document.getElementById('perfDeptChart');
    if (ctxPerfDept) {
        charts.perfDept = new Chart(ctxPerfDept, {
            type: 'radar',
            data: {
                labels: ['Quality', 'Speed', 'Communication', 'Reliability', 'Collaboration'],
                datasets: [{
                    label: 'Current Month',
                    data: [90, 85, 95, 80, 88],
                    borderColor: '#4D4286',
                    backgroundColor: 'rgba(77, 66, 134, 0.2)'
                }]
            },
            options: { ...commonOptions, scales: { r: { angleLines: { display: false }, suggestedMin: 50, suggestedMax: 100 } } }
        });
    }

    // Task Completion (Pie)
    const ctxTask = document.getElementById('taskCompletionChart');
    if (ctxTask) {
        charts.task = new Chart(ctxTask, {
            type: 'pie',
            data: {
                labels: ['Completed', 'Pending', 'Delayed'],
                datasets: [{
                    data: [75, 20, 5],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
                }]
            },
            options: commonOptions
        });
    }

    // --- Attendance Tab ---
    const ctxAttend = document.getElementById('attendancePatternChart');
    if (ctxAttend) {
        charts.attendance = new Chart(ctxAttend, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'On-time %',
                    data: [98, 95, 96, 92, 88, 70, 0],
                    borderColor: '#10b981',
                    tension: 0.3
                }, {
                    label: 'Late %',
                    data: [2, 5, 4, 8, 12, 30, 0],
                    borderColor: '#f59e0b',
                    tension: 0.3
                }]
            },
            options: commonOptions
        });
    }

    // --- Leave Tab ---
    const ctxLeave = document.getElementById('leaveDistributionChart');
    if (ctxLeave) {
        charts.leave = new Chart(ctxLeave, {
            type: 'bar',
            data: {
                labels: ['Sick', 'Casual', 'Accrued', 'Unpaid'],
                datasets: [{
                    data: [12, 25, 45, 8],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#64748b']
                }]
            },
            options: commonOptions
        });
    }

    // --- Recruitment (ATS) ---
    const ctxATS = document.getElementById('recruitmentFunnelChart');
    if (ctxATS) {
        charts.ats = new Chart(ctxATS, {
            type: 'bar',
            indexAxis: 'y',
            data: {
                labels: ['Applied', 'Screened', 'Interview', 'Offered', 'Hired'],
                datasets: [{
                    label: 'Candidate Count',
                    data: [458, 120, 45, 12, 10],
                    backgroundColor: ['#94a3b8', '#6366f1', '#4D4286', '#10b981', '#059669'],
                    borderRadius: 8
                }]
            },
            options: { ...commonOptions, plugins: { legend: { display: false } } }
        });
    }

    // --- Payroll ---
    const ctxPayDept = document.getElementById('payrollDeptChart');
    if (ctxPayDept) {
        charts.payrollDept = new Chart(ctxPayDept, {
            type: 'doughnut',
            data: {
                labels: ['Tech', 'Operations', 'Sales', 'Admin'],
                datasets: [{
                    data: [1200000, 300000, 250000, 90000],
                    backgroundColor: ['#4D4286', '#10b981', '#f59e0b', '#ef4444']
                }]
            },
            options: { ...commonOptions, cutout: '65%' }
        });
    }
}

// 3. Populate Lists/Tables
function populateTables() {
    const tableBody = document.getElementById('top-performers-body');
    if (!tableBody) return;

    const data = [
        { name: 'Priya Sharma', dept: 'Engineering', kpi: 98, tasks: 42, status: 'Active' },
        { name: 'Rahul Varma', dept: 'Sales', kpi: 95, tasks: 38, status: 'Active' },
        { name: 'Ananya Iyer', dept: 'HR', kpi: 92, tasks: 15, status: 'Active' },
        { name: 'Arjun Das', dept: 'Operations', kpi: 88, tasks: 56, status: 'On Leave' },
        { name: 'Sanya Malhotra', dept: 'Marketing', kpi: 85, tasks: 22, status: 'Active' }
    ];

    tableBody.innerHTML = data.map(emp => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--accent); font-size: 0.75rem;">${emp.name.charAt(0)}</div>
                    <span style="font-weight: 600;">${emp.name}</span>
                </div>
            </td>
            <td>${emp.dept}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 100px; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
                        <div style="width: ${emp.kpi}%; height: 100%; background: var(--accent);"></div>
                    </div>
                    <strong>${emp.kpi}%</strong>
                </div>
            </td>
            <td>${emp.tasks}</td>
            <td>
                <span class="badge-status ${emp.status === 'Active' ? 'badge-present' : 'badge-late'}">${emp.status}</span>
            </td>
        </tr>
    `).join('');
}

// 4. Setup Global Filters
function setupFilters() {
    const timeFilter = document.getElementById('time-filter');
    const deptFilter = document.getElementById('dept-filter');

    if (timeFilter) {
        timeFilter.addEventListener('change', () => {
            console.log('Filtering time:', timeFilter.value);
            // In a real app, fetch new data and update charts
            simulateLoading();
        });
    }

    if (deptFilter) {
        deptFilter.addEventListener('change', () => {
            console.log('Filtering department:', deptFilter.value);
            simulateLoading();
        });
    }

    const exportBtn = document.getElementById('export-master');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            alert('Preparing report for download...\nFormat: CSV (High Res Data)');
            // Logic to CSV conversion would go here
        });
    }
}

function simulateLoading() {
    // Show a quick fade effect to simulate data refreshing
    const container = document.querySelector('.reports-container');
    container.style.opacity = '0.5';
    setTimeout(() => {
        container.style.opacity = '1';
    }, 400);
}

// 5. Drilldown Logic & Dummy Data Implementation

// --- Level 1: Department Analytics Table ---
function populateDeptAnalytics() {
    const tableBody = document.getElementById('dept-analytics-body');
    if (!tableBody) return;

    const depts = [
        { name: 'Human Resources', employees: 12, active: 10, att: '92%', prod: '85%' },
        { name: 'Engineering/IT', employees: 25, active: 22, att: '88%', prod: '91%' },
        { name: 'Finance', employees: 8, active: 7, att: '95%', prod: '89%' },
        { name: 'Sales & Marketing', employees: 30, active: 28, att: '96%', prod: '94%' },
        { name: 'Operations', employees: 49, active: 47, att: '97%', prod: '82%' },
        { name: 'Accounts', employees: 5, active: 5, att: '98%', prod: '95%' }
    ];

    tableBody.innerHTML = depts.map(d => `
        <tr>
            <td style="font-weight: 600; color: var(--text-dark);">${d.name}</td>
            <td>${d.employees}</td>
            <td>${d.active}</td>
            <td><strong>${d.att}</strong></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 80px; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
                        <div style="width: ${d.prod}; height: 100%; background: var(--accent);"></div>
                    </div>
                    <strong>${d.prod}</strong>
                </div>
            </td>
            <td style="text-align: right;">
                <button class="btn-outline btn-sm" onclick="openDeptDrilldown('${d.name}')" style="padding: 6px 12px; border-radius: 8px;">
                    View <i data-lucide="arrow-right" style="width: 14px; margin-left: 4px;"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Re-init lucide icons for newly added HTML
    if (window.lucide) window.lucide.createIcons();
}

// --- Level 2: Department Drilldown (Employee List) ---
function openDeptDrilldown(deptName) {
    document.getElementById('drilldown-dept-name').innerText = deptName;
    
    const tableBody = document.getElementById('emp-drilldown-body');
    // Generate dummy employees
    const emps = [
        { id: 'EMP001', name: 'Krish P.', role: 'Senior Executive', exp: '2.5 Years', att: '94%', perfScore: 'Top 15%', status: 'Active' },
        { id: 'EMP002', name: 'Rahul S.', role: 'Developer', exp: '1.2 Years', att: '88%', perfScore: 'Avg', status: 'Active' },
        { id: 'EMP003', name: 'Anjali Sharma', role: 'Analyst', exp: '6 Months', att: '98%', perfScore: 'Top 5%', status: 'Active' },
        { id: 'EMP004', name: 'Vikram Singh', role: 'Consultant', exp: '3 Years', att: '75%', perfScore: 'Low', status: 'On Leave' }
    ];

    tableBody.innerHTML = emps.map(e => `
        <tr>
            <td style="font-family: monospace; font-weight: 600;">${e.id}</td>
            <td style="font-weight: 600;">${e.name}</td>
            <td>${e.role}</td>
            <td>${e.exp}</td>
            <td style="font-weight: 700;">${e.att}</td>
            <td>
                <span style="color: ${e.perfScore.includes('Top') ? 'var(--success)' : e.perfScore === 'Low' ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">
                    ${e.perfScore}
                </span>
            </td>
            <td>
                <span class="badge ${e.status === 'Active' ? 'badge-present' : 'badge-absent'}">${e.status}</span>
            </td>
            <td style="text-align: right;">
                <button class="btn-primary btn-sm" onclick="openEmpDeepAnalytics('${e.id}', '${e.name}', '${e.role}', '${deptName}')" style="padding: 6px 12px; border-radius: 8px;">
                    View More
                </button>
            </td>
        </tr>
    `).join('');

    document.getElementById('dept-drilldown-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    if (window.lucide) window.lucide.createIcons();
}

function closeDeptDrilldown() {
    document.getElementById('dept-drilldown-overlay').style.display = 'none';
    document.body.style.overflow = '';
}

function exportDeptData() {
    alert("Exporting Department Data as CSV...");
}

function exportEmpList() {
    alert("Exporting Employee Bulk Data...");
}

// --- Level 3: Full Employee Deep Analytics ---
function openEmpDeepAnalytics(id, name, role, dept) {
    document.getElementById('deep-emp-name').innerText = name;
    document.getElementById('deep-emp-role').innerText = `${role} • ${dept}`;
    document.getElementById('deep-emp-initial').innerText = name.charAt(0);
    
    document.getElementById('emp-deep-overlay').style.display = 'flex';
    // Optional: Fetch employee intelligence data here
    
    if (window.lucide) window.lucide.createIcons();
}

function closeEmpDeepAnalytics() {
    document.getElementById('emp-deep-overlay').style.display = 'none';
}
