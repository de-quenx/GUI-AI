class GuiAiBeta {
    constructor() {
        this.security = new SecurityManager();
        
        if (!this.security.validateOrigin()) {
            alert('Akses tidak diizinkan dari domain ini');
            return;
        }
        
        this.apis = [];
        this.selectedModel = null;
        this.currentConversation = [];
        this.sessionId = this.generateSessionId();
        this.currentTheme = localStorage.getItem('gui-ai-theme') || 'light';
        
        this.init();
    }

    async init() {
        this.apis = await this.loadFromStorage();
        this.initTheme();
        this.bindEvents();
        this.renderApiList();
        this.loadAvailableModels();
    }

    initTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        this.updateActiveThemeButton();
    }

    updateActiveThemeButton() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === this.currentTheme) {
                btn.classList.add('active');
            }
        });
    }

    changeTheme(theme) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('gui-ai-theme', theme);
        this.updateActiveThemeButton();
        this.showNotification(`Tema ${theme} diaktifkan`, 'success');
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    bindEvents() {
        document.getElementById('apiForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addApi();
        });

        document.getElementById('toggleKey').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        document.getElementById('sendMessage').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('clearChat').addEventListener('click', () => {
            this.clearChat();
        });

        document.getElementById('selectedModel').addEventListener('change', (e) => {
            if (e.target.value) {
                const [apiId, modelId] = e.target.value.split(':');
                const api = this.apis.find(a => a.id === apiId);
                const models = this.getAvailableModels(api);
                const model = models.find(m => m.id === modelId);
                this.selectModelFromDropdown(apiId, model);
            }
        });

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.changeTheme(btn.dataset.theme);
            });
        });
    }

    detectApiProvider(apiKey) {
        const patterns = {
            'openai': {
                pattern: /^sk-[a-zA-Z0-9-_]{20,}$/,
                name: 'OpenAI',
                icon: 'fa-brain'
            },
            'anthropic': {
                pattern: /^sk-ant-[a-zA-Z0-9-_]{95}$/,
                name: 'Anthropic',
                icon: 'fa-robot'
            },
            'google': {
                pattern: /^[a-zA-Z0-9-_]{39}$/,
                name: 'Google',
                icon: 'fa-search'
            },
            'agentrouter': {
                pattern: /^[a-zA-Z0-9-_]{32,}$/,
                name: 'AgentRouter',
                icon: 'fa-route'
            }
        };

        for (const [provider, config] of Object.entries(patterns)) {
            if (config.pattern.test(apiKey)) {
                return { provider, name: config.name, icon: config.icon };
            }
        }

        return { provider: 'unknown', name: 'Unknown Provider', icon: 'fa-question' };
    }

    getAvailableModels(api) {
        const modelConfigs = {
            'openai': [
                { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model for complex reasoning tasks' },
                { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', description: 'Latest GPT-4 with improved performance' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient for most tasks' }
            ],
            'anthropic': [
                { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most intelligent Claude model' },
                { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance and speed' },
                { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and lightweight responses' }
            ],
            'google': [
                { id: 'gemini-pro', name: 'Gemini Pro', description: 'Advanced reasoning and multimodal capabilities' },
                { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Text and image understanding' }
            ],
            'agentrouter': [
                { id: 'gpt-4', name: 'GPT-4 via AgentRouter', description: 'OpenAI GPT-4 through AgentRouter' },
                { id: 'claude-3-opus', name: 'Claude 3 Opus via AgentRouter', description: 'Anthropic Claude through AgentRouter' },
                { id: 'gemini-pro', name: 'Gemini Pro via AgentRouter', description: 'Google Gemini through AgentRouter' }
            ]
        };

        return modelConfigs[api.provider] || [
            { id: 'custom-model', name: 'Custom Model', description: 'Custom AI model endpoint' }
        ];
    }

    validateApiKey(key) {
        const patterns = [
            /^sk-[a-zA-Z0-9-_]{20,}$/,
            /^sk-ant-[a-zA-Z0-9-_]{95}$/,
            /^[a-zA-Z0-9-_]{32,}$/
        ];
        
        return patterns.some(pattern => pattern.test(key));
    }

    addApi() {
        if (this.security.checkForSuspiciousActivity()) {
            this.showNotification('Terlalu banyak request, coba lagi nanti', 'error');
            return;
        }

        const name = this.security.sanitizeInput(document.getElementById('apiName').value);
        const key = this.security.sanitizeInput(document.getElementById('apiKey').value);
        const url = this.security.sanitizeInput(document.getElementById('apiUrl').value) || 'https://agentrouter.org';
        const description = this.security.sanitizeInput(document.getElementById('apiDescription').value);

        if (!this.validateApiKey(key)) {
            this.showNotification('Format API key tidak valid', 'error');
            return;
        }

        const detected = this.detectApiProvider(key);

        const api = {
            id: Date.now().toString(),
            name,
            key,
            url,
            description,
            provider: detected.provider,
            providerName: detected.name,
            providerIcon: detected.icon,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            sessionId: this.sessionId,
            connectionStatus: 'inactive'
        };

        this.apis.push(api);
        this.saveToStorage();
        this.renderApiList();
        this.loadAvailableModels();
        this.clearForm();
        this.showNotification(`${detected.name} API berhasil ditambahkan`, 'success');
    }

    deleteApi(id) {
        if (confirm('Hapus API ini?')) {
            this.apis = this.apis.filter(api => api.id !== id);
            this.saveToStorage();
            this.renderApiList();
            this.loadAvailableModels();
            this.showNotification('API berhasil dihapus', 'success');
        }
    }

    copyApiKey(key) {
        navigator.clipboard.writeText(key).then(() => {
            this.showNotification('API Key disalin ke clipboard', 'success');
        }).catch(() => {
            this.showNotification('Gagal menyalin API Key', 'error');
        });
    }

    togglePasswordVisibility() {
        const keyInput = document.getElementById('apiKey');
        const toggleBtn = document.getElementById('toggleKey');
        const icon = toggleBtn.querySelector('i');

        if (keyInput.type === 'password') {
            keyInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            keyInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    loadAvailableModels() {
        const modelCard = document.getElementById('modelSelectionCard');
        const chatCard = document.getElementById('chatCard');
        const modelsList = document.getElementById('modelsList');
        const modelSelect = document.getElementById('selectedModel');

        if (this.apis.length === 0) {
            modelCard.style.display = 'none';
            chatCard.style.display = 'none';
            return;
        }

        modelCard.style.display = 'block';
        chatCard.style.display = 'block';
        modelsList.innerHTML = '';
        modelSelect.innerHTML = '<option value="">Pilih Model AI</option>';

        this.apis.forEach(api => {
            const models = this.getAvailableModels(api);
            
            models.forEach(model => {
                const modelItem = document.createElement('div');
                modelItem.className = 'model-item';
                modelItem.innerHTML = `
                    <div class="model-icon">
                        <i class="fas ${api.providerIcon}"></i>
                    </div>
                    <div class="model-info">
                        <div class="model-name">${model.name}</div>
                        <div class="model-description">${model.description}</div>
                        <div class="model-provider">${api.providerName} - ${api.name}</div>
                    </div>
                `;

                modelItem.addEventListener('click', () => {
                    this.selectModel(api.id, model, modelItem);
                });

                modelsList.appendChild(modelItem);

                const option = document.createElement('option');
                option.value = `${api.id}:${model.id}`;
                option.textContent = `${model.name} (${api.providerName})`;
                modelSelect.appendChild(option);
            });
        });
    }

    selectModel(apiId, model, element) {
        document.querySelectorAll('.model-item').forEach(item => {
            item.classList.remove('selected');
        });

        if (element) {
            element.classList.add('selected');
        }

        this.selectedModel = { apiId, model };
        document.getElementById('selectedModel').value = `${apiId}:${model.id}`;
        this.showNotification(`Model ${model.name} dipilih`, 'success');
    }

    selectModelFromDropdown(apiId, model) {
        const modelItems = document.querySelectorAll('.model-item');
        modelItems.forEach(item => {
            item.classList.remove('selected');
            if (item.querySelector('.model-name').textContent === model.name) {
                item.classList.add('selected');
            }
        });

        this.selectedModel = { apiId, model };
        this.showNotification(`Model ${model.name} dipilih`, 'success');
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) return;

        if (!this.selectedModel) {
            this.showNotification('Pilih model AI terlebih dahulu', 'error');
            return;
        }

        this.addChatMessage(message, 'user');
        input.value = '';
        
        const typingMessage = this.addChatMessage('AI sedang mengetik...', 'ai typing');

        try {
            const response = await this.callAI(message);
            this.removeChatMessage(typingMessage);
            this.addChatMessage(response, 'ai');
            
            this.currentConversation.push({
                user: message,
                ai: response,
                timestamp: new Date().toISOString(),
                apiId: this.selectedModel.apiId,
                modelId: this.selectedModel.model.id
            });

            const api = this.apis.find(a => a.id === this.selectedModel.apiId);
            if (api) {
                api.lastUsed = new Date().toISOString();
                api.connectionStatus = 'active';
                this.saveToStorage();
                this.renderApiList();
            }

        } catch (error) {
            this.removeChatMessage(typingMessage);
            this.addChatMessage(`Error: ${error.message}`, 'ai');
            this.showNotification('Gagal mengirim pesan', 'error');
            
            const api = this.apis.find(a => a.id === this.selectedModel.apiId);
            if (api) {
                api.connectionStatus = 'inactive';
                this.saveToStorage();
                this.renderApiList();
            }
        }
    }

    async callAI(message) {
        if (this.security.checkForSuspiciousActivity()) {
            throw new Error('Rate limit exceeded');
        }

        this.security.logRequest();

        const api = this.apis.find(a => a.id === this.selectedModel.apiId);
        if (!api) throw new Error('API tidak ditemukan');

        const sanitizedMessage = this.security.sanitizeInput(message);

        const payload = {
            model: this.selectedModel.model.id,
            messages: [
                {
                    role: 'user',
                    content: sanitizedMessage
                }
            ],
            max_tokens: 2000,
            temperature: 0.7
        };

        const response = await fetch(`${api.url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api.key}`,
                'User-Agent': 'GUI-AI-BETA/1.0',
                'X-Session-ID': this.sessionId
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Tidak ada respon dari AI';
    }

    addChatMessage(message, type, isTemporary = false) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        messageDiv.textContent = message;
        
        if (isTemporary) {
            messageDiv.setAttribute('data-temporary', 'true');
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageDiv;
    }

    removeChatMessage(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    clearChat() {
        if (confirm('Hapus semua pesan chat?')) {
            document.getElementById('chatMessages').innerHTML = '';
            this.currentConversation = [];
            this.showNotification('Chat berhasil dihapus', 'success');
        }
    }

    renderApiList() {
        const container = document.getElementById('apiList');
        
        if (this.apis.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Belum ada API yang tersimpan</p>';
            return;
        }

        container.innerHTML = this.apis.map(api => `
            <div class="api-item">
                <h3>
                    <span class="status-indicator ${api.connectionStatus === 'active' ? 'status-active' : 'status-inactive'}"></span>
                    ${api.name}
                    <span class="connection-status connection-${api.connectionStatus}">
                        ${api.connectionStatus === 'active' ? 'Connected' : 'Disconnected'}
                    </span>
                </h3>
                <p><strong>Provider:</strong> ${api.providerName} <i class="fas ${api.providerIcon}"></i></p>
                <p><strong>URL:</strong> ${api.url}</p>
                <p><strong>Deskripsi:</strong> ${api.description || 'Tidak ada deskripsi'}</p>
                <p><strong>Dibuat:</strong> ${new Date(api.createdAt).toLocaleDateString('id-ID')}</p>
                ${api.lastUsed ? `<p><strong>Terakhir digunakan:</strong> ${new Date(api.lastUsed).toLocaleDateString('id-ID')}</p>` : ''}
                <div class="api-key-display">
                    ${this.maskApiKey(api.key)}
                </div>
                <div class="api-actions">
                    <button class="btn-secondary" onclick="guiAi.copyApiKey('${api.key}')">
                        <i class="fas fa-copy"></i> Copy Key
                    </button>
                    <button class="btn-secondary" onclick="guiAi.testConnection('${api.id}')">
                        <i class="fas fa-plug"></i> Test
                    </button>
                    <button class="btn-danger" onclick="guiAi.deleteApi('${api.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        `).join('');
    }

    maskApiKey(key) {
        if (key.length <= 8) return '*'.repeat(key.length);
        return key.substring(0, 6) + '*'.repeat(key.length - 12) + key.substring(key.length - 6);
    }

    clearForm() {
        document.getElementById('apiForm').reset();
        document.getElementById('apiUrl').value = 'https://agentrouter.org';
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.4s ease';
            setTimeout(() => notification.remove(), 400);
        }, 3000);
    }

    async saveToStorage() {
        try {
            const encryptedApis = await this.security.encryptData(this.apis);
            const encryptedConversations = await this.security.encryptData(this.currentConversation);
            
            localStorage.setItem('guiAiBeta_apis_encrypted', JSON.stringify(encryptedApis));
            localStorage.setItem('guiAiBeta_conversations_encrypted', JSON.stringify(encryptedConversations));
            localStorage.setItem('guiAiBeta_session', this.sessionId);
            
        } catch (error) {
            console.error('Gagal mengenkripsi data:', error);
            this.showNotification('Gagal menyimpan data dengan aman', 'error');
        }
    }

    async loadFromStorage() {
        try {
            const encryptedApis = localStorage.getItem('guiAiBeta_apis_encrypted');
            const encryptedConversations = localStorage.getItem('guiAiBeta_conversations_encrypted');
            
            if (encryptedApis) {
                const decryptedApis = await this.security.decryptData(JSON.parse(encryptedApis));
                return decryptedApis;
            }
            
            const legacyApis = localStorage.getItem('guiAiBeta_apis');
            if (legacyApis) {
                const apis = JSON.parse(legacyApis);
                localStorage.removeItem('guiAiBeta_apis');
                return apis;
            }
            
            return [];
        } catch (error) {
            console.error('Gagal mendekripsi data:', error);
            this.showNotification('Gagal memuat data terenkripsi', 'error');
            return [];
        }
    }

    async testConnection(apiId) {
        const api = this.apis.find(a => a.id === apiId);
        if (!api) return;

        this.showNotification('Testing koneksi...', 'success');

        try {
            const response = await fetch(`${api.url}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${api.key}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                api.connectionStatus = 'active';
                api.lastUsed = new Date().toISOString();
                this.showNotification('Koneksi berhasil', 'success');
            } else {
                api.connectionStatus = 'inactive';
                this.showNotification('Koneksi gagal', 'error');
            }
        } catch (error) {
            api.connectionStatus = 'inactive';
            this.showNotification(`Koneksi gagal: ${error.message}`, 'error');
        }

        this.saveToStorage();
        this.renderApiList();
    }

    exportData() {
        const maskedApis = this.apis.map(api => ({
            ...api,
            key: this.security.maskSensitiveData(api.key)
        }));

        const data = {
            apis: maskedApis,
            conversations: this.currentConversation,
            exportDate: new Date().toISOString(),
            version: 'GUI AI BETA v1.0',
            sessionId: this.sessionId,
            theme: this.currentTheme
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gui-ai-beta-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Data berhasil diekspor (API keys di-mask)', 'success');
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.apis) {
                    this.apis = data.apis;
                    await this.saveToStorage();
                    this.renderApiList();
                    this.loadAvailableModels();
                }
                
                if (data.conversations) {
                    this.currentConversation = data.conversations;
                    this.loadConversationHistory();
                }

                if (data.theme) {
                    this.changeTheme(data.theme);
                }
                
                this.showNotification('Data berhasil diimpor', 'success');
            } catch (error) {
                this.showNotification('File tidak valid', 'error');
            }
        };
        reader.readAsText(file);
    }

    loadConversationHistory() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '';
        
        this.currentConversation.forEach(conv => {
            this.addChatMessage(conv.user, 'user');
            this.addChatMessage(conv.ai, 'ai');
        });
    }

    async testAllConnections() {
        this.showNotification('Testing semua koneksi API...', 'success');
        
        for (const api of this.apis) {
            await this.testConnection(api.id);
        }
        
        this.showNotification('Test koneksi selesai', 'success');
    }

    resetAllData() {
        if (confirm('Hapus semua data termasuk API keys dan conversation history?')) {
            localStorage.removeItem('guiAiBeta_apis_encrypted');
            localStorage.removeItem('guiAiBeta_conversations_encrypted');
            localStorage.removeItem('guiAiBeta_apis');
            localStorage.removeItem('guiAiBeta_conversations');
            localStorage.removeItem('guiAiBeta_session');
            
            this.apis = [];
            this.currentConversation = [];
            this.selectedModel = null;
            
            this.renderApiList();
            this.loadAvailableModels();
            document.getElementById('chatMessages').innerHTML = '';
            
            this.showNotification('Semua data berhasil dihapus', 'success');
        }
    }

    generateApiKeyReport() {
        const report = {
            totalApis: this.apis.length,
            activeApis: this.apis.filter(api => api.connectionStatus === 'active').length,
            providers: [...new Set(this.apis.map(api => api.providerName))],
            totalConversations: this.currentConversation.length,
            lastActivity: this.apis.reduce((latest, api) => {
                if (!api.lastUsed) return latest;
                const apiDate = new Date(api.lastUsed);
                return !latest || apiDate > latest ? apiDate : latest;
            }, null),
            currentTheme: this.currentTheme,
            reportGenerated: new Date().toISOString()
        };
        
        console.table(report);
        this.showNotification('Report generated in console', 'success');
        return report;
    }
}

const guiAi = new GuiAiBeta();

document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.createElement('button');
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export';
    exportBtn.className = 'btn-secondary';
    exportBtn.onclick = () => guiAi.exportData();
    
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    importInput.onchange = (e) => {
        if (e.target.files[0]) {
            guiAi.importData(e.target.files[0]);
        }
    };
    
    const importBtn = document.createElement('button');
    importBtn.innerHTML = '<i class="fas fa-upload"></i> Import';
    importBtn.className = 'btn-secondary';
    importBtn.onclick = () => importInput.click();
    
    const testAllBtn = document.createElement('button');
    testAllBtn.innerHTML = '<i class="fas fa-check-circle"></i> Test All';
    testAllBtn.className = 'btn-secondary';
    testAllBtn.onclick = () => guiAi.testAllConnections();
    
    const resetBtn = document.createElement('button');
    resetBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Reset All';
    resetBtn.className = 'btn-danger';
    resetBtn.onclick = () => guiAi.resetAllData();
    
    const reportBtn = document.createElement('button');
    reportBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Report';
    reportBtn.className = 'btn-secondary';
    reportBtn.onclick = () => guiAi.generateApiKeyReport();
    
    const header = document.querySelector('header');
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls-container';
    
    controlsContainer.appendChild(exportBtn);
    controlsContainer.appendChild(importBtn);
    controlsContainer.appendChild(testAllBtn);
    controlsContainer.appendChild(reportBtn);
    controlsContainer.appendChild(resetBtn);
    controlsContainer.appendChild(importInput);
    
    header.appendChild(controlsContainer);
    
    const versionInfo = document.createElement('div');
    versionInfo.innerHTML = '<small>Version 1.0 BETA | AgentRouter Integration | Neomorphism Design</small>';
    versionInfo.className = 'version-info';
    versionInfo.style.marginTop = '15px';
    versionInfo.style.opacity = '0.7';
    header.appendChild(versionInfo);
});

window.addEventListener('beforeunload', () => {
    guiAi.saveToStorage();
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                guiAi.saveToStorage();
                guiAi.showNotification('Data tersimpan', 'success');
                break;
            case 'e':
                e.preventDefault();
                guiAi.exportData();
                break;
            case 'r':
                e.preventDefault();
                guiAi.generateApiKeyReport();
                break;
            case '1':
                e.preventDefault();
                guiAi.changeTheme('light');
                break;
            case '2':
                e.preventDefault();
                guiAi.changeTheme('dark');
                break;
            case '3':
                e.preventDefault();
                guiAi.changeTheme('blue');
                break;
            case '4':
                e.preventDefault();
                guiAi.changeTheme('purple');
                break;
        }
    }
    
    if (e.key === 'Escape') {
        const chatInput = document.getElementById('chatInput');
        if (chatInput === document.activeElement) {
            chatInput.blur();
        }
    }
});