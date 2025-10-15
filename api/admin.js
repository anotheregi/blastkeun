const express = require('express');
const authManager = require('../lib/auth-manager');
const { requireAuth, requireAdmin } = require('../lib/middleware');

const router = express.Router();

// Apply admin middleware to all routes
router.use(requireAuth, requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const result = await authManager.getUsers(parseInt(page), parseInt(limit));
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Create new user
router.post('/users', async (req, res) => {
    try {
        const userData = req.body;
        
        // Validation
        if (!userData.username || !userData.password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        const result = await authManager.createUser(userData);
        res.json({ 
            success: true, 
            user: result 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Update user
router.put('/users/:id', async (req, res) => {
    try {
        await authManager.updateUser(req.params.id, req.body);
        res.json({ 
            success: true, 
            message: 'User updated successfully' 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        await authManager.deleteUser(req.params.id);
        res.json({ 
            success: true, 
            message: 'User deleted successfully' 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get system statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await authManager.getUserStats();
        res.json({ 
            success: true, 
            stats 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
