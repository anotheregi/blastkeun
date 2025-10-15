const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const database = require('./database');

class AuthManager {
    async createUser(userData) {
        const { username, password, email, full_name, role = 'user', max_messages_per_day = 50, max_contacts_per_session = 15 } = userData;
        
        const password_hash = await bcrypt.hash(password, 10);
        const api_key = crypto.randomBytes(32).toString('hex');
        
        const result = await database.query(
            `INSERT INTO users (username, password_hash, email, full_name, role, api_key, max_messages_per_day, max_contacts_per_session) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, password_hash, email, full_name, role, api_key, max_messages_per_day, max_contacts_per_session]
        );
        
        return { id: result.insertId, api_key };
    }

    async authenticateUser(username, password) {
        try {
            console.log('🔧 Authenticating user:', username);

            // Ensure database is initialized
            if (!database.pool) {
                console.log('⚡ Database not initialized, initializing...');
                await database.init();
            }

            const users = await database.query(
                'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
                [username]
            );

            if (users.length === 0) {
                console.log('❌ User not found:', username);
                throw new Error('User tidak ditemukan');
            }

            const user = users[0];
            console.log('✅ User found, verifying password');

            const isValid = await bcrypt.compare(password, user.password_hash);

            if (!isValid) {
                console.log('❌ Invalid password for user:', username);
                throw new Error('Password salah');
            }

            console.log('✅ Password valid, creating session');

            // Create session
            const session_token = crypto.randomBytes(64).toString('hex');
            const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await database.query(
                'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
                [user.id, session_token, expires_at]
            );

            console.log('✅ Session created successfully');

            return {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    max_messages_per_day: user.max_messages_per_day,
                    max_contacts_per_session: user.max_contacts_per_session,
                    created_at: user.created_at
                },
                session_token
            };
        } catch (error) {
            console.error('❌ Authentication error:', error.message);
            console.error('Error code:', error.code);
            console.error('Error errno:', error.errno);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    async validateSession(token) {
        const sessions = await database.query(
            `SELECT us.*, u.* FROM user_sessions us 
             JOIN users u ON us.user_id = u.id 
             WHERE us.session_token = ? AND us.expires_at > NOW() AND u.is_active = TRUE`,
            [token]
        );
        
        if (sessions.length === 0) {
            throw new Error('Session tidak valid');
        }
        
        const session = sessions[0];
        return {
            id: session.user_id,
            username: session.username,
            email: session.email,
            full_name: session.full_name,
            role: session.role,
            max_messages_per_day: session.max_messages_per_day,
            max_contacts_per_session: session.max_contacts_per_session
        };
    }

    async validateApiKey(apiKey) {
        const users = await database.query(
            'SELECT * FROM users WHERE api_key = ? AND is_active = TRUE',
            [apiKey]
        );
        
        if (users.length === 0) {
            throw new Error('API key tidak valid');
        }
        
        const user = users[0];
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            max_messages_per_day: user.max_messages_per_day,
            max_contacts_per_session: user.max_contacts_per_session,
            api_key: user.api_key
        };
    }

    async getUsers(page = 1, limit = 10) {
        const offset = (page - 1) * limit;

        // Use template literal for LIMIT/OFFSET since MySQL2 doesn't support parameterized LIMIT
        const users = await database.query(
            `SELECT id, username, email, full_name, role, is_active, max_messages_per_day, max_contacts_per_session, created_at FROM users ORDER BY id LIMIT ${limit} OFFSET ${offset}`
        );

        const totalResult = await database.query('SELECT COUNT(*) as count FROM users');
        const total = Array.isArray(totalResult) && totalResult.length > 0 ? totalResult[0].count : 0;

        return { users, total };
    }

    async updateUser(userId, updateData) {
        const allowedFields = ['email', 'full_name', 'role', 'is_active', 'max_messages_per_day', 'max_contacts_per_session'];
        const updates = [];
        const values = [];
        
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });
        
        if (updates.length === 0) {
            throw new Error('Tidak ada field yang valid untuk diupdate');
        }
        
        values.push(userId);
        
        await database.query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );
    }

    async deleteUser(userId) {
        await database.query('DELETE FROM users WHERE id = ? AND role != "admin"', [userId]);
    }

    async getUserStats(userId = null) {
        let query = `
            SELECT 
                u.id,
                u.username,
                COUNT(DISTINCT bs.id) as total_sessions,
                COUNT(ml.id) as total_messages,
                SUM(CASE WHEN ml.status = 'sent' THEN 1 ELSE 0 END) as successful_messages,
                SUM(CASE WHEN ml.status = 'failed' THEN 1 ELSE 0 END) as failed_messages
            FROM users u
            LEFT JOIN blast_sessions bs ON u.id = bs.user_id
            LEFT JOIN message_logs ml ON u.id = ml.user_id
        `;
        
        const params = [];
        if (userId) {
            query += ' WHERE u.id = ?';
            params.push(userId);
        }
        
        query += ' GROUP BY u.id';
        
        const stats = await database.query(query, params);
        return stats;
    }

    async regenerateApiKey(userId) {
        const newApiKey = crypto.randomBytes(32).toString('hex');
        await database.query(
            'UPDATE users SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newApiKey, userId]
        );
        return newApiKey;
    }
}

module.exports = new AuthManager();
