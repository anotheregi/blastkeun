const express = require('express');
const authManager = require('../lib/auth-manager');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        console.log('🔧 Login attempt received');
        
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('❌ Missing username or password');
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        console.log('🔧 Attempting authentication for:', username);
        
        const result = await authManager.authenticateUser(username, password);
        
        console.log('✅ Login successful for:', username);
        res.json({ 
            success: true, 
            user: result.user,
            session_token: result.session_token
        });
        
    } catch (error) {
        console.error('❌ Login error:', error.message);
        console.error('Error code:', error.code);
        console.error('Error errno:', error.errno);
        console.error('Error stack:', error.stack);

        // Return 500 for internal server errors, 401 for auth failures
        const statusCode = error.message.includes('Internal server error') || error.code ? 500 : 401;

        res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
});

// Export router
module.exports = router;
