/**
 * Salarite Document Center Logic
 * High-Density Workforce Document Discovery & Lifecycle Management
 */

// Global State
const docData = {
    documents: [],
    employees: [], // Augmented with doc status
    folders: [
        { name: 'Company Policies', icon: 'folder', count: 12, color: '#3b82f6' },
        { name: 'Offer Letters', icon: 'briefcase', count: 450, color: '#eab308' },
        { name: 'Employee IDs', icon: 'user', count: 890, color: '#22c55e' },
        { name: 'Contracts', icon: 'file-signature', count: 115, color: '#8b5cf6' }
    ]
};

// Initial Setup
$(document).ready(function() {
    initDocumentCenter();
});

async function initDocumentCenter() {
    generateMockDocuments(100);
    renderRecentDocs();
    renderMasterDirectory();
    renderEmployeeRecords();
    
    // Tab switching
    $('.nav-link').on('click', function() {
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        const target = $(this).data('target');
        $('.section-content').removeClass('active-section');
        $('#' + target).addClass('active-section');
        lucide.createIcons();
    });

    // Filtering logic
    $('#filter-type, #filter-status').on('change', function() {
        renderMasterDirectory();
    });

    lucide.createIcons();
}

function generateMockDocuments(count) {
    const names = ["Amit", "Vikram", "Varun", "Zoya", "Aarav", "Priya", "Neha", "Rahul", "Sonia", "Karan"];
    const surnames = ["Iyer", "Reddy", "Sharma", "Sharma", "Gupta", "Malhotra", "Verma", "Singh", "Kapoor", "Mehta"];
    const types = ["Offer Letter", "Aadhar Card", "NDA", "Experience Letter", "Policy Update", "Passport"];
    const uploaders = ["HR Admin", "Prakash Sharma", "Salarite Bot", "John Doe"];

    for (let i = 0; i < count; i++) {
        const empName = names[i % names.length] + ' ' + surnames[Math.floor(Math.random() * surnames.length)];
        const docName = `${types[i % types.length]}_${empName.replace(' ', '_')}.pdf`;
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 60));

        docData.documents.push({
            id: `DOC-${(i + 1).toString().padStart(4, '0')}`,
            name: docName,
            type: types[i % types.length],
            employee: empName,
            uploader: uploaders[i % uploaders.length],
            date: date.toISOString().split('T')[0],
            status: Math.random() > 0.2 ? 'Active' : 'Pending',
            expiry: Math.random() > 0.8 ? '2026-06-20' : 'None'
        });
    }

    // Generate employee records based on these docs
    const distinctEmps = [...new Set(docData.documents.map(d => d.employee))];
    docData.employees = distinctEmps.map(name => ({
        name: name,
        aadhar: Math.random() > 0.1 ? 'Verified' : 'Pending',
        pan: Math.random() > 0.1 ? 'Verified' : 'Missing',
        resume: 'Uploaded',
        offer: 'Generated',
        kyc: Math.floor(60 + Math.random() * 40) + '%'
    }));
}

function renderRecentDocs() {
    const tbody = $('#recent-docs-body');
    tbody.empty();
    const list = [...docData.documents].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    list.forEach(doc => {
        const statusClass = doc.status === 'Active' ? 'status-active' : 'status-pending';
        tbody.append(`
            <tr>
                <td><b>${doc.name}</b></td>
                <td>${doc.type}</td>
                <td>${doc.employee}</td>
                <td>${doc.uploader}</td>
                <td>${doc.date}</td>
                <td><span class="status-badge ${statusClass}">${doc.status}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-doc" onclick="downloadDoc('${doc.id}')"><i data-lucide="download" style="width:12px;"></i></button>
                    </div>
                </td>
            </tr>
        `);
    });

    $('#recent-docs-table').DataTable({
        destroy: true,
        paging: false,
        info: false,
        searching: true,
        dom: 'frti',
        language: { searchPlaceholder: "Discovery Search..." }
    });
    relocateControls('#recent-docs-table', '#overview-search');
}

