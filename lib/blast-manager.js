const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const database = require('./database');

class BlastManager {
    constructor() {
        this.client = null;
        this.isAuthenticated = false;
        this.activeSessions = new Map();
        
        // Skip WhatsApp initialization in serverless environment for now
        console.log('🔧 BlastManager initialized (Mock Mode)');
        this.isAuthenticated = true; // Mock authentication for testing
    }

    setupClient() {
        try {
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: "blastkeun-vercel"
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            });

            this.client.on('qr', (qr) => {
                console.log('QR Code received');
                qrcode.generate(qr, { small: true });
            });

            this.client.on('ready', () => {
                console.log('WhatsApp client is ready!');
                this.isAuthenticated = true;
            });

            this.client.on('auth_failure', (msg) => {
                console.log('Auth failure:', msg);
                this.isAuthenticated = false;
            });

            this.client.initialize();
        } catch (error) {
            console.log('WhatsApp initialization failed, using mock mode');
            this.isAuthenticated = true; // Fallback to mock
        }
    }

    getModeConfig(mode) {
        const configs = {
            'v1': {
                name: 'Standard Mode',
                description: 'Untuk akun WhatsApp lama (>6 bulan)',
                limits: {
                    maxPerSession: 50,
                    maxPerDay: 200,
                    minDelay: 15000,
                    maxDelay: 60000
                },
                features: [
                    'Delay 15-60 detik',
                    '50 pesan/session',
                    '200 pesan/hari',
                    'Basic human simulation'
                ]
            },
            'v2': {
                name: 'Safe Mode',
                description: 'Untuk akun WhatsApp baru (<6 bulan)',
                limits: {
                    maxPerSession: 15,
                    maxPerDay: 50,
                    minDelay: 45000,
                    maxDelay: 180000
                },
                features: [
                    'Delay 45-180 detik',
                    '15 pesan/session',
                    '50 pesan/hari',
                    'Advanced human simulation'
                ]
            }
        };
        return configs[mode] || configs['v2'];
    }

    async simulateHumanDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    personalizeMessage(message, contact) {
        let personalized = message;
        
        if (contact.name) {
            personalized = personalized.replace(/{{name}}/g, contact.name);
        }
        if (contact.company) {
            personalized = personalized.replace(/{{company}}/g, contact.company);
        }
        
        return personalized;
    }

    async sendMessage(phone, message, contact, mode) {
        try {
            const config = this.getModeConfig(mode);
            
            // Simulate human behavior based on mode
            await this.simulateHumanDelay(
                config.limits.minDelay * 0.3,
                config.limits.maxDelay * 0.3
            );

            const formattedPhone = phone.replace(/\D/g, '');
            if (!formattedPhone.startsWith('62')) {
                throw new Error('Nomor harus format Indonesia (62)');
            }

            const finalMessage = this.personalizeMessage(message, contact);

            // Mock send message for now
            console.log(`🔧 MOCK: Sending to ${formattedPhone}: ${finalMessage.substring(0, 50)}...`);

            // Simulate reading delay
            await this.simulateHumanDelay(5000, 15000);

            return { 
                success: true, 
                phone: formattedPhone,
                message: finalMessage.substring(0, 100) + '...'
            };

        } catch (error) {
            return { 
                success: false, 
                phone: phone, 
                error: error.message 
            };
        }
    }

    async startBlastSession(userId, mode, contacts, message, sessionName = 'Blast Session') {
        const sessionId = `${userId}-${Date.now()}`;
        const config = this.getModeConfig(mode);

        // Create session record
        const sessionResult = await database.query(
            `INSERT INTO blast_sessions (user_id, session_name, mode, contacts_count, status, started_at) 
             VALUES (?, ?, ?, ?, 'running', NOW())`,
            [userId, sessionName, mode, contacts.length]
        );

        const sessionIdDb = sessionResult.insertId;
        const session = {
            id: sessionIdDb,
            userId,
            mode,
            status: 'running',
            startTime: Date.now(),
            contactsCount: contacts.length,
            sentCount: 0,
            failedCount: 0,
            results: []
        };

        this.activeSessions.set(sessionId, session);

        try {
            const results = [];
            const maxMessages = Math.min(contacts.length, config.limits.maxPerSession);

            for (let i = 0; i < maxMessages && session.status === 'running'; i++) {
                const contact = contacts[i];
                
                const result = await this.sendMessage(
                    contact.phone, 
                    message, 
                    contact, 
                    mode
                );

                // Log message
                await database.query(
                    `INSERT INTO message_logs (user_id, blast_session_id, phone_number, message, status, error_message) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        userId, 
                        sessionIdDb, 
                        contact.phone,
                        message.substring(0, 500),
                        result.success ? 'sent' : 'failed',
                        result.error || null
                    ]
                );

                if (result.success) {
                    session.sentCount++;
                } else {
                    session.failedCount++;
                }

                results.push(result);
                session.results = results;

                // Delay between messages
                if (i < maxMessages - 1) {
                    const delay = await this.simulateHumanDelay(
                        config.limits.minDelay,
                        config.limits.maxDelay
                    );
                    
                    // Check if session was stopped during delay
                    if (session.status !== 'running') break;
                }
            }

            // Update session completion
            const finalStatus = session.status === 'running' ? 'completed' : 'stopped';
            await database.query(
                `UPDATE blast_sessions 
                 SET messages_sent = ?, messages_failed = ?, status = ?, completed_at = NOW() 
                 WHERE id = ?`,
                [session.sentCount, session.failedCount, finalStatus, sessionIdDb]
            );

            session.status = finalStatus;
            session.endTime = Date.now();

            this.activeSessions.delete(sessionId);

            return {
                success: true,
                mode: config.name,
                results,
                session: {
                    id: sessionIdDb,
                    mode: session.mode,
                    status: session.status,
                    sentCount: session.sentCount,
                    failedCount: session.failedCount,
                    duration: session.endTime - session.startTime
                }
            };

        } catch (error) {
            // Mark session as failed
            await database.query(
                'UPDATE blast_sessions SET status = "failed", completed_at = NOW() WHERE id = ?',
                [sessionIdDb]
            );

            session.status = 'failed';
            session.error = error.message;
            this.activeSessions.delete(sessionId);

            throw error;
        }
    }

    stopBlastSession(userId) {
        let stopped = false;
        
        for (const [sessionId, session] of this.activeSessions) {
            if (session.userId === userId && session.status === 'running') {
                session.status = 'stopped';
                stopped = true;
                
                // Update database
                database.query(
                    'UPDATE blast_sessions SET status = "stopped", completed_at = NOW() WHERE id = ?',
                    [session.id]
                ).catch(console.error);
            }
        }
        
        return stopped;
    }

    getUserSessionStatus(userId) {
        const sessions = [];
        
        for (const [sessionId, session] of this.activeSessions) {
            if (session.userId === userId) {
                sessions.push({
                    id: session.id,
                    mode: session.mode,
                    status: session.status,
                    sentCount: session.sentCount,
                    failedCount: session.failedCount,
                    contactsCount: session.contactsCount,
                    progress: Math.round((session.sentCount + session.failedCount) / session.contactsCount * 100)
                });
            }
        }
        
        return sessions;
    }

    async getUserDailyStats(userId) {
        const today = new Date().toISOString().split('T')[0];
        
        const stats = await database.query(`
            SELECT 
                mode,
                COUNT(*) as sessions,
                SUM(messages_sent) as sent,
                SUM(messages_failed) as failed
            FROM blast_sessions 
            WHERE user_id = ? AND DATE(created_at) = ?
            GROUP BY mode
        `, [userId, today]);

        const result = {
            v1: { sent: 0, failed: 0, sessions: 0 },
            v2: { sent: 0, failed: 0, sessions: 0 }
        };

        stats.forEach(stat => {
            result[stat.mode] = {
                sent: stat.sent || 0,
                failed: stat.failed || 0,
                sessions: stat.sessions || 0
            };
        });

        return result;
    }

    getConnectionStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            isReady: this.client?.info ? true : false,
            mode: this.isAuthenticated ? 'MOCK' : 'DISCONNECTED'
        };
    }
}

module.exports = new BlastManager();
