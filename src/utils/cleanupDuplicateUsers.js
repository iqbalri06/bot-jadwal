const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../taskbot.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database');
        cleanupDuplicateUsers();
    }
});

// Function to clean up duplicate users and standardize phone numbers
function cleanupDuplicateUsers() {
    // Get all users to find duplicates
    db.all('SELECT * FROM users ORDER BY id', [], (err, rows) => {
        if (err) {
            console.error('Error retrieving users:', err.message);
            closeAndExit(1);
            return;
        }
        
        // Create a map to track phone numbers and their canonical format
        const phoneMap = new Map();
        const duplicates = [];
        
        // Process each user to find duplicates
        rows.forEach(user => {
            // Standardize phone number format (remove leading 0, add country code if missing)
            let standardNumber = user.phone_number;
            
            // Skip the default 'admin' account
            if (standardNumber === 'admin') {
                return;
            }
            
            // Remove any non-digits
            standardNumber = standardNumber.replace(/\D/g, '');
            
            // If it starts with 0, remove the 0 and add 62 (Indonesia country code)
            if (standardNumber.startsWith('0')) {
                standardNumber = '62' + standardNumber.substring(1);
            } 
            // If it doesn't have country code, add 62
            else if (!standardNumber.startsWith('62')) {
                standardNumber = '62' + standardNumber;
            }
            
            // Check if we've seen this number before
            if (phoneMap.has(standardNumber)) {
                duplicates.push({
                    original: user,
                    standardNumber: standardNumber,
                    conflictsWith: phoneMap.get(standardNumber)
                });
            } else {
                phoneMap.set(standardNumber, user);
            }
        });
        
        // Handle duplicates - keep the one with higher permissions or the older one
        const deletions = [];
        const updates = [];
        
        duplicates.forEach(dup => {
            const original = dup.original;
            const conflict = dup.conflictsWith;
            
            console.log(`Found duplicate: ${original.phone_number} (ID: ${original.id}) and ${conflict.phone_number} (ID: ${conflict.id})`);
            
            // Determine which to keep based on role hierarchy
            const roleHierarchy = { 'superadmin': 3, 'admin': 2, 'user': 1 };
            
            const originalRank = roleHierarchy[original.role] || 0;
            const conflictRank = roleHierarchy[conflict.role] || 0;
            
            if (originalRank > conflictRank) {
                // Original has higher role, delete conflict and update phone number
                deletions.push(conflict.id);
                updates.push({
                    id: original.id,
                    phoneNumber: dup.standardNumber
                });
                console.log(`  Keeping ${original.phone_number} (${original.role}) and deleting ${conflict.phone_number} (${conflict.role})`);
            } else if (conflictRank > originalRank) {
                // Conflict has higher role, delete original
                deletions.push(original.id);
                updates.push({
                    id: conflict.id,
                    phoneNumber: dup.standardNumber
                });
                console.log(`  Keeping ${conflict.phone_number} (${conflict.role}) and deleting ${original.phone_number} (${original.role})`);
            } else {
                // Same role, keep the one with lower ID (older)
                if (original.id < conflict.id) {
                    deletions.push(conflict.id);
                    updates.push({
                        id: original.id,
                        phoneNumber: dup.standardNumber
                    });
                    console.log(`  Keeping older record ${original.phone_number} (ID: ${original.id}) and deleting ${conflict.phone_number} (ID: ${conflict.id})`);
                } else {
                    deletions.push(original.id);
                    updates.push({
                        id: conflict.id,
                        phoneNumber: dup.standardNumber
                    });
                    console.log(`  Keeping older record ${conflict.phone_number} (ID: ${conflict.id}) and deleting ${original.phone_number} (ID: ${original.id})`);
                }
            }
        });
        
        // Process updates and deletions
        if (deletions.length === 0 && updates.length === 0) {
            console.log('No duplicates to clean up.');
            closeAndExit(0);
            return;
        }
        
        // Begin transaction
        db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('Error beginning transaction:', err.message);
                closeAndExit(1);
                return;
            }
            
            // Process each deletion
            const deletePromises = deletions.map(id => {
                return new Promise((resolve, reject) => {
                    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`Deleted user ID ${id}`);
                            resolve();
                        }
                    });
                });
            });
            
            // Process each update
            const updatePromises = updates.map(update => {
                return new Promise((resolve, reject) => {
                    db.run('UPDATE users SET phone_number = ? WHERE id = ?', [update.phoneNumber, update.id], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`Updated user ID ${update.id} to phone number ${update.phoneNumber}`);
                            resolve();
                        }
                    });
                });
            });
            
            // Wait for all operations to complete
            Promise.all([...deletePromises, ...updatePromises])
                .then(() => {
                    // Commit transaction
                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('Error committing transaction:', err.message);
                            closeAndExit(1);
                        } else {
                            console.log('Successfully cleaned up duplicate users.');
                            closeAndExit(0);
                        }
                    });
                })
                .catch(err => {
                    console.error('Error during cleanup:', err.message);
                    db.run('ROLLBACK', () => closeAndExit(1));
                });
        });
    });
}

function closeAndExit(code) {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
        process.exit(code);
    });
}