function renderMasterDirectory() {
    const tbody = $('#master-docs-body');
    tbody.empty();

    const typeFilt = $('#filter-type').val();
    const statusFilt = $('#filter-status').val();

    const list = docData.documents.filter(d => {
        const tMatch = typeFilt ? d.type === typeFilt : true;
        const sMatch = statusFilt ? d.status === statusFilt : true;
        return tMatch && sMatch;
    });

    list.forEach(doc => {
        const statusClass = doc.status === 'Active' ? 'status-active' : 'status-pending';
        const expiryBadge = doc.expiry !== 'None' ? `<span style="color:#ef4444; font-weight:800;">Exp: ${doc.expiry}</span>` : '<span style="color:#94a3b8;">Permanent</span>';
        tbody.append(`
            <tr>
                <td><b>${doc.name}</b></td>
                <td>${doc.type}</td>
                <td>${doc.employee}</td>
                <td>${expiryBadge}</td>
                <td><span class="status-badge status-active">Compliant</span></td>
                <td><span class="status-badge ${statusClass}">${doc.status}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-doc" onclick="verifyDoc('${doc.id}')">Verify</button>
                        <button class="btn-doc" style="color:#ef4444;" onclick="deleteDoc('${doc.id}')"><i data-lucide="trash-2" style="width:12px;"></i></button>
                    </div>
                </td>
            </tr>
        `);
    });

    const table = $('#master-docs-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50, 100],
        searching: true,
        dom: 'lfrtip'
    });

    relocateControls('#master-docs-table', '#master-search');
    $('.total-docs-badge').text(list.length + ' Total');
}

function renderEmployeeRecords() {
    const tbody = $('#records-body');
    tbody.empty();

    docData.employees.forEach(e => {
        const aadhClass = e.aadhar === 'Verified' ? 'color:#10b981;' : 'color:#f59e0b;';
        const panClass = e.pan === 'Verified' ? 'color:#10b981;' : 'color:#ef4444;';
        
        tbody.append(`
            <tr>
                <td><b>${e.name}</b></td>
                <td style="${aadhClass} font-weight:800;">${e.aadhar}</td>
                <td style="${panClass} font-weight:800;">${e.pan}</td>
                <td style="color:#3b82f6; font-weight:800;">${e.resume}</td>
                <td style="color:#8b5cf6; font-weight:800;">To be Digitized</td>
                <td><b style="color:#4D4286;">${e.kyc}</b></td>
                <td>
                    <button class="btn-doc" onclick="auditEmployee('${e.name}')">Audit Profile</button>
                </td>
            </tr>
        `);
    });

    $('#records-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50, 100],
        searching: true,
        dom: 'lfrtip'
    });

    relocateControls('#records-table', '#records-search');
    $('.total-records-badge').text(docData.employees.length + ' Records');
}

function relocateControls(tableId, targetId) {
    setTimeout(() => {
        const tableWrapper = $(tableId).closest('.dataTables_wrapper');
        const header = $(targetId);
        
        if (header.length) {
            header.empty();
            const controls = $('<div style="display:flex; align-items:center; gap:12px;"></div>');
            const length = tableWrapper.find('.dataTables_length');
            const filter = tableWrapper.find('.dataTables_filter');
            
            if (length.length) controls.append(length);
            if (filter.length) controls.append(filter);
            
            header.append(controls);
        }
    }, 100);
}

// Functional Actions
function verifyDoc(id) {
    const doc = docData.documents.find(d => d.id === id);
    if (doc) {
        doc.status = 'Active';
        alert('Institutional Verification Complete for: ' + doc.name);
        renderMasterDirectory();
    }
}

function deleteDoc(id) {
    if (confirm('Are you sure you want to delete this institutional record?')) {
        docData.documents = docData.documents.filter(d => d.id !== id);
        alert('Document purged from secure storage.');
        renderMasterDirectory();
        renderRecentDocs();
    }
}

function downloadDoc(id) {
    alert('Initializing secure download channel for ' + id + '...');
}

function auditEmployee(name) {
    alert('Opening Full Compliance Audit for ' + name);
}
