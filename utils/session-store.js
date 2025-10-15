const fs = require('fs').promises;
const path = require('path');

class SessionStore {
    constructor() {
        this.sessionPath = path.join(process.cwd(), '.wwebjs_auth');
        this.sessionFile = path.join(this.sessionPath, 'session.json');
    }

    async save(session) {
        try {
            await fs.mkdir(this.sessionPath, { recursive: true });
            await fs.writeFile(this.sessionFile, JSON.stringify(session, null, 2));
            console.log('💾 WhatsApp session saved');
        } catch (error) {
            console.error('❌ Failed to save session:', error.message);
        }
    }

    async load() {
        try {
            const data = await fs.readFile(this.sessionFile, 'utf8');
            const session = JSON.parse(data);
            console.log('📂 WhatsApp session loaded');
            return session;
        } catch (error) {
            console.log('ℹ️  No saved session found');
            return null;
        }
    }

    async clear() {
        try {
            await fs.rm(this.sessionPath, { recursive: true, force: true });
            console.log('🗑️  WhatsApp session cleared');
        } catch (error) {
            console.error('❌ Failed to clear session:', error.message);
        }
    }
}

module.exports = new SessionStore();
