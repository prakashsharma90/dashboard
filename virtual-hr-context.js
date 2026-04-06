/**
 * Virtual HR Operational Context Manager
 * Handles company selection, context initialization, and state persistence.
 */

const VHR_CONTEXT_KEY = "salarite_vhr_active_context";
const VHR_RECENT_KEY = "salarite_vhr_recent_contexts";

const companies = [
    { id: "sal-01", name: "Salarite Pvt Ltd", industry: "HR Tech Platform", employees: 142, status: "active", logo: "S" },
    { id: "tn-05", name: "TechNova Solutions", industry: "Medical R&D", employees: 88, status: "active", logo: "T" },
    { id: "gl-09", name: "Global Logistics", industry: "IT Services", employees: 315, status: "pending", logo: "G" },
    { id: "ax-22", name: "Axon Innovations", industry: "Eco-Tech", employees: 54, status: "active", logo: "A" },
    { id: "zv-14", name: "Zovio Systems", industry: "Ed-Tech", employees: 210, status: "active", logo: "Z" }
];

let selectedContext = null;

class VHRContextManager {
    constructor() {
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderList(companies);
        this.checkExistingContext();
        this.renderRecent();
    }

    cacheElements() {
        this.screen = document.getElementById('selection-screen');
        this.dashboard = document.getElementById('main-dashboard-view');
        this.trigger = document.getElementById('vhr-ctx-trigger');
        this.dropdown = document.getElementById('vhr-ctx-dropdown');
        this.search = document.getElementById('ctx-search');
        this.list = document.getElementById('ctx-list');
        this.btnContinue = document.getElementById('btn-initialize-ctx');
        this.btnSwitch = document.getElementById('btn-switch-context');
        this.displayCompName = document.getElementById('display-company-name');
        this.recentSection = document.getElementById('recent-ctx-section');
        this.recentChips = document.getElementById('recent-ctx-chips');
    }

