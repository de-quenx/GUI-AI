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
        this.themes = ['light', 'dark', 'blue', 'purple'];
        this.themeIcons = {
            'light': 'fa-sun',
            'dark': 'fa-moon', 
            'blue': 'fa-water',
            'purple': 'fa-gem'
        };
        this.currentPanel = 'welcome'; // 'welcome', 'models', 'chat'
        
        this.init();
    }

    async init() {
        this.apis = await this.loadFromStorage();
        this.initTheme();
        this.bindEvents();
        this.renderApiList();
        this.checkAndShowInterface();
        await this.loadConversationHistory();
    }

    initTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            const icon = themeBtn.querySelector('i');
            icon.className = `fas ${this.themeIcons[this.currentTheme]}`;
        }
    }

    toggleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.currentTheme = this.themes[nextIndex];
        
        document.body.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('gui-ai-theme', this.currentTheme);
        this.updateThemeIcon();
        
        const themeNames = {
            'light': 'Light',
            'dark': 'Dark',
            'blue': 'Blue Ocean',
            'purple': 'Purple Galaxy'
        };
        
        this.showNotification(`Tema ${themeNames[this.currentTheme]} diaktifkan`, 'success');
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    bindEvents() {
        // Form events
        const apiForm = document.getElementById('apiForm');
        if (apiForm) {
            apiForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addApi();
            });
        }

        const toggleKey = document.getElementById('toggleKey');
        if (toggleKey) {
            toggleKey.addEventListener('click', () => {
                this.togglePasswordVisibility();
            });
        }

        // Panel switching events
        const showModelsBtn = document.getElementById('showModelsBtn');
        if (showModelsBtn) {
            showModelsBtn.addEventListener('click', () => {
                this.showPanel('models');
            });
        }

        const showChatBtn = document.getElementById('showChatBtn');
        if (showChatBtn) {
            showChatBtn.addEventListener('click', () => {
                this.showPanel('chat');
            });
        }

        // Chat events
        const sendMessage = document.getElementById('sendMessage');
        if (sendMessage) {
            sendMessage.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        const clearChat = document.getElementById('clearChat');
        if (clearChat) {
            clearChat.addEventListener('click', () => {
                this.clearChat();
            });
        }

        const selectedModel = document.getElementById('selectedModel');
        if (selectedModel) {
            selectedModel.addEventListener('change', (e) => {
                if (e.target.value) {
                    const [apiId, modelId] = e.target.value.split(':');
                    const api = this.apis.find(a => a.id === apiId);
                    if (api) {
                        const models = this.getAvailableModels(api);
                        const model = models.find(m => m.id === modelId);
                        if (model) {
                            this.selectModelFromDropdown(apiId, model);
                        }
                    }
                }
            });
        }

        // Control events
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const importInput = document.getElementById('importInput');
                if (importInput) {
                    importInput.click();
                }
            });
        }

        const testAllBtn = document.getElementById('testAllBtn');
        if (testAllBtn) {
            testAllBtn.addEventListener('click', () => {
                this.testAllConnections();
            });
        }

        const reportBtn = document.getElementById('reportBtn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                this.generateApiKeyReport();
            });
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAllData();
            });
        }

        const importInput = document.getElementById('importInput');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.importData(e.target.files[0]);
                }
            });
        }
    }

    showPanel(panelName) {
        // Hide all panels
        const panels = document.querySelectorAll('.content-panel');
        panels.forEach(panel => {
            panel.classList.remove('active');
        });

        // Update button states
        const buttons = document.querySelectorAll('.top-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected panel
        let targetPanel;
        let targetButton;

        switch(panelName) {
            case 'models':
                targetPanel = document.getElementById('modelsPanel');
                targetButton = document.getElementById('showModelsBtn');
                break;
            case 'chat':
                targetPanel = document.getElementById('chatPanel');
                targetButton = document.getElementById('showChatBtn');
                break;
            default:
                targetPanel = document.getElementById('welcomePanel');
                break;
        }

        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        if (targetButton) {
            targetButton.classList.add('active');
        }

        this.currentPanel = panelName;
    }

    detectApiProvider(apiKey) {
        const patterns = {
            'openai': {
                pattern: /^sk-[a-zA-Z0-9]{20,}$/,
                name: 'OpenAI',
                icon: 'fa-brain'
            },
            'anthropic': {
                pattern: /^sk-ant-api03-[a-zA-Z0-9\-_]{95}$/,
                name: 'Anthropic',
                icon: 'fa-robot'
            },
            'google': {
                pattern: /^[a-zA-Z0-9\-_]{39}$/,
                name: 'Google',
                icon: 'fa-search'
            },
            'agentrouter': {
                pattern: /^[a-zA-Z0-9\-_]{32,}$/,
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
            ],
            'unknown': [
                { id: 'gpt-3.5-turbo', name: 'Default Model', description: 'Default AI model' }
            ]
        };

        return modelConfigs[api.provider] || modelConfigs['unknown'];
    }

    validateApiKey(key) {
        if (!key || key.trim().length === 0) {
            return false;
        }
        
        return key.trim().length >= 20;
    }

    async addApi() {
        if (this.security.checkForSuspiciousActivity()) {
            this.showNotification('Terlalu banyak request, coba lagi nanti', 'error');
            return;
        }

        const name = this.security.sanitizeInput(document.getElementById('apiName').value.trim());
        const key = document.getElementById('apiKey').value.trim();
        const url = this.security.sanitizeInput(document.getElementById('apiUrl').value.trim()) || 'https://agentrouter.org';

        if (!name) {
            this.showNotification('Nama API harus diisi', 'error');
            return;
        }

        if (!this.validateApiKey(key)) {
            this.showNotification('API key tidak valid (minimal 20 karakter)', 'error');
            return;
        }

        const detected = this.detectApiProvider(key);

        const api = {
            id: Date.now().toString(),
            name,
            key,
            url,
            provider: detected.provider,
            providerName: detected.name,
            providerIcon: detected.icon,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            sessionId: this.sessionId,
            connectionStatus: 'inactive'
        };

        // Test connection immediately after adding
        this.showNotification('Menambahkan API dan testing koneksi...', 'success');
        
        try {
            const isConnected = await this.testApiConnection(api);
            if (isConnected) {
                api.connectionStatus = 'active';
                api.lastUsed = new Date().toISOString();
                this.showNotification(`${detected.name} API berhasil ditambahkan dan terhubung`, 'success');
            } else {
                api.connectionStatus = 'inactive';
                this.showNotification(`${detected.name} API ditambahkan tapi gagal terhubung`, 'error');
            }
        } catch (error) {
            api.connectionStatus = 'inactive';
            this.showNotification(`${detected.name} API ditambahkan tapi koneksi error: ${error.message}`, 'error');
        }

        this.apis.push(api);
        this.saveToStorage();
        this.renderApiList();
        this.checkAndShowInterface();
        this.clearForm();
    }

    async testApiConnection(api) {
        try {
            const testPayload = {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 10
            };

            const response = await fetch(`${api.url}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${api.key}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'GUI-AI-BETA/1.0'
                },
                body: JSON.stringify(testPayload)
            });

            return response.ok || response.status === 401 || response.status === 403;
        } catch (error) {
            console.error('Connection test error:', error);
            return false;
        }
    }

    // Check and show interface based on connection status
    checkAndShowInterface() {
        const connectedApis = this.apis.filter(api => api.connectionStatus === 'active');
        const modelButtonsSection = document.getElementById('modelButtonsSection');

        if (connectedApis.length === 0) {
            // No connected APIs - show welcome panel
            if (modelButtonsSection) modelButtonsSection.style.display = 'none';
            this.showPanel('welcome');
        } else {
            // Has connected APIs - show model buttons and load models
            if (modelButtonsSection) modelButtonsSection.style.display = 'flex';
            this.loadAvailableModels();
            
            // Show chat panel by default when connected
            if (this.currentPanel === 'welcome') {
                this.showPanel('chat');
            }
        }
    }

    loadAvailableModels() {
        const modelsList = document.getElementById('modelsList');
        const modelSelect = document.getElementById('selectedModel');

        // Only load models from connected APIs
        const connectedApis = this.apis.filter(api => api.connectionStatus === 'active');

        if (connectedApis.length === 0) {
            return;
        }

        if (modelsList) modelsList.innerHTML = '';
        if (modelSelect) modelSelect.innerHTML = '<option value="">Pilih Model AI</option>';

        connectedApis.forEach(api => {
            const models = this.getAvailableModels(api);
            
            models.forEach(model => {
                if (modelsList) {
                    const modelItem = document.createElement('div');
                    modelItem.className = 'model-item';
                    modelItem.innerHTML = `
                        <div class="model-icon">
                            <i class="fas ${api.providerIcon}"></i>
                        </div>
                        <div class="model-info">
                            <div class="model-name">${model.name}</div>
                            <div class="model-description">${model.description}</div>
                        </div>
                    `;

                    modelItem.addEventListener('click', () => {
                        this.selectModel(api.id, model, modelItem);
                        // Auto switch to chat after selecting model
                        this.showPanel('chat');
                    });

                    modelsList.appendChild(modelItem);
                }

                if (modelSelect) {
                    const option = document.createElement('option');
                    option.value = `${api.id}:${model.id}`;
                    option.textContent = `${model.name} (${api.providerName})`;
                    modelSelect.appendChild(option);
                }
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
        const modelSelect = document.getElementById('selectedModel');
        if (modelSelect) {
            modelSelect.value = `${apiId}:${model.id}`;
        }
        this.showNotification(`Model ${model.name} dipilih`, 'success');
    }

    selectModelFromDropdown(apiId, model) {
        const modelItems = document.querySelectorAll('.model-item');
        modelItems.forEach(item => {
            item.classList.remove('selected');
            const modelName = item.querySelector('.model-name');
            if (modelName && modelName.textContent === model.name) {
                item.classList.add('selected');
            }
        });

        this.selectedModel = { apiId, model };
        this.showNotification(`Model ${model.name} dipilih`, 'success');
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        const message = input.value.trim();

        if (!message) {
            this.showNotification('Ketik pesan terlebih dahulu', 'error');
            return;
        }

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
            this.showNotification('Gagal mengirim pesan: ' + error.message, 'error');
            
            const api = this.apis.find(a => a.id === this.selectedModel.apiId);
            if (api) {
                api.connectionStatus = 'inactive';
                this.saveToStorage();
                this.renderApiList();
                this.checkAndShowInterface(); // Re-check interface after connection failure
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

        const payload = {
            model: this.selectedModel.model.id,
            messages: [
                {
                    role: 'user',
                    content: message
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
                'User-Agent': 'GUI-AI-BETA/1.0'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                // Ignore JSON parse errors
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Tidak ada respon dari AI';
    }

    addChatMessage(message, type) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return null;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        messageDiv.textContent = message;

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
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            this.currentConversation = [];
            this.saveToStorage();
            this.showNotification('Chat berhasil dihapus', 'success');
        }
    }

    deleteApi(id) {
        if (confirm('Hapus API ini?')) {
            this.apis = this.apis.filter(api => api.id !== id);
            this.saveToStorage();
            this.renderApiList();
            this.checkAndShowInterface(); // Re-check interface after API deletion
            this.showNotification('API berhasil dihapus', 'success');
        }
    }

    copyApiKey(key) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(key).then(() => {
                this.showNotification('API Key disalin ke clipboard', 'success');
            }).catch(() => {
                this.showNotification('Gagal menyalin API Key', 'error');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = key;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showNotification('API Key disalin ke clipboard', 'success');
            } catch (err) {
                this.showNotification('Gagal menyalin API Key', 'error');
            }
            document.body.removeChild(textArea);
        }
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

    renderApiList() {
        const container = document.getElementById('apiList');
        if (!container) return;
        
        if (this.apis.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Belum ada API yang tersimpan</p>';
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
                <p><strong>Dibuat:</strong> ${new Date(api.createdAt).toLocaleDateString('id-ID')}</p>
                ${api.lastUsed ? `<p><strong>Terakhir digunakan:</strong> ${new Date(api.lastUsed).toLocaleDateString('id-ID')}</p>` : ''}
                <div class="api-key-display">
                    ${this.maskApiKey(api.key)}
                </div>
                <div class="api-actions">
                    <button class="btn-secondary" onclick="guiAi.copyApiKey('${api.key.replace(/'/g, "\\'")}')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="btn-secondary" onclick="guiAi.testConnection('${api.id}')">
                        <i class="fas fa-plug"></i> Test
                    </button>
                    <button class="btn-danger" onclick="guiAi.deleteApi('${api.id}')">
                        <i class="fas fa-trash"></i> Del
                    </button>
                </div>
            </div>
        `).join('');
    }

    maskApiKey(key) {
        if (!key || key.length <= 8) return '*'.repeat(8);
        return key.substring(0, 6) + '*'.repeat(Math.max(8, key.length - 12)) + key.substring(key.length - 6);
    }

    clearForm() {
        const form = document.getElementById('apiForm');
        if (form) {
            form.reset();
            const urlInput = document.getElementById('apiUrl');
            if (urlInput) {
                urlInput.value = 'https://agentrouter.org';
            }
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.4s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 400);
        }, 3000);
    }

    async saveToStorage() {
        try {
            if (this.security && typeof this.security.encryptData === 'function') {
                const encryptedApis = await this.security.encryptData(this.apis);
                const encryptedConversations = await this.security.encryptData(this.currentConversation);
                
                localStorage.setItem('guiAiBeta_apis_encrypted', JSON.stringify(encryptedApis));
                localStorage.setItem('guiAiBeta_conversations_encrypted', JSON.stringify(encryptedConversations));
            } else {
                localStorage.setItem('guiAiBeta_apis', JSON.stringify(this.apis));
                localStorage.setItem('guiAiBeta_conversations', JSON.stringify(this.currentConversation));
            }
            
            localStorage.setItem('guiAiBeta_session', this.sessionId);
            localStorage.setItem('gui-ai-theme', this.currentTheme);
            
        } catch (error) {
            console.error('Gagal menyimpan data:', error);
            localStorage.setItem('guiAiBeta_apis', JSON.stringify(this.apis));
            localStorage.setItem('guiAiBeta_conversations', JSON.stringify(this.currentConversation));
        }
    }

    async loadFromStorage() {
        try {
            const encryptedApis = localStorage.getItem('guiAiBeta_apis_encrypted');
            
            if (encryptedApis && this.security && typeof this.security.decryptData === 'function') {
                const decryptedApis = await this.security.decryptData(JSON.parse(encryptedApis));
                return Array.isArray(decryptedApis) ? decryptedApis : [];
            }
            
            const plainApis = localStorage.getItem('guiAiBeta_apis');
            if (plainApis) {
                const apis = JSON.parse(plainApis);
                return Array.isArray(apis) ? apis : [];
            }
            
            return [];
        } catch (error) {
            console.error('Gagal memuat data:', error);
            return [];
        }
    }

    async loadConversationHistory() {
        try {
            const encryptedConversations = localStorage.getItem('guiAiBeta_conversations_encrypted');
            
            if (encryptedConversations && this.security && typeof this.security.decryptData === 'function') {
                const decryptedConversations = await this.security.decryptData(JSON.parse(encryptedConversations));
                this.currentConversation = Array.isArray(decryptedConversations) ? decryptedConversations : [];
            } else {
                const plainConversations = localStorage.getItem('guiAiBeta_conversations');
                if (plainConversations) {
                    this.currentConversation = JSON.parse(plainConversations) || [];
                }
            }
            
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer && this.currentConversation.length > 0) {
                messagesContainer.innerHTML = '';
                this.currentConversation.forEach(conv => {
                    this.addChatMessage(conv.user, 'user');
                    this.addChatMessage(conv.ai, 'ai');
                });
            }
            
        } catch (error) {
            console.error('Gagal memuat conversation history:', error);
            this.currentConversation = [];
        }
    }

    async testConnection(apiId) {
        const api = this.apis.find(a => a.id === apiId);
        if (!api) {
            this.showNotification('API tidak ditemukan', 'error');
            return;
        }

        this.showNotification('Testing koneksi...', 'success');

        try {
            const isConnected = await this.testApiConnection(api);
            
            if (isConnected) {
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
        this.checkAndShowInterface(); // Re-check interface after testing
    }

    exportData() {
        const maskedApis = this.apis.map(api => ({
            ...api,
            key: this.security.maskSensitiveData ? this.security.maskSensitiveData(api.key) : this.maskApiKey(api.key)
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
                
                if (data.apis && Array.isArray(data.apis)) {
                    const hasRealKeys = data.apis.some(api => 
                        api.key && !api.key.includes('*') && api.key.length > 20
                    );
                    
                    if (hasRealKeys || confirm('Import data ini? (API keys yang ada akan ditimpa)')) {
                        this.apis = data.apis;
                        await this.saveToStorage();
                        this.renderApiList();
                        this.checkAndShowInterface();
                    }
                }
                
                if (data.conversations && Array.isArray(data.conversations)) {
                    this.currentConversation = data.conversations;
                    await this.loadConversationHistory();
                }

                if (data.theme && this.themes.includes(data.theme)) {
                    this.currentTheme = data.theme;
                    document.body.setAttribute('data-theme', this.currentTheme);
                    localStorage.setItem('gui-ai-theme', this.currentTheme);
                    this.updateThemeIcon();
                }
                
                this.showNotification('Data berhasil diimpor', 'success');
            } catch (error) {
                this.showNotification('File tidak valid atau rusak', 'error');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    async testAllConnections() {
        if (this.apis.length === 0) {
            this.showNotification('Tidak ada API untuk ditest', 'error');
            return;
        }

        this.showNotification('Testing semua koneksi API...', 'success');
        
        for (const api of this.apis) {
            await this.testConnection(api.id);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.showNotification('Test koneksi selesai', 'success');
    }

    resetAllData() {
        if (confirm('Hapus semua data termasuk API keys dan conversation history?\n\nPeringatan: Tindakan ini tidak dapat dibatalkan!')) {
            localStorage.removeItem('guiAiBeta_apis_encrypted');
            localStorage.removeItem('guiAiBeta_conversations_encrypted');
            localStorage.removeItem('guiAiBeta_apis');
            localStorage.removeItem('guiAiBeta_conversations');
            localStorage.removeItem('guiAiBeta_session');
            
            this.apis = [];
            this.currentConversation = [];
            this.selectedModel = null;
            
            this.renderApiList();
            this.checkAndShowInterface();
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            this.showNotification('Semua data berhasil dihapus', 'success');
        }
    }

    generateApiKeyReport() {
        const activeApis = this.apis.filter(api => api.connectionStatus === 'active');
        const providers = [...new Set(this.apis.map(api => api.providerName))];
        const lastActivity = this.apis.reduce((latest, api) => {
            if (!api.lastUsed) return latest;
            const apiDate = new Date(api.lastUsed);
            return !latest || apiDate > latest ? apiDate : latest;
        }, null);

        const report = {
            totalApis: this.apis.length,
            activeApis: activeApis.length,
            inactiveApis: this.apis.length - activeApis.length,
            providers: providers,
            totalConversations: this.currentConversation.length,
            lastActivity: lastActivity ? lastActivity.toISOString() : null,
            currentTheme: this.currentTheme,
            currentPanel: this.currentPanel,
            reportGenerated: new Date().toISOString()
        };
        
        console.group('📊 GUI AI Beta Report');
        console.log('Total APIs:', report.totalApis);
        console.log('Active APIs:', report.activeApis);
        console.log('Inactive APIs:', report.inactiveApis);
        console.log('Providers:', report.providers.join(', '));
        console.log('Total Conversations:', report.totalConversations);
        console.log('Last Activity:', report.lastActivity || 'Never');
        console.log('Current Theme:', report.currentTheme);
        console.log('Current Panel:', report.currentPanel);
        console.log('Generated:', report.reportGenerated);
        console.groupEnd();
        
        this.showNotification('Report generated in console (F12)', 'success');
        return report;
    }
}

// Initialize the application
const guiAi = new GuiAiBeta();

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (window.guiAi) {
        guiAi.showNotification('Terjadi error, silakan refresh halaman', 'error');
    }
});

// Keyboard shortcuts
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
            case 't':
                e.preventDefault();
                guiAi.toggleTheme();
                break;
            case '1':
                e.preventDefault();
                if (guiAi.apis.filter(api => api.connectionStatus === 'active').length > 0) {
                    guiAi.showPanel('models');
                }
                break;
            case '2':
                e.preventDefault();
                if (guiAi.apis.filter(api => api.connectionStatus === 'active').length > 0) {
                    guiAi.showPanel('chat');
                }
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

// Auto-save on page unload
window.addEventListener('beforeunload', () => {
    if (window.guiAi) {
        guiAi.saveToStorage();
    }
});

// Service worker registration for offline support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Update footer with keyboard shortcuts info
document.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('footer p');
    if (footer) {
        footer.innerHTML = 'GUI AI BETA v1.0 - Powered by AgentRouter<br><small>Shortcuts: Ctrl+T (theme), Ctrl+E (export), Ctrl+S (save), Ctrl+R (report), Ctrl+1 (models), Ctrl+2 (chat)</small>';
    }
});