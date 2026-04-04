/**
 * Salarite Payroll & Compliance Hub Logic (Finalized version)
 */

// Supabase Configuration (Placeholder)
const supabaseUrl = 'https://rrbbbhvethxtbvupolqo.supabase.co';
const supabaseKey = 'sb_publishable_5zK8zx6xnGkD_-QIoOGZAg_5uBOEVv2';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Data store
let payrollData = {
    employees: [],
    structures: [],
    payouts: [],
    loans: [],
    bonuses: []
};

// Initial Setup
$(document).ready(function() {
    initPayroll();
});

async function initPayroll() {
    try {
        const { data: employees } = await supabaseClient.from('profiles').select('*');
        payrollData.employees = employees || [];

        generateEliteDemoData(100); 
        useFullMockData();

        renderDashboardStats();
        renderPayoutRegister();
        renderSalaryStructures();
        renderLoansOnly();
        renderRunReviewTable();
        initExpenseChart();
        initStructureCalculator(); 
        updateStats();
        
        lucide.createIcons();

        // Relocate controls for all tables
        relocateControls('#payout-register-table');
        relocateControls('#run-review-table');
        relocateControls('#structures-table');
        relocateControls('#loans-table');

    } catch (e) {
        console.error('Error initializing Payroll:', e);
        generateEliteDemoData(100);
        useFullMockData();
        renderDashboardStats();
        renderPayoutRegister();
        renderSalaryStructures();
        renderLoansOnly();
        renderRunReviewTable();
        initExpenseChart();
        initStructureCalculator();
        updateStats();
        
        relocateControls('#payout-register-table');
        relocateControls('#run-review-table');
        relocateControls('#structures-table');
        relocateControls('#loans-table');
    }
}

function renderDashboardStats() {
    $('#stat-total-payout').text('₹42,15,400');
    $('#stat-deductions').text('₹6,12,000');
    $('#stat-pending').text('12 Employees');
    $('#stat-avg-net').text('₹45,600');
}

function renderPayoutRegister() {
    const tbody = $('#payout-register-body');
    tbody.empty();

    payrollData.payouts.forEach(p => {
        const initials = p.name.split(' ').map(n=>n[0]).join('');
        tbody.append(`
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:24px; height:24px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.6rem; color:#4D4286;">${initials}</div>
                        <b>${p.name}</b>
                    </div>
                </td>
                <td>${p.dept}</td>
                <td>₹${p.gross.toLocaleString()}</td>
                <td style="color:#ef4444;">- ₹${p.deductions.toLocaleString()}</td>
                <td><b>₹${p.net.toLocaleString()}</b></td>
                <td><span class="status-badge ${p.status === 'Paid' ? 'status-paid' : 'status-pending'}">${p.status}</span></td>
                <td>
                    <button class="btn-pr btn-pr-outline" style="padding:4px 8px;" onclick="alert('Viewing Payslip for ${p.name}')"><i data-lucide="file-text" style="width:12px;"></i> View</button>
                </td>
            </tr>
        `);
    });

    $('#payout-register-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthChange: true,
        lengthMenu: [5, 10, 25, 50, 100],
        pageLength: 10,
        searching: true,
        dom: 'rti p', // Removed 'l' and 'f' from here
        language: { 
            search: "_INPUT_", 
            searchPlaceholder: "Quick Search Employee...",
            lengthMenu: "Show _MENU_",
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            infoEmpty: "Showing 0 to 0 of 0 entries"
        }
    });

    $('.total-entries-badge').text(payrollData.payouts.length + ' Total');
}

function renderSalaryStructures() {
    const tbody = $('#structures-body'); // Corrected tbody ID
    if (!tbody.length) return;
    tbody.empty();

    payrollData.structures.forEach(s => {
        tbody.append(`
            <tr>
                <td><b>${s.name}</b><br><span style="font-size:0.6rem; color:#94a3b8;">${s.id}</span></td>
                <td>₹${s.basic.toLocaleString()}</td>
                <td>₹${s.hra.toLocaleString()}</td>
                <td>₹${s.allow.toLocaleString()}</td>
                <td>₹${s.pf.toLocaleString()}</td>
                <td>₹${s.tds.toLocaleString()}</td>
                <td>
                    <button class="btn-pr btn-pr-outline" style="font-size:0.65rem; padding:4px 10px;" onclick="configureStructure('${s.id}')">Configure</button>
                </td>
            </tr>
        `);
    });

    $('#structures-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50, 100],
        searching: true,
        dom: 'rti p'
    });

    $('.total-structures-badge').text(payrollData.structures.length + ' Total');
}

function renderLoansOnly() {
    const tbody = $('#loans-data-body');
    if (!tbody.length) return;
    tbody.empty();

    payrollData.loans.forEach(l => {
        tbody.append(`
            <tr>
                <td><b>${l.name}</b></td>
                <td>₹${l.amount.toLocaleString()}</td>
                <td>₹${l.emi.toLocaleString()}</td>
                <td>₹${l.remain.toLocaleString()}</td>
                <td><span class="status-badge ${l.status === 'Paid' ? 'status-paid' : 'status-pending'}">${l.status}</span></td>
            </tr>
        `);
    });

    $('#loans-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50, 100],
        searching: true,
        dom: 'rti p'
    });

    $('.total-bonuses-badge').text(payrollData.loans.length + ' Total');
}

