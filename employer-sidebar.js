/**
 * Salarite Employer Sidebar Loader
 * Automatically injects the sidebar into the #sidebar-placeholder element
 */

(function() {
    async function initSidebar() {
        const placeholder = document.getElementById('sidebar-placeholder');
        if (!placeholder) return;

        try {
            const response = await fetch('employer-sidebar.html');
            if (!response.ok) throw new Error('Failed to load sidebar');
            
            const html = await response.text();
            placeholder.innerHTML = html;

            // 1. Highlight Active Menu Item
            const currentPage = window.location.pathname.split('/').pop() || 'employer-dashboard.html';
            const navItems = placeholder.querySelectorAll('.nav-item');
            
            navItems.forEach(item => {
                const itemPage = item.getAttribute('data-page');
                if (itemPage === currentPage) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            // 2. Hydrate Identity (User Name or Company Name)
            const userName = localStorage.getItem('salarite_user_name') || 'Salarite';
            const brandEl = placeholder.querySelector('#company-brand-sidebar');
            if (brandEl) brandEl.innerText = userName;

            // 3. Initialize Lucide Icons for the new HTML
            if (window.lucide) {
                window.lucide.createIcons();
            }

        } catch (error) {
            console.error('Sidebar Loader Error:', error);
            placeholder.innerHTML = '<div style="padding:20px; color:red;">Error loading sidebar. Please refresh.</div>';
        }
    }

    // Run on DOM content loaded (or immediately if already loaded)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
