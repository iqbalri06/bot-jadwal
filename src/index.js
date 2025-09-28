const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const messageHandler = require('./handlers/messageHandler');
const memoryMonitor = require('./utils/memoryMonitor');
const sessionManager = require('./utils/sessionManager');
const systemDiagnostics = require('./utils/systemDiagnostics');

// Setup sessions directory and ensure it's tracked by git
const SESSION_DIR = path.join(__dirname, '../sessions');
sessionManager.ensureSessionDir();

// Check if sessions are being properly tracked by git
sessionManager.checkGitIgnore((err, result) => {
    if (err) {
        console.error('Error checking git ignore status:', err);
    } else if (result.isIgnored) {
        console.warn('⚠️ WARNING:', result.message);
        console.warn('⚠️ Sessions may not be uploaded to GitHub.');
        console.warn('⚠️ Make sure sessions/ is not in your .gitignore file.');
    } else {
        console.log('✅', result.message);
    }
});

// Initialize the WhatsApp connection
async function connectToWhatsApp() {
    // Use the saved authentication state
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    // Create a new WA socket
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        defaultQueryTimeoutMs: 60000
    });
    
    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // If QR code is received, display it explicitly
        if (qr) {
            console.log('QR Code received, scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        
        // If disconnected, try to reconnect
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            
            // Reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
        
        // If connection is open, log success
        if (connection === 'open') {
            console.log('Connection established!');
            console.log('Bot WhatsApp untuk Manajemen Tugas Kuliah siap digunakan');
            console.log('Ketik menu untuk menampilkan menu utama');
        }
    });
    
    // Handle credential updates
    sock.ev.on('creds.update', saveCreds);
    
    // Handle messages with safe error handling
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (!m || !m.type || m.type !== 'notify' || !m.messages) {
                return;
            }
            
            for (const msg of m.messages) {
                try {
                    // Skip messages from self
                    if (!msg || !msg.key || msg.key.fromMe) continue;
                    
                    // Process the message with timeout protection
                    const messageTimeout = setTimeout(() => {
                        console.warn(`⚠️ Message processing timeout for ${msg.key.id || 'unknown'}`);
                    }, 60000); // 60 second timeout
                    
                    await messageHandler(msg, sock);
                    clearTimeout(messageTimeout);
                } catch (msgError) {
                    console.error('Error processing individual message:', msgError);
                }
            }
        } catch (batchError) {
            console.error('Error processing message batch:', batchError);
        }
    });
    
    return sock;
}

// Start memory monitoring
console.log('Starting memory monitoring...');
memoryMonitor.startMonitoring(5); // Log memory usage every 5 minutes
memoryMonitor.createMemoryGuard(500, 10); // Check for high memory usage (500MB) every 10 minutes

// Start the WhatsApp bot
console.log('Starting WhatsApp bot...');
connectToWhatsApp();

// Handle uncaught exceptions to prevent the bot from crashing
process.on('uncaughtException', (err) => {
    console.error('=== UNCAUGHT EXCEPTION ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('==========================');
    
    // Attempt graceful recovery by restarting connection after a delay
    console.log('Attempting to recover in 30 seconds...');
    setTimeout(() => {
        try {
            console.log('Restarting WhatsApp connection...');
            connectToWhatsApp().catch(e => console.error('Failed to restart connection:', e));
        } catch (restartError) {
            console.error('Failed to restart after uncaught exception:', restartError);
        }
    }, 30000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('=== UNHANDLED REJECTION ===');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    
    // Log stack trace if available
    if (reason instanceof Error) {
        console.error('Error stack:', reason.stack);
    }
    console.error('===========================');
});
