const authManager = require('./auth-manager');
const multer = require('multer');

// Authentication middleware
const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication token required' 
            });
        }
        
        const user = await authManager.validateSession(token);
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false,
            error: 'Invalid or expired token' 
        });
    }
};

// API key authentication middleware
const requireApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;
        if (!apiKey) {
            return res.status(401).json({ 
                success: false,
                error: 'API key required' 
            });
        }
        
        const user = await authManager.validateApiKey(apiKey);
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false,
            error: 'Invalid API key' 
        });
    }
};

// Admin authorization middleware
const requireAdmin = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Admin access required' 
            });
        }
        next();
    } catch (error) {
        res.status(403).json({ 
            success: false,
            error: 'Authorization failed' 
        });
    }
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 5MB.'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
};

// CORS middleware
const corsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
};

module.exports = {
    requireAuth,
    requireApiKey,
    requireAdmin,
    errorHandler,
    corsMiddleware
};
