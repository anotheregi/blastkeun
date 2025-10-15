const express = require('express');
const cors = require('cors');
const { errorHandler, corsMiddleware } = require('../lib/middleware');

const app = express();

// Import route modules
const authRoutes = require('./auth');
const blastRoutes = require('./blast');
const adminRoutes = require('./admin');
const userRoutes = require('./user');
const uploadRoutes = require('./upload');

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const database = require('../lib/database');
        const dbTest = await database.testConnection();
        
        res.json({
            status: dbTest.success ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            database: dbTest,
            version: '2.0.0'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/blast', blastRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/debug-db', require('./debug-db'));

// Serve static files from public directory
app.use(express.static('public'));

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(require('path').join(__dirname, '../public/index.html'));
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
    });
});

const PORT = process.env.PORT || 3000;

// Start server only if not in Vercel environment
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`BLASTKEUN server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;
