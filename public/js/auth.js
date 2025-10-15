class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('blastkeun_token');
        this.apiBaseUrl = window.location.origin;
        console.log('🔧 AuthManager initialized:', this.apiBaseUrl);
    }

    async login(username, password) {
        console.log('🔧 Attempting login for:', username);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            console.log('🔧 Login response status:', response.status);

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ Server returned non-JSON response:', text.substring(0, 200));
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🔧 Login response data:', data);

            if (data.success) {
                this.authToken = data.session_token;
                this.currentUser = data.user;
                
                // Save token to localStorage
                localStorage.setItem('blastkeun_token', this.authToken);
                
                console.log('✅ Login successful:', data.user.username);
                return { success: true, user: data.user };
            } else {
                console.log('❌ Login failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('❌ Network error during login:', error);
            return { success: false, error: 'Network error: ' + error.message };
        }
    }

    async checkAuth() {
        if (!this.authToken) {
            console.log('🔧 No auth token found');
            return false;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            console.log('🔧 Auth check status:', response.status);

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                console.log('✅ Auth check successful:', data.user.username);
                return true;
            } else {
                console.log('❌ Auth check failed');
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('❌ Auth check error:', error);
            this.logout();
            return false;
        }
    }

    logout() {
        console.log('🔧 Logging out...');
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem('blastkeun_token');
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    getApiKeyHeaders() {
        if (!this.currentUser?.api_key) {
            throw new Error('API key not available');
        }
        return {
            'X-API-Key': this.currentUser.api_key,
            'Content-Type': 'application/json'
        };
    }

    isAdmin() {
        return this.currentUser?.role === 'admin';
    }
}
