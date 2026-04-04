/**
 * Salarite Document Center Logic
 * High-Density Workforce Document Discovery & Lifecycle Management
 */

// Global State
const docData = {
    documents: [],
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
}

function renderRecentDocs() {
    const tbody = $('#recent-docs-body');
    tbody.empty();

    // Show latest 10 first
    const list = [...docData.documents].sort((a,b) => new Date(b.date) - new Date(a.date));
    
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
                        <button class="btn-doc" style="padding:4px 8px;"><i data-lucide="download" style="width:12px;"></i></button>
                        <button class="btn-doc" style="padding:4px 8px;"><i data-lucide="eye" style="width:12px;"></i></button>
                    </div>
                </td>
            </tr>
        `);
    });

    $('#recent-docs-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50],
        pageLength: 10,
        searching: true,
        dom: 'rti p',
        language: {
            searchPlaceholder: "Discovery Search...",
            lengthMenu: "Show _MENU_"
        }
    });

    relocateControls('#recent-docs-table', '#overview-search');
}

function renderMasterDirectory() {
    const tbody = $('#master-docs-body');
    tbody.empty();

    docData.documents.forEach(doc => {
        const expiryBadge = doc.expiry !== 'None' ? `<span style="color:#ef4444; font-weight:800;">Exp: ${doc.expiry}</span>` : '<span style="color:#94a3b8;">Permanent</span>';
        tbody.append(`
            <tr>
                <td><b>${doc.name}</b></td>
                <td>${doc.type}</td>
                <td>${expiryBadge}</td>
                <td><span class="status-badge status-active">Compliant</span></td>
                <td>
                     <div style="display:flex; gap:8px;">
                        <button class="btn-doc" style="padding:4px 8px;">Action</button>
                    </div>
                </td>
            </tr>
        `);
    });

    $('#master-docs-table').DataTable({
        destroy: true,
        paging: true,
        info: true,
        lengthMenu: [10, 25, 50, 100],
        searching: true,
        dom: 'rti p'
    });

    relocateControls('#master-docs-table', '#master-search');
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

// Module Tab Switching Logic (Internal to HTML, but here for reference)
function switchSection(target) {
    $('.section-content').removeClass('active-section');
    $('#' + target).addClass('active-section');
    lucide.createIcons();
}
