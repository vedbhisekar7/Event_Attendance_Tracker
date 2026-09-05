/**
 * Main Application Module
 * Handles navigation, toast notifications, modals, and app initialization
 */
const App = {
    currentPage: 'dashboard',

    init() {
        this.setupNavigation();
        this.setupMobileMenu();
        this.setupExport();
        this.setupModal();

        // Load initial page
        this.navigateTo('dashboard');
    },

    // ---- Navigation ----
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        this.currentPage = page;

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Show active page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');

        // Load page-specific data
        switch (page) {
            case 'dashboard':
                Dashboard.load();
                break;
            case 'participants':
                Participants.load();
                break;
            case 'attendance':
                Attendance.init();
                break;
            case 'import':
                Import.init();
                break;
        }
    },

    // ---- Mobile Menu ----
    setupMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) &&
                !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    },

    // ---- Export ----
    setupExport() {
        document.getElementById('exportBtn').addEventListener('click', (e) => {
            e.preventDefault();
            window.open(API.getExportUrl(), '_blank');
            App.showToast('success', 'Export Started', 'Attendance report is being downloaded');
        });
    },

    // ---- Toast Notifications ----
    showToast(type, title, message, duration = 4000) {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: 'fas fa-check',
            error: 'fas fa-times',
            warning: 'fas fa-exclamation',
            info: 'fas fa-info'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon"><i class="${icons[type]}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));

        setTimeout(() => this.removeToast(toast), duration);
    },

    removeToast(toast) {
        if (!toast.parentElement) return;
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    },

    // ---- Modal ----
    setupModal() {
        const overlay = document.getElementById('modalOverlay');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('modalCancel');

        closeBtn.addEventListener('click', () => this.hideModal());
        cancelBtn.addEventListener('click', () => this.hideModal());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideModal();
        });
    },

    showModal(title, body, onConfirm, confirmText = 'Confirm', confirmClass = 'btn-danger') {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = body;
        
        const confirmBtn = document.getElementById('modalConfirm');
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${confirmClass}`;
        
        // Remove previous event listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.hideModal();
        });

        document.getElementById('modalOverlay').style.display = 'flex';
    },

    hideModal() {
        document.getElementById('modalOverlay').style.display = 'none';
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});