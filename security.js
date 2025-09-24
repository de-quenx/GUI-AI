class SecurityManager {
    constructor() {
        this.allowedDomains = [
            'localhost',
            '127.0.0.1',
            'file://',
            'agentrouter.org',
            // Tambahkan domain yang diizinkan
        ];
        
        this.requestLog = [];
        this.maxRequestsPerMinute = 30;
        this.suspiciousPatterns = [
            /script/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /onload/gi,
            /onerror/gi,
            /eval\(/gi,
            /<script/gi,
            /<iframe/gi
        ];
        
        this.encryptionKey = null;
        this.initEncryption();
        
        // Enhanced rate limiting
        this.rateLimiter = new Map();
        this.maxActionsPerSession = 100;
        this.sessionStartTime = Date.now();
        this.actionCount = 0;
    }

    initEncryption() {
        try {
            // Generate or retrieve encryption key
            let key = localStorage.getItem('gui_ai_security_key');
            if (!key) {
                key = this.generateSecureKey();
                localStorage.setItem('gui_ai_security_key', key);
            }
            this.encryptionKey = key;
        } catch (error) {
            console.warn('Encryption initialization failed:', error);
            this.encryptionKey = this.generateSecureKey();
        }
    }

    generateSecureKey() {
        const array = new Uint8Array(32);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(array);
        } else {
            // Fallback for older browsers
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    validateOrigin() {
        try {
            const origin = window.location.origin || window.location.protocol + '//' + window.location.host;
            const hostname = window.location.hostname;
            
            // Allow file:// protocol for local development
            if (window.location.protocol === 'file:') {
                return true;
            }
            
            // Check if domain is in allowed list
            const isAllowed = this.allowedDomains.some(domain => {
                return hostname === domain || 
                       hostname.endsWith('.' + domain) ||
                       origin.includes(domain);
            });
            
            if (!isAllowed) {
                console.warn('Unauthorized domain access attempt:', hostname);
                this.logSecurityEvent('unauthorized_domain', { hostname, origin });
            }
            
            return isAllowed;
        } catch (error) {
            console.error('Origin validation error:', error);
            return false;
        }
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }
        
        // Remove potential XSS patterns
        let sanitized = input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        
        // Check for suspicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(sanitized)) {
                console.warn('Suspicious input detected:', input);
                this.logSecurityEvent('suspicious_input', { input: input.substring(0, 100) });
                return '';
            }
        }
        
        return sanitized.trim();
    }

    checkForSuspiciousActivity() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Clean old requests
        this.requestLog = this.requestLog.filter(time => time > oneMinuteAgo);
        
        // Check rate limit
        if (this.requestLog.length >= this.maxRequestsPerMinute) {
            this.logSecurityEvent('rate_limit_exceeded', { 
                requests: this.requestLog.length,
                timeWindow: '1 minute'
            });
            return true;
        }
        
        // Check session limits
        if (this.actionCount >= this.maxActionsPerSession) {
            this.logSecurityEvent('session_limit_exceeded', {
                actions: this.actionCount,
                sessionDuration: now - this.sessionStartTime
            });
            return true;
        }
        
        return false;
    }

    logRequest() {
        const now = Date.now();
        this.requestLog.push(now);
        this.actionCount++;
        
        // Optional: Log to server or analytics
        if (this.actionCount % 10 === 0) {
            this.logSecurityEvent('activity_checkpoint', {
                totalActions: this.actionCount,
                sessionDuration: now - this.sessionStartTime
            });
        }
    }

    async encryptData(data) {
        try {
            if (!this.encryptionKey || !data) {
                return data;
            }
            
            const jsonString = JSON.stringify(data);
            
            // Simple encryption using built-in methods
            if (window.crypto && window.crypto.subtle) {
                return await this.advancedEncrypt(jsonString);
            } else {
                return this.simpleEncrypt(jsonString);
            }
        } catch (error) {
            console.warn('Encryption failed, storing as plain text:', error);
            return data;
        }
    }

    async decryptData(encryptedData) {
        try {
            if (!this.encryptionKey || !encryptedData) {
                return encryptedData;
            }
            
            // Check if data is encrypted
            if (typeof encryptedData === 'object' && encryptedData.encrypted) {
                if (encryptedData.method === 'advanced') {
                    return JSON.parse(await this.advancedDecrypt(encryptedData));
                } else {
                    return JSON.parse(this.simpleDecrypt(encryptedData.data));
                }
            }
            
            return encryptedData;
        } catch (error) {
            console.warn('Decryption failed, returning original data:', error);
            return encryptedData;
        }
    }

    async advancedEncrypt(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const key = await this.getAdvancedKey();
        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        
        return {
            encrypted: true,
            method: 'advanced',
            data: Array.from(new Uint8Array(encryptedData)),
            iv: Array.from(iv)
        };
    }

    async advancedDecrypt(encryptedObj) {
        const key = await this.getAdvancedKey();
        const encryptedData = new Uint8Array(encryptedObj.data);
        const iv = new Uint8Array(encryptedObj.iv);
        
        const decryptedData = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedData
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decryptedData);
    }

    async getAdvancedKey() {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(this.encryptionKey.substring(0, 32));
        
        return await window.crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    simpleEncrypt(text) {
        let encrypted = '';
        const key = this.encryptionKey;
        
        for (let i = 0; i < text.length; i++) {
            const keyChar = key[i % key.length];
            const encryptedChar = String.fromCharCode(
                text.charCodeAt(i) ^ keyChar.charCodeAt(0)
            );
            encrypted += encryptedChar;
        }
        
        return {
            encrypted: true,
            method: 'simple',
            data: btoa(encrypted)
        };
    }

    simpleDecrypt(encryptedText) {
        const encrypted = atob(encryptedText);
        let decrypted = '';
        const key = this.encryptionKey;
        
        for (let i = 0; i < encrypted.length; i++) {
            const keyChar = key[i % key.length];
            const decryptedChar = String.fromCharCode(
                encrypted.charCodeAt(i) ^ keyChar.charCodeAt(0)
            );
            decrypted += decryptedChar;
        }
        
        return decrypted;
    }

    maskSensitiveData(data) {
        if (typeof data !== 'string' || data.length <= 8) {
            return '*'.repeat(8);
        }
        
        const start = data.substring(0, 4);
        const end = data.substring(data.length - 4);
        const middle = '*'.repeat(Math.max(4, data.length - 8));
        
        return start + middle + end;
    }

    validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return false;
        }
        
        // Basic validation
        if (key.length < 20) {
            return false;
        }
        
        // Check for suspicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(key)) {
                this.logSecurityEvent('suspicious_api_key', { 
                    keyLength: key.length,
                    pattern: pattern.source
                });
                return false;
            }
        }
        
        return true;
    }

    logSecurityEvent(eventType, details = {}) {
        const event = {
            type: eventType,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            details: details
        };
        
        // Log to console in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('Security Event:', event);
        }
        
        // Store locally for analysis
        try {
            const securityLog = JSON.parse(localStorage.getItem('gui_ai_security_log') || '[]');
            securityLog.push(event);
            
            // Keep only last 50 events
            if (securityLog.length > 50) {
                securityLog.shift();
            }
            
            localStorage.setItem('gui_ai_security_log', JSON.stringify(securityLog));
        } catch (error) {
            console.error('Failed to log security event:', error);
        }
        
        // Optional: Send to server for monitoring
        this.reportSecurityEvent(event);
    }

    async reportSecurityEvent(event) {
        // Only report in production and if endpoint is configured
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return;
        }
        
        try {
            // Uncomment and configure endpoint if needed
            /*
            await fetch('/api/security/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });
            */
        } catch (error) {
            // Silent fail for security reporting
            console.debug('Security reporting failed:', error);
        }
    }

    getSecurityReport() {
        const report = {
            sessionInfo: {
                startTime: new Date(this.sessionStartTime).toISOString(),
                duration: Date.now() - this.sessionStartTime,
                actionCount: this.actionCount,
                requestsInLastMinute: this.requestLog.length
            },
            security: {
                encryptionEnabled: !!this.encryptionKey,
                domainValidated: this.validateOrigin(),
                rateLimitStatus: this.requestLog.length < this.maxRequestsPerMinute ? 'OK' : 'EXCEEDED'
            },
            browser: {
                userAgent: navigator.userAgent,
                cryptoSupport: !!(window.crypto && window.crypto.subtle),
                localStorage: this.testLocalStorage(),
                cookies: navigator.cookieEnabled
            }
        };
        
        console.group('🔒 Security Report');
        console.table(report.sessionInfo);
        console.table(report.security);
        console.table(report.browser);
        console.groupEnd();
        
        return report;
    }

    testLocalStorage() {
        try {
            const testKey = '_test_storage';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }

    clearSecurityLog() {
        try {
            localStorage.removeItem('gui_ai_security_log');
            console.log('Security log cleared');
        } catch (error) {
            console.error('Failed to clear security log:', error);
        }
    }

    // Reset session counters (useful for long-running sessions)
    resetSession() {
        this.sessionStartTime = Date.now();
        this.actionCount = 0;
        this.requestLog = [];
        console.log('Security session reset');
    }

    // Enhanced input validation for specific contexts
    validateUrl(url) {
        try {
            const urlObj = new URL(url);
            const allowedProtocols = ['http:', 'https:'];
            
            if (!allowedProtocols.includes(urlObj.protocol)) {
                return false;
            }
            
            // Check for suspicious patterns in URL
            const suspiciousUrlPatterns = [
                /javascript:/gi,
                /data:/gi,
                /vbscript:/gi
            ];
            
            return !suspiciousUrlPatterns.some(pattern => pattern.test(url));
        } catch {
            return false;
        }
    }

    // Content Security Policy helper
    setupCSP() {
        if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; connect-src 'self' https://agentrouter.org https://api.openai.com https://api.anthropic.com";
            document.head.appendChild(meta);
        }
    }
}

// Auto-setup CSP on load
document.addEventListener('DOMContentLoaded', () => {
    if (window.SecurityManager) {
        const tempSecurity = new SecurityManager();
        tempSecurity.setupCSP();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
}