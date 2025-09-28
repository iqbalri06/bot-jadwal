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
        checkDatabaseTables();
    }
});

// Function to check database tables
function checkDatabaseTables() {
    console.log('Checking database tables...');
    
    // Check tasks table
    db.all("PRAGMA table_info(tasks)", [], (err, tasks) => {
        if (err) {
            console.error('Error checking tasks table:', err.message);
        } else {
            console.log('Tasks table structure:', tasks);
            
            // Check task data
            db.all("SELECT * FROM tasks", [], (err, taskRows) => {
                if (err) {
                    console.error('Error retrieving tasks:', err.message);
                } else {
                    console.log(`Found ${taskRows.length} tasks in database:`);
                    console.log(taskRows);
                }
                
                // Check task_status table
                db.all("PRAGMA table_info(task_status)", [], (err, taskStatus) => {
                    if (err) {
                        console.error('Error checking task_status table:', err.message);
                        closeAndExit(1);
                    } else {
                        console.log('Task_status table structure:', taskStatus);
                        
                        // Check task_status data
                        db.all("SELECT * FROM task_status", [], (err, statusRows) => {
                            if (err) {
                                console.error('Error retrieving task statuses:', err.message);
                            } else {
                                console.log(`Found ${statusRows.length} task status records in database:`);
                                console.log(statusRows);
                            }
                            closeAndExit(0);
                        });
                    }
                });
            });
        }
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
