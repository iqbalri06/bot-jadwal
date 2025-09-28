// Bot configuration settings
module.exports = {
    // Default bot settings
    defaultSettings: {
        // Command prefix
        commandPrefix: '/',
        
        // Default super admin phone number (can be changed later)
        superadminNumber: 'admin',
        
        // Message templates
        messages: {
            welcome: '🤖 Selamat datang di Bot Tugas Kuliah!\nKetik /help untuk bantuan.',
            unauthorized: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.',
            invalidCommand: '❌ Perintah tidak valid. Ketik /help untuk melihat daftar perintah.'
        }
    }
};
