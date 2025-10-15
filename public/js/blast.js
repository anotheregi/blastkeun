class BlastUI {
    constructor(authManager) {
        this.auth = authManager;
        this.selectedMode = 'v2';
        this.contacts = [];
        this.currentSession = null;
        this.modeConfigs = null;
    }

    async init() {
        await this.loadModeConfigs();
        this.selectMode('v2');
        this.bindEvents();
        this.updateUI();
    }

    async loadModeConfigs() {
        try {
            const response = await fetch(`${this.auth.apiBaseUrl}/api/blast/modes`);
            if (response.ok) {
                const data = await response.json();
                this.modeConfigs = data.modes;
                this.updateModeDisplays();
            }
        } catch (error) {
            console.error('Error loading mode configs:', error);
        }
    }

    selectMode(mode) {
        this.selectedMode = mode;
        
        // Update UI selection
        document.querySelectorAll('.mode-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`[data-mode="${mode}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        this.showModeInfo(mode);
        this.updateSendButton();
    }

    showModeInfo(mode) {
        const config = this.modeConfigs?.[mode];
        if (!config) return;
        
        const infoContent = document.getElementById('modeInfoContent');
        infoContent.innerHTML = `
            <strong>${config.name}</strong> - ${config.description}
            <br><small>
            <strong>Limits:</strong> ${config.limits.maxPerSession} pesan/session, 
            ${config.limits.maxPerDay} pesan/hari
            <br><strong>Delay:</strong> ${config.limits.minDelay/1000}-${config.limits.maxDelay/1000} detik
            </small>
        `;
    }

    updateModeDisplays() {
        if (!this.modeConfigs) return;
        
        Object.keys(this.modeConfigs).forEach(mode => {
            const todayElement = document.getElementById(`${mode}Today`);
            if (todayElement) {
                todayElement.textContent = '0';
            }
        });
    }

    updateSendButton() {
        const btn = document.getElementById('startBlastBtn');
        const config = this.modeConfigs?.[this.selectedMode];
        
        if (!config) {
            btn.disabled = true;
            return;
        }

        const canSend = this.contacts.length > 0 && 
                       this.contacts.length <= config.limits.maxPerSession;
        
        btn.disabled = !canSend;
        
        if (this.contacts.length > 0) {
            btn.innerHTML = `
                <i class="fas fa-play"></i> 
                Mulai Blast (${this.contacts.length}/${config.limits.maxPerSession} pesan)
            `;
        } else {
            btn.innerHTML = `<i class="fas fa-play"></i> Mulai Blast Session`;
        }
    }

    bindEvents() {
        // File upload
        document.getElementById('contactsFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Message template change
        document.getElementById('messageTemplate').addEventListener('input', () => {
            this.updateSendButton();
        });
    }

    async handleFileUpload(file) {
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.auth.apiBaseUrl}/api/upload/contacts`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.contacts = data.contacts;
                this.displayContacts();
                this.updateSendButton();
                this.addToLog(`Loaded ${data.contacts.length} contacts from file`);
            } else {
                alert('Error: ' + data.message);
            }

        } catch (error) {
            alert('Error uploading file: ' + error.message);
        }
    }

    displayContacts() {
        const contactList = document.getElementById('contactList');
        const config = this.modeConfigs?.[this.selectedMode];
        
        if (this.contacts.length === 0) {
            contactList.innerHTML = '<div class="text-muted">Belum ada kontak</div>';
            return;
        }

        let html = '';
        const displayCount = Math.min(this.contacts.length, 10);
        
        for (let i = 0; i < displayCount; i++) {
            const contact = this.contacts[i];
            html += `
                <div style="padding: 8px; border-bottom: 1px solid #eee;">
                    <strong>${contact.name || 'No Name'}</strong>
                    <br><small>${contact.phone}</small>
                    ${contact.company ? `<br><small><i>${contact.company}</i></small>` : ''}
                </div>
            `;
        }

        if (this.contacts.length > 10) {
            html += `
                <div style="padding: 10px; text-align: center; background: #f8f9fa;">
                    <small class="text-muted">... dan ${this.contacts.length - 10} kontak lainnya</small>
                </div>
            `;
        }

        contactList.innerHTML = html;
    }

    async startBlastSession() {
        if (this.contacts.length === 0) {
            alert('Harap upload kontak terlebih dahulu');
            return;
        }

        const message = document.getElementById('messageTemplate').value.trim();
        if (!message) {
            alert('Harap isi pesan template');
            return;
        }

        const config = this.modeConfigs[this.selectedMode];
        const contactsToSend = this.contacts.slice(0, config.limits.maxPerSession);

        // Confirmation dialog
        const confirmed = confirm(`
            Mulai Blast Session?

Mode: ${config.name}
Jumlah Kontak: ${contactsToSend.length}
Estimasi Waktu: ${Math.ceil(contactsToSend.length * config.limits.minDelay / 60000)} menit

Lanjutkan?
        `);

        if (!confirmed) return;

        try {
            this.showSessionProgress();
            this.addToLog(`Starting ${config.name} session with ${contactsToSend.length} contacts...`);

            const response = await fetch(`${this.auth.apiBaseUrl}/api/blast/send`, {
                method: 'POST',
                headers: this.auth.getApiKeyHeaders(),
                body: JSON.stringify({
                    contacts: contactsToSend,
                    message: message,
                    mode: this.selectedMode,
                    session_name: `${config.name} - ${new Date().toLocaleString()}`
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentSession = data.session;
                this.addToLog(`Session started successfully! Session ID: ${data.session.id}`);
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            this.addToLog(`Error starting session: ${error.message}`, 'error');
            alert('Error starting blast session: ' + error.message);
            this.hideSessionProgress();
        }
    }

    async stopBlastSession() {
        try {
            const response = await fetch(`${this.auth.apiBaseUrl}/api/blast/stop`, {
                method: 'POST',
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();
            
            if (data.success) {
                this.addToLog('Session stopped by user');
                this.hideSessionProgress();
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            alert('Error stopping session: ' + error.message);
        }
    }

    async testBlastMessage() {
        const message = document.getElementById('messageTemplate').value.trim();
        if (!message) {
            alert('Harap isi pesan template terlebih dahulu');
            return;
        }

        const testPhone = prompt('Masukkan nomor WhatsApp untuk test (format: 6281234567890):');
        if (!testPhone) return;

        // Validate phone number
        const cleanPhone = testPhone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('62')) {
            alert('Nomor harus format Indonesia (62...)');
            return;
        }

        try {
            this.addToLog(`Sending test message to ${cleanPhone}...`);

            const response = await fetch(`${this.auth.apiBaseUrl}/api/blast/send`, {
                method: 'POST',
                headers: this.auth.getApiKeyHeaders(),
                body: JSON.stringify({
                    contacts: [{ phone: cleanPhone, name: 'Test User' }],
                    message: message,
                    mode: this.selectedMode,
                    session_name: 'Test Message'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.addToLog('Test message sent successfully!');
                alert('Pesan test berhasil dikirim!');
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            this.addToLog(`Error sending test message: ${error.message}`, 'error');
            alert('Error sending test message: ' + error.message);
        }
    }

    showSessionProgress() {
        document.getElementById('sessionProgress').style.display = 'block';
        document.getElementById('sessionLog').style.display = 'block';
        document.getElementById('startBlastBtn').style.display = 'none';
        document.getElementById('stopBlastBtn').style.display = 'inline-block';
    }

    hideSessionProgress() {
        document.getElementById('sessionProgress').style.display = 'none';
        document.getElementById('startBlastBtn').style.display = 'inline-block';
        document.getElementById('stopBlastBtn').style.display = 'none';
    }

    addToLog(message, type = 'info') {
        const logContent = document.getElementById('logContent');
        const timestamp = new Date().toLocaleTimeString();
        const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        
        logContent.innerHTML += `
            <div style="margin-bottom: 5px;">
                [${timestamp}] ${icon} ${message}
            </div>
        `;
        
        logContent.scrollTop = logContent.scrollHeight;
    }

    updateUI() {
        this.updateSendButton();
        this.displayContacts();
    }
}

// Global functions for mode selection
function selectMode(mode) {
    if (window.blastKeunApp && window.blastKeunApp.blastUI) {
        window.blastKeunApp.blastUI.selectMode(mode);
    }
}

function startBlastSession() {
    if (window.blastKeunApp && window.blastKeunApp.blastUI) {
        window.blastKeunApp.blastUI.startBlastSession();
    }
}

function stopBlastSession() {
    if (window.blastKeunApp && window.blastKeunApp.blastUI) {
        window.blastKeunApp.blastUI.stopBlastSession();
    }
}

function testBlastMessage() {
    if (window.blastKeunApp && window.blastKeunApp.blastUI) {
        window.blastKeunApp.blastUI.testBlastMessage();
    }
}
