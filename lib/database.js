const mysql = require('mysql2/promise');

class Database {
    constructor() {
        this.pool = null;
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Starting database initialization...');
            const config = this.getDbConfig();
            console.log('🔧 Database Configuration:', {
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                ssl: config.ssl ? 'ENABLED' : 'DISABLED'
            });

            if (!config.host || !config.user || !config.password) {
                console.error('❌ Missing database configuration. Please check environment variables.');
                this.pool = null; // Ensure pool is null on failure
                return; // Don't throw, just log and continue
            }

            console.log('🔌 Creating database pool...');
            this.pool = mysql.createPool(config);
            console.log('✅ Database pool created successfully');

            // Test connection
            console.log('🧪 Testing database connection...');
            const testResult = await this.testConnection();
            if (!testResult.success) {
                console.error('❌ Database connection test failed:', testResult.error);
                this.pool = null; // Ensure pool is null on failure
                return; // Don't throw, just log and continue
            }
            console.log('✅ Database connection test passed');

            // Initialize tables
            console.log('📋 Initializing database tables...');
            await this.initDatabase();
            console.log('✅ Database initialization completed successfully');

        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            console.error('Error stack:', error.stack);
            this.pool = null; // Ensure pool is null on failure
        }
    }

    getDbConfig() {
        // Check for Railway external database URL first (most reliable for Railway)
        if (process.env.DATABASE_URL) {
            const url = new URL(process.env.DATABASE_URL);
            return {
                host: url.hostname,
                user: url.username,
                password: url.password,
                database: url.pathname.substring(1), // Remove leading slash
                port: parseInt(url.port) || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                connectTimeout: 30000,
                ssl: { rejectUnauthorized: false }
            };
        }

        // Fallback to individual Railway environment variables
        let config = {
            host: process.env.MYSQLHOST || process.env.DB_HOST,
            user: process.env.MYSQLUSER || process.env.DB_USER,
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
            database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
            port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306'),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 30000
        };

        // Check if using external Railway database (not internal)
        const isExternalRailway = config.host && (config.host.includes('railway.app') || config.host.includes('containers-us-west') || config.host.includes('shinkansen.proxy.rlwy.net'));
        const isProduction = process.env.NODE_ENV === 'production';

        if (isProduction && isExternalRailway) {
            config.ssl = { rejectUnauthorized: false };
        }

        return config;
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            
            // Test query
            const [result] = await connection.execute('SELECT 1 as test_value, NOW() as db_time');
            console.log('✅ Database connected successfully!', result[0]);
            
            connection.release();
            return { success: true, message: 'Database connected', data: result[0] };
            
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            console.error('Error code:', error.code);
            console.error('Error errno:', error.errno);
            console.error('Connection details:', this.getDbConfig());
            return { success: false, error: error.message, code: error.code };
        }
    }

    async query(sql, params = []) {
        if (!this.pool) {
            throw new Error('Database pool not initialized. Check database connection.');
        }

        try {
            const [results] = await this.pool.execute(sql, params);
            return results;
        } catch (error) {
            console.error('❌ Database query error:', error.message);
            console.error('Error code:', error.code);
            console.error('Error errno:', error.errno);
            console.error('Query:', sql.substring(0, 200));
            throw error;
        }
    }

    async initDatabase() {
        try {
            console.log('🔄 Initializing database tables...');

            // Check if tables already exist first
            const [existingTables] = await this.query('SHOW TABLES');
            const tableNames = Array.isArray(existingTables) ? existingTables.map(row => Object.values(row)[0]) : [];

            console.log('📋 Existing tables:', tableNames);

            const tables = [
                {
                    name: 'users',
                    sql: `CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        email VARCHAR(100),
                        full_name VARCHAR(100),
                        role ENUM('admin', 'user') DEFAULT 'user',
                        api_key VARCHAR(64) UNIQUE,
                        is_active BOOLEAN DEFAULT TRUE,
                        max_messages_per_day INT DEFAULT 50,
                        max_contacts_per_session INT DEFAULT 15,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )`
                },
                {
                    name: 'user_sessions',
                    sql: `CREATE TABLE IF NOT EXISTS user_sessions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT,
                        session_token VARCHAR(128) UNIQUE NOT NULL,
                        ip_address VARCHAR(45),
                        user_agent TEXT,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`
                },
                {
                    name: 'blast_sessions',
                    sql: `CREATE TABLE IF NOT EXISTS blast_sessions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT,
                        session_name VARCHAR(100),
                        mode ENUM('v1', 'v2') DEFAULT 'v2',
                        contacts_count INT,
                        messages_sent INT,
                        messages_failed INT,
                        status ENUM('pending', 'running', 'completed', 'failed', 'stopped'),
                        started_at TIMESTAMP NULL,
                        completed_at TIMESTAMP NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`
                },
                {
                    name: 'message_logs',
                    sql: `CREATE TABLE IF NOT EXISTS message_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT,
                        blast_session_id INT,
                        phone_number VARCHAR(20),
                        message TEXT,
                        status ENUM('sent', 'failed'),
                        error_message TEXT,
                        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (blast_session_id) REFERENCES blast_sessions(id) ON DELETE CASCADE
                    )`
                }
            ];

            // Create tables one by one with error handling
            for (const table of tables) {
                try {
                    if (!tableNames.includes(table.name)) {
                        console.log(`📝 Creating table: ${table.name}`);
                        await this.query(table.sql);
                        console.log(`✅ Table ${table.name} created successfully`);
                    } else {
                        console.log(`⏭️  Table ${table.name} already exists, skipping`);
                    }
                } catch (tableError) {
                    console.error(`❌ Failed to create table ${table.name}:`, tableError.message);
                    // Continue with other tables
                }
            }

            // Create admin user if not exists
            try {
                const existingUsers = await this.query('SELECT id FROM users WHERE username = ?', ['admin']);
                const userCount = Array.isArray(existingUsers) ? existingUsers.length : 0;
                if (userCount === 0) {
                    console.log('👤 Creating default admin user...');
                    const bcrypt = require('bcryptjs');
                    const passwordHash = await bcrypt.hash('admin123', 10);
                    const crypto = require('crypto');
                    const apiKey = crypto.randomBytes(32).toString('hex');

                    await this.query(
                        `INSERT INTO users (username, password_hash, email, full_name, role, api_key, max_messages_per_day, max_contacts_per_session)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        ['admin', passwordHash, 'admin@blastkeun.com', 'Administrator', 'admin', apiKey, 1000, 100]
                    );
                    console.log('✅ Default admin user created');
                } else {
                    console.log('⏭️  Admin user already exists, skipping');
                }
            } catch (userError) {
                console.error('❌ Failed to create admin user:', userError.message);
                // Don't fail completely if admin user creation fails
            }

            console.log('✅ Database initialization completed');

        } catch (error) {
            console.error('❌ Database initialization error:', error.message);
            console.error('Error details:', error);
            // Don't set pool to null here, let the connection work even if initialization fails
        }
    }

    async getConnection() {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }
        return await this.pool.getConnection();
    }
}

module.exports = new Database();