    bindEvents() {
        // Dropdown Toggle
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dropdown.classList.toggle('active');
        });

        // Close on click outside
        document.addEventListener('click', () => {
            this.dropdown.classList.remove('active');
        });

        // Search Filter
        this.search.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = companies.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.industry.toLowerCase().includes(query)
            );
            this.renderList(filtered);
        });

        // Continue Button
        this.btnContinue.addEventListener('click', () => {
            if (this.selectedContext) {
                this.initializeContext(this.selectedContext);
            }
        });

        // Switch Context Button (Top Bar)
        if (this.btnSwitch) {
            this.btnSwitch.addEventListener('click', () => {
                this.showSelectionScreen();
            });
        }
    }

    renderList(items) {
        this.list.innerHTML = '';
        items.forEach(c => {
            const card = document.createElement('div');
            card.className = `comp-card ${this.selectedContext?.id === c.id ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="comp-icon">${c.logo}</div>
                <div class="comp-details">
                    <span class="comp-name">${c.name}</span>
                    <span class="comp-industry">${c.industry}</span>
                    <div class="comp-meta">
                        <span class="meta-pill"><i data-lucide="users" style="width:10px;"></i> ${c.employees} Employees</span>
                        <span class="meta-pill">
                            <span class="status-dot dot-${c.status}"></span>
                            ${c.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div class="preview-tooltip">
                    <div class="tooltip-stat">
                        <span class="t-label">Pending Tasks</span>
                        <span class="t-val">${Math.floor(Math.random() * 10) + 2}</span>
                    </div>
                    <div class="tooltip-stat">
                        <span class="t-label">Active Jobs</span>
                        <span class="t-val">${Math.floor(Math.random() * 5)}</span>
                    </div>
                    <div class="tooltip-stat">
                        <span class="t-label">Last Activity</span>
                        <span class="t-val">Today, 10:45 AM</span>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectContext(c);
                this.dropdown.classList.remove('active');
            });
            
            this.list.appendChild(card);
        });
        if (window.lucide) lucide.createIcons();
    }

    selectContext(company) {
        this.selectedContext = company;
        document.getElementById('selected-ctx-name').innerText = company.name;
        document.getElementById('selected-ctx-name').style.color = 'white';
        
        // Update list highighting
        Array.from(this.list.children).forEach(child => {
            child.classList.toggle('selected', child.querySelector('.comp-name').innerText === company.name);
        });

        this.btnContinue.disabled = false;
        
        // Add subtle feedback
        this.btnContinue.style.transform = 'scale(1.02)';
        setTimeout(() => this.btnContinue.style.transform = 'scale(1)', 200);
    }

    initializeContext(company) {
        // Store in state (localStorage)
        localStorage.setItem(VHR_CONTEXT_KEY, JSON.stringify(company));
        
        // Update Recents
        this.updateRecent(company);

        // UI Transition
        this.btnContinue.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:20px;"></i> Initializing Context...`;
        lucide.createIcons();
        
        setTimeout(() => {
            this.hideSelectionScreen();
            this.updateDashboardContext(company);
            this.updateActiveSessionsCount(); // Sync active sessions
            this.btnContinue.innerHTML = `Continue to Dashboard <i data-lucide="arrow-right" style="width:20px;"></i>`;
            lucide.createIcons();
        }, 800);
    }

    updateActiveSessionsCount() {
        const countEl = document.getElementById('active-sessions-count');
        if (!countEl) return;

        let activeCount = 0;
        companies.forEach(comp => {
            const isCheckedIn = localStorage.getItem(`vhr_checked_in_${comp.id}`) === 'true';
            if (isCheckedIn) activeCount++;
        });

        countEl.innerText = activeCount;
    }

    updateDashboardContext(company) {
        if (this.displayCompName) this.displayCompName.innerText = company.name;
        
        // If we have a sub-view switcher, reset to default view
        if (window.switchSubView) {
            window.switchSubView('personal-dashboard');
        }
    }

    showSelectionScreen() {
        this.screen.style.display = 'flex';
        this.screen.style.opacity = '0';
        requestAnimationFrame(() => {
            this.screen.style.opacity = '1';
            this.dashboard.style.display = 'none';
        });
    }

    hideSelectionScreen() {
        this.screen.style.opacity = '0';
        this.screen.style.transform = 'scale(1.1)';
        setTimeout(() => {
            this.screen.style.display = 'none';
            this.screen.style.transform = 'scale(1)';
            this.dashboard.style.display = 'grid'; // Grid because it's a split view
        }, 500);
    }

    checkExistingContext() {
        const saved = localStorage.getItem(VHR_CONTEXT_KEY);
        if (saved) {
            const company = JSON.parse(saved);
            // Optional: Auto-select and skip
            // this.selectContext(company);
            // this.initializeContext(company);
        }
    }

    updateRecent(company) {
        let recents = JSON.parse(localStorage.getItem(VHR_RECENT_KEY) || '[]');
        recents = [company, ...recents.filter(r => r.id !== company.id)].slice(0, 3);
        localStorage.setItem(VHR_RECENT_KEY, JSON.stringify(recents));
        this.renderRecent();
    }

    renderRecent() {
        const recents = JSON.parse(localStorage.getItem(VHR_RECENT_KEY) || '[]');
        if (recents.length > 0) {
            this.recentSection.style.display = 'block';
            this.recentChips.innerHTML = '';
            recents.forEach(r => {
                const chip = document.createElement('div');
                chip.className = 'recent-chip';
                chip.innerText = r.name;
                chip.addEventListener('click', () => this.selectContext(r));
                this.recentChips.appendChild(chip);
            });
        }
    }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
    window.vhrContext = new VHRContextManager();
    
    // Initial sync of active sessions
    setTimeout(() => {
        if (window.vhrContext) window.vhrContext.updateActiveSessionsCount();
    }, 100);
});
