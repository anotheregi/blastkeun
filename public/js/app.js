class BlastKeunApp {
    constructor() {
        this.auth = new AuthManager();
        this.blastUI = null;
        this.adminUI = null;
        this.currentView = 'dashboard';
        console.log('🔧 BlastKeunApp initialized');
        this.init();
    }

    async init() {
        console.log('🔧 Starting app initialization...');
        
        // Check authentication
        const isAuthenticated = await this.auth.checkAuth();
        
        if (isAuthenticated) {
            console.log('✅ User is authenticated, showing app');
            this.showApp();
        } else {
            console.log('❌ User not authenticated, showing login');
            this.showLogin();
        }

        this.bindEvents();
        this.loadConnectionStatus();
    }

    showLogin() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }

    showApp() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        
        this.updateUserInfo();
        this.showView('dashboard');
        
        // Initialize modules
        this.blastUI = new BlastUI(this.auth);
        this.adminUI = new AdminUI(this.auth);
        
        // Show admin menu if user is admin
        if (this.auth.isAdmin()) {
            document.getElementById('adminMenu').style.display = 'block';
        }
    }

    updateUserInfo() {
        if (this.auth.currentUser) {
            document.getElementById('userName').textContent = 
                this.auth.currentUser.full_name || this.auth.currentUser.username;
            document.getElementById('userRole').textContent = this.auth.currentUser.role;
            document.getElementById('userAvatar').textContent = 
                (this.auth.currentUser.full_name || this.auth.currentUser.username).charAt(0).toUpperCase();
        }
    }

    showView(viewName) {
        this.currentView = viewName;
        
        // Hide all views
        document.querySelectorAll('.tab-content').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const targetView = document.getElementById(viewName);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        // Update page title
        document.getElementById('pageTitle').textContent = this.getViewTitle(viewName);
        
        // Update active menu item
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${viewName}`) {
                link.classList.add('active');
            }
        });
        
        // Load view-specific data
        this.loadViewData(viewName);
    }

    getViewTitle(viewName) {
        const titles = {
            'dashboard': 'Dashboard',
            'blast': 'Blast Message',
            'contacts': 'Contact Management',
            'templates': 'Message Templates',
            'api': 'API Management',
            'admin': 'Admin Panel'
        };
        return titles[viewName] || 'BLASTKEUN';
    }

    loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'blast':
                if (this.blastUI) {
                    this.blastUI.init();
                }
                break;
            case 'api':
                this.loadApiKey();
                break;
            case 'admin':
                if (this.auth.isAdmin() && this.adminUI) {
                    this.adminUI.loadUsers();
                    this.adminUI.loadSystemStats();
                }
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch(`${this.auth.apiBaseUrl}/api/user/stats`, {
                headers: this.auth.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.updateDashboard(data);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    updateDashboard(data) {
        const stats = data.stats || {};
        const dailyStats = data.dailyStats || { v1: { sent: 0, failed: 0 }, v2: { sent: 0, failed: 0 } };
        
        // Update stats cards
        document.getElementById('totalSessions').textContent = stats.total_sessions || 0;
        document.getElementById('totalMessages').textContent = stats.total_messages || 0;
        
        const successRate = stats.total_messages ? 
            Math.round((stats.successful_messages / stats.total_messages) * 100) : 0;
        document.getElementById('successRate').textContent = successRate + '%';
        
        // Calculate daily usage
        const totalToday = (dailyStats.v1.sent + dailyStats.v1.failed) + (dailyStats.v2.sent + dailyStats.v2.failed);
        const dailyLimit = this.auth.currentUser?.max_messages_per_day || 50;
        document.getElementById('dailyLimit').textContent = `${totalToday}/${dailyLimit}`;
        
        // Update mode usage
        document.getElementById('v1Today').textContent = dailyStats.v1.sent + dailyStats.v1.failed;
        document.getElementById('v2Today').textContent = dailyStats.v2.sent + dailyStats.v2.failed;
    }

    async loadConnectionStatus() {
        try {
            const response = await fetch(`${this.auth.apiBaseUrl}/api/blast/connection-status`);
            if (response.ok) {
                const data = await response.json();
                this.updateConnectionStatus(data);
            }
        } catch (error) {
            console.error('Error loading connection status:', error);
        }
    }

    updateConnectionStatus(data) {
        const statusElement = document.getElementById('statusText');
        
        if (data.isReady) {
            statusElement.innerHTML = '<span style="color: var(--success);">✅ WhatsApp Connected</span>';
        } else if (data.isAuthenticated) {
            statusElement.innerHTML = '<span style="color: var(--warning);">⏳ Connecting to WhatsApp...</span>';
        } else {
            statusElement.innerHTML = '<span style="color: var(--danger);">❌ WhatsApp Disconnected</span>';
        }
    }

    async loadApiKey() {
        if (!this.auth.currentUser?.api_key) {
            try {
                const response = await fetch(`${this.auth.apiBaseUrl}/api/user/profile`, {
                    headers: this.auth.getAuthHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.auth.currentUser.api_key = data.user.api_key;
                }
            } catch (error) {
                console.error('Error loading user profile:', error);
            }
        }
        
        if (this.auth.currentUser?.api_key) {
            document.getElementById('apiKeyDisplay').textContent = this.auth.currentUser.api_key;
        }
    }

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }

        // Navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href').startsWith('#')) {
                    e.preventDefault();
                    const viewName = link.getAttribute('href').substring(1);
                    this.showView(viewName);
                }
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // Enter key in password field
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLogin();
                }
            });
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        console.log('🔧 Handling login for:', username);

        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        const loginBtn = document.querySelector('#loginForm button');
        const originalText = loginBtn.innerHTML;
        
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        loginBtn.disabled = true;

        try {
            const result = await this.auth.login(username, password);

            if (result.success) {
                console.log('✅ Login successful, showing app');
                this.showApp();
            } else {
                alert('Login failed: ' + result.error);
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
            }
        } catch (error) {
            alert('Login error: ' + error.message);
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            this.auth.logout();
            this.showLogin();
        }
    }
}

// Global functions
function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function generateNewApiKey() {
    if (!confirm('Generate new API key? The old key will be invalidated.')) return;
    
    try {
        const app = window.blastKeunApp;
        const response = await fetch(`${app.auth.apiBaseUrl}/api/user/regenerate-api-key`, {
            method: 'POST',
            headers: app.auth.getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            app.auth.currentUser.api_key = data.api_key;
            document.getElementById('apiKeyDisplay').textContent = data.api_key;
            alert('New API key generated successfully!');
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Initialize app when DOM is loaded
let blastKeunApp;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 DOM loaded, initializing app...');
    blastKeunApp = new BlastKeunApp();
    window.blastKeunApp = blastKeunApp;
});
