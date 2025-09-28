/**
 * Session manager utility for WhatsApp bot
 * Helps ensure session files are properly tracked in git
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const sessionManager = {
    // Path to sessions directory
    sessionDir: path.join(__dirname, '../../sessions'),
    
    // Check if sessions directory exists, create if not
    ensureSessionDir: () => {
        if (!fs.existsSync(sessionManager.sessionDir)) {
            try {
                fs.mkdirSync(sessionManager.sessionDir, { recursive: true });
                console.log('Sessions directory created successfully');
                
                // Create .gitkeep file
                sessionManager.createGitKeep();
            } catch (error) {
                console.error('Failed to create sessions directory:', error);
            }
        }
    },
    
    // Create .gitkeep file to ensure folder is tracked in Git
    createGitKeep: () => {
        const gitKeepPath = path.join(sessionManager.sessionDir, '.gitkeep');
        try {
            if (!fs.existsSync(gitKeepPath)) {
                fs.writeFileSync(gitKeepPath, '# This file is used to keep the sessions directory in Git\n# even when the directory is empty\n# Do not delete this file');
                console.log('.gitkeep file created successfully');
            }
        } catch (error) {
            console.error('Failed to create .gitkeep file:', error);
        }
    },
    
    // List all session files
    listSessionFiles: () => {
        try {
            sessionManager.ensureSessionDir();
            
            const files = fs.readdirSync(sessionManager.sessionDir);
            return files.filter(file => file !== '.gitkeep');
        } catch (error) {
            console.error('Failed to list session files:', error);
            return [];
        }
    },
    
    // Check if critical session files exist
    checkCriticalFiles: () => {
        const files = sessionManager.listSessionFiles();
        const result = {
            credsExists: files.includes('creds.json'),
            totalFiles: files.length,
            hasCriticalBlocks: files.some(file => file.includes('app-state-sync-version')),
            isReady: false
        };
        
        // Consider the session ready if we have creds.json and at least 5 files
        result.isReady = result.credsExists && result.totalFiles >= 5;
        
        return result;
    },
    
    // Backup all session files to ensure they're not lost
    backupSessions: (backupName = 'backup') => {
        const backupDir = path.join(sessionManager.sessionDir, `${backupName}_${Date.now()}`);
        
        try {
            // Create backup directory
            fs.mkdirSync(backupDir, { recursive: true });
            
            // Copy all session files except .gitkeep
            const files = sessionManager.listSessionFiles();
            files.forEach(file => {
                const sourcePath = path.join(sessionManager.sessionDir, file);
                const destPath = path.join(backupDir, file);
                fs.copyFileSync(sourcePath, destPath);
            });
            
            return {
                success: true,
                backupDir,
                fileCount: files.length
            };
        } catch (error) {
            console.error('Failed to backup session files:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // Check if git is ignoring session files
    checkGitIgnore: (callback) => {
        // Run git check-ignore command
        exec('git check-ignore sessions/creds.json', (error, stdout, stderr) => {
            if (error && error.code === 1) {
                // Exit code 1 means the file is not ignored (which is what we want)
                callback(null, {
                    isIgnored: false,
                    message: 'Session files are properly tracked in git'
                });
            } else if (stdout.trim() === 'sessions/creds.json') {
                // Output containing the filename means it's ignored
                callback(null, {
                    isIgnored: true,
                    message: 'Session files are being ignored by git'
                });
            } else {
                // Some other error
                callback(new Error('Error checking git ignore status: ' + stderr), null);
            }
        });
    }
};

module.exports = sessionManager;
