module.exports = async (req, res) => {
    console.log('🔧 Test endpoint hit');
    
    res.json({
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: {
            host: process.env.MYSQLHOST ? '***' : 'NOT SET',
            user: process.env.MYSQLUSER ? '***' : 'NOT SET'
        }
    });
};
