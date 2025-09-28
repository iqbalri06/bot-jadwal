/**
 * System diagnostics utility for the WhatsApp bot
 * Provides helper functions to check system status and performance
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const systemDiagnostics = {
    // Get system information
    getSystemInfo: () => {
        return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            uptime: (os.uptime() / 3600).toFixed(2) + ' hours',
            processUptime: (process.uptime() / 3600).toFixed(2) + ' hours',
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        };
    },
    
    // Check disk space usage for the assets directory
    getDiskUsage: () => {
        const assetsDir = path.join(__dirname, '../../assets');
        const stats = {
            directoryExists: fs.existsSync(assetsDir),
            files: 0,
            totalSize: 0,
            largestFile: { name: '', size: 0 }
        };
        
        if (stats.directoryExists) {
            try {
                const files = fs.readdirSync(assetsDir);
                stats.files = files.length;
                
                files.forEach(file => {
                    try {
                        const filePath = path.join(assetsDir, file);
                        const fileStats = fs.statSync(filePath);
                        
                        if (fileStats.isFile()) {
                            stats.totalSize += fileStats.size;
                            
                            if (fileStats.size > stats.largestFile.size) {
                                stats.largestFile.name = file;
                                stats.largestFile.size = fileStats.size;
                            }
                        }
                    } catch (err) {
                        // Skip file if there's an error
                    }
                });
                
                // Convert to MB for readability
                stats.totalSize = (stats.totalSize / (1024 * 1024)).toFixed(2) + ' MB';
                stats.largestFile.size = (stats.largestFile.size / (1024 * 1024)).toFixed(2) + ' MB';
            } catch (err) {
                console.error('Error checking disk usage:', err);
            }
        }
        
        return stats;
    },
    
    // Get session files information
    getSessionInfo: () => {
        const sessionsDir = path.join(__dirname, '../../sessions');
        const stats = {
            directoryExists: fs.existsSync(sessionsDir),
            files: 0,
            totalSize: 0,
            credsFileExists: false,
            lastModified: null
        };
        
        if (stats.directoryExists) {
            try {
                const files = fs.readdirSync(sessionsDir);
                stats.files = files.length;
                
                let totalSize = 0;
                let newestTime = 0;
                
                files.forEach(file => {
                    try {
                        const filePath = path.join(sessionsDir, file);
                        const fileStats = fs.statSync(filePath);
                        
                        if (fileStats.isFile()) {
                            totalSize += fileStats.size;
                            
                            // Check for creds.json file
                            if (file === 'creds.json') {
                                stats.credsFileExists = true;
                            }
                            
                            // Track the newest file
                            if (fileStats.mtimeMs > newestTime) {
                                newestTime = fileStats.mtimeMs;
                                stats.lastModified = new Date(newestTime).toISOString();
                            }
                        }
                    } catch (err) {
                        // Skip file if there's an error
                    }
                });
                
                // Convert to MB for readability
                stats.totalSize = (totalSize / (1024 * 1024)).toFixed(2) + ' MB';
            } catch (err) {
                console.error('Error checking session files:', err);
            }
        }
        
        return stats;
    },
    
    // Get diagnostics report
    getDiagnostics: () => {
        return {
            system: systemDiagnostics.getSystemInfo(),
            diskUsage: systemDiagnostics.getDiskUsage(),
            sessionInfo: systemDiagnostics.getSessionInfo(),
            memoryUsage: process.memoryUsage(),
            formattedMemoryUsage: {
                rss: (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB',
                heapTotal: (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(2) + ' MB',
                heapUsed: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2) + ' MB',
                external: (process.memoryUsage().external / (1024 * 1024)).toFixed(2) + ' MB'
            }
        };
    },
    
    // Format diagnostics as text
    formatDiagnosticsText: () => {
        const diagnostics = systemDiagnostics.getDiagnostics();
        
        return `📊 *SYSTEM DIAGNOSTICS REPORT*
        
🖥️ *System Info*
• Platform: ${diagnostics.system.platform}
• Architecture: ${diagnostics.system.arch}
• CPUs: ${diagnostics.system.cpus}
• Total Memory: ${diagnostics.system.totalMemory}
• Free Memory: ${diagnostics.system.freeMemory}
• System Uptime: ${diagnostics.system.uptime}
• Bot Uptime: ${diagnostics.system.processUptime}
• Node Version: ${diagnostics.system.nodeVersion}

💾 *Storage Info*
• Assets Directory: ${diagnostics.diskUsage.directoryExists ? 'Exists' : 'Missing'}
• Media Files: ${diagnostics.diskUsage.files}
• Total Media Size: ${diagnostics.diskUsage.totalSize}
• Largest File: ${diagnostics.diskUsage.largestFile.name} (${diagnostics.diskUsage.largestFile.size})

🔐 *Session Info*
• Sessions Directory: ${diagnostics.sessionInfo.directoryExists ? 'Exists' : 'Missing'}
• Session Files: ${diagnostics.sessionInfo.files}
• Total Size: ${diagnostics.sessionInfo.totalSize}
• Credentials File: ${diagnostics.sessionInfo.credsFileExists ? 'Exists' : 'Missing'}
• Last Modified: ${diagnostics.sessionInfo.lastModified || 'N/A'}

🧠 *Memory Usage*
• RSS: ${diagnostics.formattedMemoryUsage.rss}
• Heap Total: ${diagnostics.formattedMemoryUsage.heapTotal}
• Heap Used: ${diagnostics.formattedMemoryUsage.heapUsed}
• External: ${diagnostics.formattedMemoryUsage.external}

⏰ *Generated at*: ${diagnostics.system.timestamp}`;
    }
};

module.exports = systemDiagnostics;
