const express = require('express');
const authManager = require('../lib/auth-manager');
const blastManager = require('../lib/blast-manager');
const { requireAuth } = require('../lib/middleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Get user profile
router.get('/profile', (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
});

// Get user statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await authManager.getUserStats(req.user.id);
        const dailyStats = await blastManager.getUserDailyStats(req.user.id);
        
        res.json({ 
            success: true, 
            stats: stats[0] || {}, 
            dailyStats 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
