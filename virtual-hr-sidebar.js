/**
 * Salarite Virtual HR Sidebar Loader
 * Automatically injects the sidebar into the #sidebar-placeholder element
 * Includes mobile hamburger toggle functionality and sub-view switching link logic
 */

(function() {
    async function initSidebar() {
        const placeholder = document.getElementById('sidebar-placeholder');
        if (!placeholder) return;

        try {
            // Add a timestamp cache-buster to ensure the latest sidebar is always fetched
            const response = await fetch('virtual-hr-sidebar.html?v=' + new Date().getTime());
            if (!response.ok) throw new Error('Failed to load sidebar content');
            
            const html = await response.text();
            placeholder.innerHTML = html;

            // 1. Initialize Lucide Icons for the new HTML
            if (window.lucide) {
                window.lucide.createIcons();
            }

            // 2. Mobile Hamburger Toggle Logic (Must be BEFORE nav binding to ensure closeSidebar is ready)
            initMobileToggle();

            // 3. Attach sub-view navigation logic
            const navItems = placeholder.querySelectorAll('.nav-item-hr');
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    if (typeof window.switchSubView === 'function') {
                        const viewId = item.getAttribute('data-view');
                        const dataUrl = item.getAttribute('data-url');
                        window.switchSubView(viewId, dataUrl);
                        
                        // Close mobile sidebar on click using the globalized function
                        if (typeof window.closeSidebar === 'function') {
                            window.closeSidebar();
                        }
                    }
                });
            });
            // 4. Initial Hash-Based Startup Routing
            if (typeof window.switchSubView === 'function') {
                // Determine target from URL hash, default to personal dashboard if no hash
                let initialHash = window.location.hash ? window.location.hash.substring(1) : 'personal-dashboard';
                
                // Find corresponding nav link
                let targetLink = placeholder.querySelector(`[data-view="${initialHash}"]`);
                
                // Fallback to personal dashboard if hash is unrecognized
                if (!targetLink) {
                    initialHash = 'personal-dashboard';
                    targetLink = placeholder.querySelector('[data-view="personal-dashboard"]');
                }
                
                // Fire the initial router load!
                if (targetLink) {
                    const dataUrl = targetLink.getAttribute('data-url');
                    window.switchSubView(initialHash, dataUrl);
                }
            }

        } catch (error) {
            console.error('VHR Sidebar Loader Error:', error);
            placeholder.innerHTML = '<div style="padding:20px; color:red; font-size:0.8rem;">Critical Error: Dashboard context failed to load. Please refresh.</div>';
        }
    }

    function initMobileToggle() {
        const hamburgerBtn = document.getElementById('sidebar-hamburger-btn');
        const closeBtn = document.getElementById('sidebar-close-btn');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebar = document.getElementById('employer-sidebar');

        if (!hamburgerBtn || !sidebar) return;

        function openSidebar() {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        hamburgerBtn.addEventListener('click', openSidebar);
        if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);

        // Export closeSidebar to global for use in nav click above
        window.closeSidebar = closeSidebar;
    }

    // Run on DOM content loaded (or immediately if already loaded)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