function renderRunReviewTable() {
    const tbody = $('#run-review-body');
    if (!tbody.length) return;
    tbody.empty();

    // Show a sample of 4 for review
    const samples = payrollData.payouts.slice(0, 4);
    samples.forEach(p => {
        tbody.append(`
            <tr>
                <td><b>${p.name}</b></td>
                <td><b>26 / 26</b></td>
                <td>₹${p.gross.toLocaleString()}</td>
                <td>₹${(p.gross * 0.05).toLocaleString()}</td>
                <td style="color:#ef4444;">- ₹${p.deductions.toLocaleString()}</td>
                <td><b style="color:var(--pr-primary);">₹${p.net.toLocaleString()}</b></td>
                <td>
                    <button class="btn-pr btn-pr-outline" style="padding:4px 8px;"><i data-lucide="edit-3" style="width:12px;"></i></button>
                </td>
            </tr>
        `);
    });

    $('#run-review-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50, 100],
        searching: true,
        dom: 'rti p'
    });

    $('.total-runs-badge').text(samples.length + ' Total');
}

function relocateControls(tableId) {
    // We delay to ensure DataTable is ready
    setTimeout(() => {
        const tableWrapper = $(tableId).closest('.dataTables_wrapper');
        const header = $(tableId).closest('.payroll-card').find('.table-search-box');
        
        if (header.length) {
            header.empty();
            
            // Create a density control container
            const controls = $('<div style="display:flex; align-items:center; gap:12px;"></div>');
            
            // Grab standard elements
            const filter = tableWrapper.find('.dataTables_filter');
            const length = tableWrapper.find('.dataTables_length');
            
            if (length.length) controls.append(length);
            if (filter.length) controls.append(filter);
            
            header.append(controls);
        }
    }, 100);
}

function generateEliteDemoData(count) {
    const names = ["Amit", "Vikram", "Varun", "Zoya", "Aarav", "Priya", "Neha", "Rahul", "Sonia", "Karan"];
    const surnames = ["Iyer", "Reddy", "Sharma", "Sharma", "Gupta", "Malhotra", "Verma", "Singh", "Kapoor", "Mehta"];
    const depts = ["Sales", "HR", "Tech", "Design", "Legal", "Operations"];

    payrollData.employees = [];
    payrollData.structures = [];

    for (let i = 0; i < count; i++) {
        const firstName = names[i % names.length];
        const lastName = surnames[Math.floor(Math.random() * surnames.length)];
        const fullName = `${firstName} ${lastName}`;
        const dept = depts[Math.floor(Math.random() * depts.length)];
        const id = `SLR-${(i + 1).toString().padStart(3, '0')}`;
        
        const ctc = 30000 + (Math.random() * 90000);
        const basic = ctc * 0.45;
        const hra = basic * 0.40;
        const allow = ctc - (basic + hra);
        const pf = basic * 0.12;
        const tds = ctc * 0.10;

        payrollData.employees.push({
            id: id,
            name: fullName,
            dept: dept,
            gross: ctc,
            deductions: pf + tds,
            net: ctc - (pf + tds)
        });

        payrollData.payouts.push({
            id: id,
            name: fullName,
            dept: dept,
            gross: ctc,
            deductions: pf + tds,
            net: ctc - (pf + tds),
            status: Math.random() > 0.15 ? 'Paid' : 'Pending'
        });

        payrollData.structures.push({
            id: id,
            name: fullName,
            ctc: ctc,
            basic: basic,
            hra: hra,
            allow: allow,
            pf: pf,
            tds: tds
        });
    }

    // Add some loans/bonuses for demo
    payrollData.loans = Array.from({length: 25}, (_, i) => ({
        name: names[i % names.length] + ' ' + surnames[i % surnames.length],
        amount: 25000 + (Math.random() * 200000),
        emi: 5000 + (Math.random() * 15000),
        remain: 10000 + (Math.random() * 150000),
        status: ['Active', 'Repaid', 'EMI Pending'][Math.floor(Math.random() * 3)]
    }));
}

function useFullMockData() {
    // This is handled in generateEliteDemoData
}

function initExpenseChart() {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Basic Salary', 'House Rent (HRA)', 'Deductions (Tax/PF)', 'Others'],
            datasets: [{
                data: [45, 18, 12, 10],
                backgroundColor: ['#4D4286', '#818cf8', '#f87171', '#f1f5f9'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '75%',
            plugins: { legend: { display: false } }
        }
    });
}

function updateStats() {
    // Already handled globally
}

function initStructureCalculator() {
    // Calculator logic for modal would go here
}

function configureStructure(id) {
    alert('Opening advanced CTC configuration for ' + id);
}

function syncAttendanceData() {
    alert('Connecting to Attendance Server... Data synced for 154 employees.');
    renderRunReviewTable();
    relocateControls('#run-review-table');
}

function lockPayroll() {
    alert('Payroll snapshot locked. Compliance reports generated.');
}

function processBulkPayment() {
    alert('Processing batch payments... Funds disbursed.');
}
