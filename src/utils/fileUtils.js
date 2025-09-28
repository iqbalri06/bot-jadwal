const fs = require('fs');
const path = require('path');

const fileUtils = {
    // Save a file from WhatsApp to local storage
    saveMedia: async (media, filename) => {
        try {
            // Check if media exists and has content
            if (!media) {
                throw new Error('No media content provided');
            }
            
            // Create assets directory if it doesn't exist
            const assetsDir = path.join(__dirname, '../../assets');
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }
            
            // Create a unique filename if not provided
            const finalFilename = filename || `${Date.now()}.jpg`;
            const filePath = path.join(assetsDir, finalFilename);
            
            // Log media information for debugging
            console.log('Media information:');
            console.log('- Type:', typeof media);
            console.log('- Is Buffer:', Buffer.isBuffer(media));
            if (Buffer.isBuffer(media)) {
                console.log('- Buffer length:', media.length);
                console.log('- Content type hint:', media.length > 4 ? media.slice(0, 4).toString('hex') : 'too short');
                
                // Check if buffer is valid and not empty
                if (media.length === 0) {
                    throw new Error('Media buffer is empty (0 bytes)');
                }
                
                // Check if the file size is too large (limit to 10MB)
                if (media.length > 10 * 1024 * 1024) {
                    throw new Error(`Media file too large: ${(media.length / (1024 * 1024)).toFixed(2)}MB (max 10MB)`);
                }
            }
            
            // Ensure media is a buffer before saving
            let mediaBuffer = media;
            if (!Buffer.isBuffer(media)) {
                if (typeof media === 'string') {
                    try {
                        mediaBuffer = Buffer.from(media, 'base64');
                        console.log('Converted string to buffer, length:', mediaBuffer.length);
                        
                        if (mediaBuffer.length === 0) {
                            throw new Error('Converted buffer is empty');
                        }
                    } catch (err) {
                        console.error('Failed to convert string to buffer:', err);
                        throw new Error('Media is not in a valid format: ' + err.message);
                    }
                } else {
                    throw new Error('Media must be a Buffer or Base64 string, got: ' + typeof media);
                }
            }
            
            // Write the file using a safer method (write to temp file first, then rename)
            const tempFilePath = `${filePath}.temp`;
            fs.writeFileSync(tempFilePath, mediaBuffer);
            fs.renameSync(tempFilePath, filePath);
            
            console.log(`Media saved successfully to ${filePath}`);
            
            // Return the relative path (for database storage)
            return `assets/${finalFilename}`;
        } catch (error) {
            console.error('Error saving media:', error);
            throw error;
        }
    },
    
    // Get a file from local storage
    getMedia: (relativePath) => {
        try {
            if (!relativePath) {
                console.log('Warning: Empty media path provided');
                return null;
            }
            
            const fullPath = path.join(__dirname, '../../', relativePath);
            if (!fs.existsSync(fullPath)) {
                console.log(`Warning: File not found at path ${fullPath}`);
                return null;
            }
            
            try {
                const fileStats = fs.statSync(fullPath);
                if (fileStats.size <= 0) {
                    console.log(`Warning: File at ${fullPath} is empty (0 bytes)`);
                    return null;
                }
                
                if (fileStats.size > 10 * 1024 * 1024) { // 10MB limit
                    console.log(`Warning: File at ${fullPath} exceeds 10MB size limit (${fileStats.size} bytes)`);
                    return null;
                }
            } catch (statError) {
                console.error(`Error getting file stats for ${fullPath}:`, statError);
                return null;
            }
            
            return fs.readFileSync(fullPath);
        } catch (error) {
            console.error('Error getting media:', error);
            return null;
        }
    }
};

module.exports = fileUtils;
