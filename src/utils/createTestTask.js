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
        createTestTask();
    }
});

// Function to create a test task
async function createTestTask() {
    const title = 'Test Tugas Matematika';
    const deadline = '2025-10-01';
    const createdById = 3; // Using superadmin ID
    
    console.log('Creating test task with the following details:');
    console.log('- Title:', title);
    console.log('- Deadline:', deadline);
    console.log('- Created by ID:', createdById);
    
    // Begin transaction
    db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
            console.error('Error starting transaction:', err.message);
            closeAndExit(1);
            return;
        }
        
        // Insert the task
        db.run(
            'INSERT INTO tasks (title, deadline, created_by) VALUES (?, ?, ?)',
            [title, deadline, createdById],
            function (err) {
                if (err) {
                    console.error('Error inserting task:', err.message);
                    db.run('ROLLBACK', () => closeAndExit(1));
                    return;
                }
                
                const taskId = this.lastID;
                console.log('Task created with ID:', taskId);
                
                // Get all users
                db.all('SELECT id FROM users', [], (err, users) => {
                    if (err) {
                        console.error('Error getting users:', err.message);
                        db.run('ROLLBACK', () => closeAndExit(1));
                        return;
                    }
                    
                    console.log('Found', users.length, 'users. Adding task status for each user...');
                    
                    // Create status entries for each user
                    let completed = 0;
                    let failed = 0;
                    
                    function processNextUser(index) {
                        if (index >= users.length) {
                            // All users processed
                            if (failed > 0) {
                                console.error(`Failed to add status for ${failed} users.`);
                                db.run('ROLLBACK', () => closeAndExit(1));
                            } else {
                                console.log(`Successfully added task status for all ${completed} users.`);
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error('Error committing transaction:', err.message);
                                        db.run('ROLLBACK', () => closeAndExit(1));
                                    } else {
                                        console.log('Transaction committed successfully.');
                                        
                                        // Verify the task was created
                                        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
                                            if (err) {
                                                console.error('Error verifying task:', err.message);
                                            } else {
                                                console.log('Created task:', row);
                                            }
                                            
                                            // Check task statuses
                                            db.all('SELECT * FROM task_status WHERE task_id = ?', [taskId], (err, rows) => {
                                                if (err) {
                                                    console.error('Error retrieving task statuses:', err.message);
                                                } else {
                                                    console.log(`Created ${rows.length} task status records:`, rows);
                                                }
                                                closeAndExit(0);
                                            });
                                        });
                                    }
                                });
                            }
                            return;
                        }
                        
                        const user = users[index];
                        db.run(
                            'INSERT INTO task_status (task_id, user_id, completed) VALUES (?, ?, 0)',
                            [taskId, user.id],
                            (err) => {
                                if (err) {
                                    console.error(`Error adding status for user ${user.id}:`, err.message);
                                    failed++;
                                } else {
                                    completed++;
                                }
                                
                                // Process next user
                                processNextUser(index + 1);
                            }
                        );
                    }
                    
                    // Start processing users
                    processNextUser(0);
                });
            }
        );
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
