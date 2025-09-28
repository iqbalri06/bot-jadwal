const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../taskbot.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Create users table with role (superadmin, admin, user)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT UNIQUE,
        name TEXT,
        role TEXT CHECK(role IN ('superadmin', 'admin', 'user')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table initialized');
            
            // Check if a super admin exists, if not create one
            db.get("SELECT * FROM users WHERE role = 'superadmin' LIMIT 1", (err, row) => {
                if (err) {
                    console.error('Error checking for superadmin:', err.message);
                } else if (!row) {
                    // No superadmin found, create one (default)
                    db.run("INSERT INTO users (phone_number, name, role) VALUES (?, ?, ?)",
                        ['admin', 'Super Admin', 'superadmin'], 
                        function(err) {
                            if (err) {
                                console.error('Error creating default superadmin:', err.message);
                            } else {
                                console.log('Default superadmin created');
                            }
                        }
                    );
                }
            });
        }
    });

    // Create tasks table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        deadline TEXT NOT NULL,
        photo_path TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Error creating tasks table:', err.message);
        } else {
            console.log('Tasks table initialized');
        }
    });

    // Create task_status table for tracking which users have completed which tasks
    db.run(`CREATE TABLE IF NOT EXISTS task_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        user_id INTEGER,
        completed INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(task_id, user_id)
    )`, (err) => {
        if (err) {
            console.error('Error creating task_status table:', err.message);
        } else {
            console.log('Task status table initialized');
        }
    });
    
    // Create task_photos table for storing multiple photos per task
    db.run(`CREATE TABLE IF NOT EXISTS task_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        photo_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
    )`, (err) => {
        if (err) {
            console.error('Error creating task_photos table:', err.message);
        } else {
            console.log('Task photos table initialized');
        }
    });
}

module.exports = db;
