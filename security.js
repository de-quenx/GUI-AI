class SecurityManager {
    constructor() {
        this.encryptionKey = this.generateKey();
    }

    generateKey() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async encryptData(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        
        const key = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(this.encryptionKey.match(/.{2}/g).map(byte => parseInt(byte, 16))),
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataBuffer
        );

        return {
            encrypted: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv)
        };
    }

    async decryptData(encryptedData) {
        const key = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(this.encryptionKey.match(/.{2}/g).map(byte => parseInt(byte, 16))),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
            key,
            new Uint8Array(encryptedData.encrypted)
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }

    maskSensitiveData(data) {
        return data.replace(/sk-[a-zA-Z0-9-_]{20,}/g, (match) => {
            return match.substring(0, 6) + '*'.repeat(match.length - 12) + match.substring(match.length - 6);
        });
    }

    validateOrigin() {
        const allowedOrigins = [
            'localhost',
            '127.0.0.1',
            '.github.io'
        ];
        
        const hostname = window.location.hostname;
        return allowedOrigins.some(origin => 
            hostname === origin || hostname.endsWith(origin)
        );
    }

    sanitizeInput(input) {
        return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                   .replace(/javascript:/gi, '')
                   .replace(/on\w+\s*=/gi, '');
    }

    checkForSuspiciousActivity() {
        const requestCount = parseInt(localStorage.getItem('requestCount') || '0');
        const lastReset = parseInt(localStorage.getItem('lastReset') || Date.now());
        
        if (Date.now() - lastReset > 3600000) {
            localStorage.setItem('requestCount', '0');
            localStorage.setItem('lastReset', Date.now().toString());
            return false;
        }
        
        return requestCount > 100;
    }

    logRequest() {
        const requestCount = parseInt(localStorage.getItem('requestCount') || '0');
        localStorage.setItem('requestCount', (requestCount + 1).toString());
    }
}
