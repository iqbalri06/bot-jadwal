const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../taskbot.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath);

// Reset database but keep one superadmin
async function resetDatabase() {
    return new Promise((resolve, reject) => {
        // Start transaction
        db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('Error starting transaction:', err.message);
                return reject(err);
            }

            console.log('Starting database reset...');

            // Keep the specified super admin
            const superAdminPhone = '085155349970';
            const superAdminName = 'Super Admin';
            const superAdminRole = 'superadmin';
            
            // Get the super admin if it exists
            db.get("SELECT * FROM users WHERE phone_number = ?", [superAdminPhone], (err, superAdmin) => {
                if (err) {
                    console.error('Error checking for superadmin:', err.message);
                    db.run('ROLLBACK', () => reject(err));
                    return;
                }
                
                // Step 1: Delete all data from task_status table
                db.run("DELETE FROM task_status", (err) => {
                    if (err) {
                        console.error('Error deleting task_status:', err.message);
                        db.run('ROLLBACK', () => reject(err));
                        return;
                    }
                    
                    console.log('✅ Task status data deleted');
                    
                    // Step 2: Delete all data from tasks table
                    db.run("DELETE FROM tasks", (err) => {
                        if (err) {
                            console.error('Error deleting tasks:', err.message);
                            db.run('ROLLBACK', () => reject(err));
                            return;
                        }
                        
                        console.log('✅ Tasks data deleted');
                        
                        // Step 3: Delete all users except super admin
                        db.run("DELETE FROM users WHERE phone_number != ?", [superAdminPhone], (err) => {
                            if (err) {
                                console.error('Error deleting users:', err.message);
                                db.run('ROLLBACK', () => reject(err));
                                return;
                            }
                            
                            console.log('✅ Users deleted (except super admin)');
                            
                            // If the super admin doesn't exist, create it
                            if (!superAdmin) {
                                db.run("INSERT INTO users (phone_number, name, role) VALUES (?, ?, ?)",
                                    [superAdminPhone, superAdminName, superAdminRole], 
                                    function(err) {
                                        if (err) {
                                            console.error('Error creating superadmin:', err.message);
                                            db.run('ROLLBACK', () => reject(err));
                                            return;
                                        }
                                        
                                        console.log(`✅ Super Admin created with phone: ${superAdminPhone}`);
                                        
                                        // Commit the transaction
                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                console.error('Error committing transaction:', err.message);
                                                db.run('ROLLBACK', () => reject(err));
                                                return;
                                            }
                                            
                                            console.log('✅ Database reset complete');
                                            resolve(true);
                                        });
                                    }
                                );
                            } else {
                                // Make sure the super admin has the correct role and name
                                db.run("UPDATE users SET role = ?, name = ? WHERE phone_number = ?", 
                                    [superAdminRole, superAdminName, superAdminPhone], 
                                    function(err) {
                                        if (err) {
                                            console.error('Error updating superadmin:', err.message);
                                            db.run('ROLLBACK', () => reject(err));
                                            return;
                                        }
                                        
                                        console.log(`✅ Super Admin preserved and updated with phone: ${superAdminPhone}`);
                                        
                                        // Commit the transaction
                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                console.error('Error committing transaction:', err.message);
                                                db.run('ROLLBACK', () => reject(err));
                                                return;
                                            }
                                            
                                            console.log('✅ Database reset complete');
                                            resolve(true);
                                        });
                                    }
                                );
                            }
                        });
                    });
                });
            });
        });
    });
}

// Run the reset function
resetDatabase()
    .then(() => {
        console.log('Database reset successful');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Database reset failed:', error);
        process.exit(1);
    });
