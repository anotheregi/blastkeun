const mysql = require('mysql2/promise');
const database = require('../lib/database');

module.exports = async (req, res) => {
    try {
        const envVars = {
            DATABASE_URL: process.env.DATABASE_URL ? '***' : 'NOT SET',
            MYSQLHOST: process.env.MYSQLHOST ? '***' : 'NOT SET',
            MYSQLUSER: process.env.MYSQLUSER ? '***' : 'NOT SET',
            MYSQLDATABASE: process.env.MYSQLDATABASE || 'NOT SET',
            MYSQLPORT: process.env.MYSQLPORT || 'NOT SET',
            NODE_ENV: process.env.NODE_ENV || 'development'
        };

        // Test direct connection
        let directResult;
        if (process.env.DATABASE_URL) {
            try {
                const url = new URL(process.env.DATABASE_URL);
                const directConfig = {
                    host: url.hostname,
                    user: url.username,
                    password: url.password,
                    database: url.pathname.substring(1),
                    port: parseInt(url.port) || 3306,
                    ssl: { rejectUnauthorized: false },
                    connectTimeout: 30000
                };

                const directConn = await mysql.createConnection(directConfig);
                const [rows] = await directConn.execute('SELECT 1 as test, NOW() as time, VERSION() as version');
                directResult = {
                    success: true,
                    data: rows,
                    message: 'Direct connection successful (DATABASE_URL)'
                };
                await directConn.end();
            } catch (directError) {
                directResult = {
                    success: false,
                    error: directError.message,
                    code: directError.code
                };
            }
        } else if (process.env.MYSQLHOST && process.env.MYSQLUSER) {
            try {
                const directConfig = {
                    host: process.env.MYSQLHOST,
                    user: process.env.MYSQLUSER,
                    password: process.env.MYSQLPASSWORD,
                    database: process.env.MYSQLDATABASE,
                    port: process.env.MYSQLPORT || 3306,
                    ssl: process.env.NODE_ENV === 'production' && (process.env.MYSQLHOST.includes('railway.app') || process.env.MYSQLHOST.includes('containers-us-west') || process.env.MYSQLHOST.includes('shinkansen.proxy.rlwy.net')) ? { rejectUnauthorized: false } : false,
                    connectTimeout: 30000
                };

                const directConn = await mysql.createConnection(directConfig);
                const [rows] = await directConn.execute('SELECT 1 as test, NOW() as time, VERSION() as version');
                directResult = {
                    success: true,
                    data: rows,
                    message: 'Direct connection successful (individual vars)'
                };
                await directConn.end();
            } catch (directError) {
                directResult = {
                    success: false,
                    error: directError.message,
                    code: directError.code
                };
            }
        } else {
            directResult = { success: false, error: 'Missing environment variables (DATABASE_URL or MYSQLHOST/MYSQLUSER)' };
        }

        // Test through database class
        let dbResult;
        try {
            console.log('🔍 Testing database class connection...');
            console.log('Database pool status:', database.pool ? 'initialized' : 'null');

            if (!database.pool) {
                // Force initialization if not done
                console.log('⚡ Forcing database initialization...');
                await database.init();
                console.log('Database pool after init:', database.pool ? 'initialized' : 'null');
            }

            const [rows] = await database.query('SELECT 1 as test, NOW() as time');
            dbResult = {
                success: true,
                data: rows,
                message: 'Database class connection successful'
            };
            console.log('✅ Database class test successful');
        } catch (dbError) {
            console.error('❌ Database class test failed:', dbError.message);
            dbResult = {
                success: false,
                error: dbError.message,
                code: dbError.code
            };
        }

        res.json({
            environment: envVars,
            directConnection: directResult,
            databaseClass: dbResult,
            timestamp: new Date().toISOString(),
            region: process.env.VERCEL_REGION || 'unknown'
        });

    } catch (error) {
        res.status(500).json({
            error: error.message,
            environment: {
                MYSQLHOST: process.env.MYSQLHOST ? '***' : 'NOT SET',
                MYSQLUSER: process.env.MYSQLUSER ? '***' : 'NOT SET',
                MYSQLDATABASE: process.env.MYSQLDATABASE || 'NOT SET'
            },
            timestamp: new Date().toISOString()
        });
    }
};
