const express = require('express');
const blastManager = require('../lib/blast-manager');
const { requireAuth, requireApiKey } = require('../lib/middleware');

const router = express.Router();

// Get available modes
router.get('/modes', (req, res) => {
    const modes = {
        v1: blastManager.getModeConfig('v1'),
        v2: blastManager.getModeConfig('v2')
    };
    res.json({ success: true, modes });
});

// Get connection status
router.get('/connection-status', (req, res) => {
    const status = blastManager.getConnectionStatus();
    res.json({ success: true, ...status });
});

// Get session status
router.get('/session-status', requireAuth, (req, res) => {
    const sessions = blastManager.getUserSessionStatus(req.user.id);
    res.json({ success: true, sessions });
});

// Send blast messages
router.post('/send', requireApiKey, async (req, res) => {
    try {
        const { contacts, message, mode = 'v2', session_name = 'Blast Session' } = req.body;
        
        // Validation
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Contacts array is required and cannot be empty'
            });
        }

        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        if (!['v1', 'v2'].includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Mode must be v1 or v2'
            });
        }

        const config = blastManager.getModeConfig(mode);
        if (contacts.length > config.limits.maxPerSession) {
            return res.status(400).json({
                success: false,
                error: `Maximum ${config.limits.maxPerSession} contacts per session in ${mode} mode`
            });
        }

        const results = await blastManager.startBlastSession(
            req.user.id, mode, contacts, message, session_name
        );

        res.json({ success: true, ...results });

    } catch (error) {
        console.error('Blast send error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Stop blast session
router.post('/stop', requireAuth, (req, res) => {
    try {
        const stopped = blastManager.stopBlastSession(req.user.id);
        res.json({ 
            success: true, 
            stopped,
            message: stopped ? 'Session stopped' : 'No active session found'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
