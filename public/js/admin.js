class AdminUI {
    constructor(authManager) {
        this.auth = authManager;
    }

    async loadUsers() {
        try {
            const response = await fetch(`${this.auth.apiBaseUrl}/api/admin/users`, {
                headers: this.auth.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.renderUsersTable(data.users);
            } else {
                throw new Error('Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsersTable(users) {
        const tbody = document.querySelector('#usersTable tbody');
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px;">
                        No users found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <strong>${user.username}</strong>
                    ${user.full_name ? `<br><small>${user.full_name}</small>` : ''}
                </td>
                <td>${user.email || '-'}</td>
                <td>
                    <span class="badge" style="background: ${user.role === 'admin' ? '#dc3545' : '#007bff'}; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8em;">
                        ${user.role}
                    </span>
                </td>
                <td>
                    <span class="badge" style="background: ${user.is_active ? '#28a745' : '#6c757d'}; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8em;">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <small>
                        ${user.max_messages_per_day}/day<br>
                        ${user.max_contacts_per_session}/session
                    </small>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminEditUser(${user.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${user.role !== 'admin' ? `
                        <button class="btn btn-sm btn-danger" onclick="adminDeleteUser(${user.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    async loadSystemStats() {
        try {
            const response = await fetch(`${this.auth.apiBaseUrl}/api/admin/stats`, {
                headers: this.auth.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.renderSystemStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading system stats:', error);
        }
    }

    renderSystemStats(stats) {
        const totalUsers = stats.length || 0;
        const totalSessions = stats.reduce((sum, stat) => sum + (stat.total_sessions || 0), 0);
        const totalMessages = stats.reduce((sum, stat) => sum + (stat.total_messages || 0), 0);

        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalBlastSessions').textContent = totalSessions;
        document.getElementById('totalMessagesSent').textContent = totalMessages;
    }
}

// Global admin functions
function adminEditUser(userId) {
    alert('Edit user functionality would open a modal for user ID: ' + userId);
}

async function adminDeleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }

    try {
        const app = window.blastKeunApp;
        const response = await fetch(`${app.auth.apiBaseUrl}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: app.auth.getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            alert('User deleted successfully!');
            // Reload users list
            if (app.adminUI) {
                app.adminUI.loadUsers();
            }
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Handle add user form submission
document.addEventListener('DOMContentLoaded', () => {
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(addUserForm);
            const userData = {
                username: formData.get('username'),
                password: formData.get('password'),
                email: formData.get('email'),
                full_name: formData.get('full_name'),
                role: formData.get('role'),
                max_messages_per_day: parseInt(formData.get('max_messages_per_day')) || 50,
                max_contacts_per_session: parseInt(formData.get('max_contacts_per_session')) || 15
            };

            // Validation
            if (!userData.username || !userData.password) {
                alert('Username and password are required');
                return;
            }

            try {
                const app = window.blastKeunApp;
                const response = await fetch(`${app.auth.apiBaseUrl}/api/admin/users`, {
                    method: 'POST',
                    headers: app.auth.getAuthHeaders(),
                    body: JSON.stringify(userData)
                });

                const data = await response.json();

                if (data.success) {
                    alert('User created successfully!');
                    closeModal('addUserModal');
                    addUserForm.reset();

                    // Reload users list
                    if (app.adminUI) {
                        app.adminUI.loadUsers();
                    }
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    }
});
